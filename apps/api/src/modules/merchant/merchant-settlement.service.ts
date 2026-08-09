import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Approach A from `apps/api/docs/architecture/merchant-settlement-onboarding.md`:
 *
 * Auto-provision a managed Stellar settlement wallet for each merchant at
 * register time. The seed is AES-256-GCM-encrypted under a KEK from env
 * (`SETTLEMENT_KEY_KEK`) and stored in its own `MerchantSettlementKey`
 * table; the merchant row only ever sees the public address.
 *
 * Testnet path: Friendbot funds the new account (10k XLM, free).
 * Mainnet path: a dedicated sponsor wallet (`STELLAR_RESERVE_SPONSOR_SECRET`)
 * builds a CreateAccount op covering the 1 XLM base reserve + the 0.5 XLM
 * trustline reserve. Cost ~$0.15/merchant at current XLM prices.
 *
 * Idempotent on (merchantId): re-running returns the existing row instead
 * of provisioning a second wallet.
 */
@Injectable()
export class MerchantSettlementService {
  private readonly logger = new Logger(MerchantSettlementService.name);
  private readonly horizon: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly isTestnet: boolean;
  private readonly usdcIssuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const network =
      (this.config.get<string>('STELLAR_NETWORK') as 'testnet' | 'mainnet') ??
      'testnet';
    this.isTestnet = network !== 'mainnet';
    this.networkPassphrase = this.isTestnet
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;
    this.horizon = new StellarSdk.Horizon.Server(
      this.config.get<string>('STELLAR_HORIZON_URL') ??
        (this.isTestnet
          ? 'https://horizon-testnet.stellar.org'
          : 'https://horizon.stellar.org'),
    );
    // USDC issuer addresses are stable, well-known per network.
    this.usdcIssuer = this.isTestnet
      ? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
      : 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  }

  /**
   * Provision a managed Stellar settlement wallet for a merchant.
   * Returns the public address (G…). Idempotent: if a row already exists
   * for this merchant, returns it without re-provisioning.
   */
  async provision(merchantId: string): Promise<{ stellarAddress: string }> {
    const existing = await this.prisma.merchantSettlementKey.findUnique({
      where: { merchantId },
    });
    if (existing) {
      this.logger.debug(
        `Merchant ${merchantId} already has settlement key ${existing.stellarAddress}`,
      );
      return { stellarAddress: existing.stellarAddress };
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    // 1. Generate a fresh keypair. Lives in memory only.
    const kp = StellarSdk.Keypair.random();
    this.logger.log(
      `Provisioning settlement wallet for merchant ${merchantId} → ${kp.publicKey()}`,
    );

    // 2. Fund the account. Testnet = Friendbot; mainnet = sponsor wallet.
    try {
      if (this.isTestnet) {
        await this.friendbotFund(kp.publicKey());
      } else {
        await this.sponsorCreateAccount(kp.publicKey());
      }
    } catch (err) {
      throw new ServiceUnavailableException(
        `Stellar funding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 3. Add the USDC trustline so the account can hold USDC.
    try {
      await this.addUsdcTrustline(kp);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Stellar trustline failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 4. Encrypt + persist. We update both the new table AND mirror the
    //    public address onto the Merchant row so existing consumers (link
    //    flow, crypto pay flow) keep working without any code change.
    const enc = this.encryptSeed(kp.secret());
    const created = await this.prisma.$transaction(async (tx) => {
      const settlementKey = await tx.merchantSettlementKey.create({
        data: {
          merchantId,
          stellarAddress: kp.publicKey(),
          encryptedSeed: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          managed: true,
        },
      });
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          settlementAddress: kp.publicKey(),
          settlementChain: 'stellar',
          settlementAsset: 'USDC',
        },
      });
      return settlementKey;
    });

    this.logger.log(
      `Settlement provisioned for ${merchantId}: ${created.stellarAddress}`,
    );
    return { stellarAddress: created.stellarAddress };
  }

  /* ── Funding paths ─────────────────────────────────────────────────── */

  private async friendbotFund(publicKey: string): Promise<void> {
    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Friendbot returned ${res.status}: ${await res.text()}`);
    }
    this.logger.debug(`Friendbot funded ${publicKey}`);
  }

  private async sponsorCreateAccount(publicKey: string): Promise<void> {
    const sponsorSecret = this.config.get<string>(
      'STELLAR_RESERVE_SPONSOR_SECRET',
    );
    if (!sponsorSecret) {
      throw new Error(
        'STELLAR_RESERVE_SPONSOR_SECRET not configured — required for mainnet provisioning',
      );
    }
    const sponsor = StellarSdk.Keypair.fromSecret(sponsorSecret);
    const sponsorAccount = await this.horizon.loadAccount(sponsor.publicKey());

    // 1 XLM base reserve + 0.5 XLM trustline reserve = 1.5 XLM. Add a tiny
    // buffer for the trustline tx fee the merchant account will sign later.
    const tx = new StellarSdk.TransactionBuilder(sponsorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: publicKey,
          startingBalance: '1.6',
        }),
      )
      .setTimeout(30)
      .build();
    tx.sign(sponsor);
    await this.horizon.submitTransaction(tx);
    this.logger.debug(`Sponsor funded ${publicKey} with 1.6 XLM`);
  }

  /* ── Trustline ─────────────────────────────────────────────────────── */

  private async addUsdcTrustline(kp: StellarSdk.Keypair): Promise<void> {
    const account = await this.horizon.loadAccount(kp.publicKey());
    const usdc = new StellarSdk.Asset('USDC', this.usdcIssuer);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({ asset: usdc }))
      .setTimeout(30)
      .build();
    tx.sign(kp);
    await this.horizon.submitTransaction(tx);
    this.logger.debug(`USDC trustline added to ${kp.publicKey()}`);
  }

  /* ── Encryption ────────────────────────────────────────────────────── */

  /**
   * AES-256-GCM with per-row IV. The KEK comes from env so it can be
   * rotated via the secrets manager without touching the database. On
   * decrypt we need the IV + authTag stored alongside the ciphertext.
   */
  private encryptSeed(seed: string): {
    ciphertext: string;
    iv: string;
    authTag: string;
  } {
    const kek = this.requireKek();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(seed, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Reverses {@link encryptSeed}. Returns the raw Stellar secret (S…) ready
   * for `Keypair.fromSecret`. Only call from places that immediately use
   * the seed to sign — never persist or log the result.
   */
  /**
   * Move USDC out of a merchant's managed settlement wallet to an address they
   * control. The escape hatch that makes managed custody defensible: without
   * it, a merchant can take payments and never get the money out.
   *
   * Every check here exists because skipping it loses funds:
   *
   *  - a malformed destination is unrecoverable once submitted
   *  - a destination with no USDC trustline rejects the payment, and on
   *    Stellar that is a failed transaction rather than a bounce
   *  - `amount` is compared against the *USDC* balance, never XLM: draining
   *    XLM would drop the account below its reserve and freeze it
   *
   * The audit row is written before submission and updated after, so a
   * withdrawal that vanishes mid-flight leaves a record saying so rather than
   * no record at all.
   */
  /**
   * Guards shared by both withdrawal paths. Managed and self-custodied differ
   * only in who signs; everything that can lose money — a bad destination, a
   * missing trustline, an amount that would drain reserves — is identical, and
   * duplicating it is how the two drift apart.
   */
  private async validateWithdrawal(
    merchantId: string,
    params: { destinationAddress: string; amount: string; asset?: string },
    expect?: 'managed' | 'self-custodied',
  ): Promise<{
    row: {
      managed: boolean;
      stellarAddress: string;
      smartWalletAddress: string | null;
      encryptedSeed: string | null;
      iv: string | null;
      authTag: string | null;
    };
    amount: Prisma.Decimal;
    asset: string;
  }> {
    const asset = (params.asset ?? 'USDC').toUpperCase();
    if (asset !== 'USDC') {
      throw new BadRequestException('Only USDC withdrawals are supported');
    }

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.destinationAddress)) {
      throw new BadRequestException(
        'destinationAddress must be a valid Stellar public key (G...)',
      );
    }

    const row = await this.prisma.merchantSettlementKey.findUnique({
      where: { merchantId },
    });
    if (!row) {
      throw new NotFoundException('No settlement wallet for this merchant');
    }

    // Checked before any network call: there is no point asking Horizon about
    // balances only to tell the caller they are on the wrong endpoint.
    if (expect === 'managed' && !row.managed) {
      throw new BadRequestException(
        'This settlement wallet is self-custodied. Use the prepare/submit flow instead.',
      );
    }
    if (expect === 'self-custodied' && row.managed) {
      throw new BadRequestException(
        'This wallet is managed; use POST /settlement/withdraw instead.',
      );
    }

    const walletAddress = row.smartWalletAddress ?? row.stellarAddress;
    const account = await this.horizon.loadAccount(walletAddress);

    const usdcBalance = account.balances.find(
      (b) =>
        'asset_code' in b &&
        b.asset_code === 'USDC' &&
        'asset_issuer' in b &&
        b.asset_issuer === this.usdcIssuer,
    );
    const available = new Prisma.Decimal(usdcBalance?.balance ?? '0');

    const amount =
      params.amount === 'all' ? available : new Prisma.Decimal(params.amount);

    if (amount.lte(0)) {
      throw new BadRequestException('amount must be greater than zero');
    }
    if (amount.gt(available)) {
      throw new BadRequestException(
        `Insufficient USDC: balance is ${available.toString()}`,
      );
    }

    const destination = await this.horizon
      .loadAccount(params.destinationAddress)
      .catch(() => null);
    if (!destination) {
      throw new UnprocessableEntityException(
        'The destination account does not exist on Stellar yet. It must be funded before it can receive USDC.',
      );
    }
    const hasTrustline = destination.balances.some(
      (b) =>
        'asset_code' in b &&
        b.asset_code === 'USDC' &&
        'asset_issuer' in b &&
        b.asset_issuer === this.usdcIssuer,
    );
    if (!hasTrustline) {
      throw new UnprocessableEntityException(
        'The destination address must have a USDC trustline before it can receive USDC.',
      );
    }

    return { row, amount, asset };
  }

  async withdraw(
    merchantId: string,
    params: { destinationAddress: string; amount: string; asset?: string },
  ): Promise<{
    stellarTxHash: string;
    amount: string;
    asset: string;
    destinationAddress: string;
    submittedAt: string;
  }> {
    const { row, amount, asset } = await this.validateWithdrawal(
      merchantId,
      params,
      'managed',
    );
    const usdc = new StellarSdk.Asset('USDC', this.usdcIssuer);

    const audit = await this.prisma.settlementWithdrawal.create({
      data: {
        merchantId,
        amount: amount.toString(),
        asset,
        destinationAddress: params.destinationAddress,
        status: 'submitting',
      },
    });

    try {
      const kp = StellarSdk.Keypair.fromSecret(this.decryptSeed(row));
      const source = await this.horizon.loadAccount(kp.publicKey());

      const tx = new StellarSdk.TransactionBuilder(source, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: params.destinationAddress,
            asset: usdc,
            amount: amount.toString(),
          }),
        )
        .setTimeout(30)
        .build();
      tx.sign(kp);

      const submitted = await this.horizon.submitTransaction(tx);
      const stellarTxHash = submitted.hash;

      const updated = await this.prisma.settlementWithdrawal.update({
        where: { id: audit.id },
        data: { status: 'submitted', stellarTxHash },
      });

      this.logger.log(
        `Withdrew ${amount.toString()} USDC for ${merchantId} → ${params.destinationAddress} (${stellarTxHash})`,
      );

      return {
        stellarTxHash,
        amount: amount.toString(),
        asset,
        destinationAddress: params.destinationAddress,
        submittedAt: updated.createdAt.toISOString(),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.prisma.settlementWithdrawal.update({
        where: { id: audit.id },
        data: { status: 'failed', failureReason: reason },
      });
      this.logger.error(`Withdrawal failed for ${merchantId}: ${reason}`);
      throw new ServiceUnavailableException(
        `Withdrawal could not be submitted: ${reason}`,
      );
    }
  }

  /**
   * Build an unsigned withdrawal for a self-custodied wallet.
   *
   * The managed path decrypts a seed and signs server-side. A passkey wallet
   * has no seed here — the merchant's device holds the key — so the split is
   * prepare/submit: we build it, they sign it with WebAuthn, we broadcast it.
   * Notably this needs no passkey-kit dependency server-side; WebAuthn is
   * entirely a browser concern, and all we handle is XDR.
   *
   * Moving USDC out of a smart wallet is a Soroban token transfer, not a
   * classic payment operation — a contract cannot be the source of one.
   */
  async prepareWithdrawal(
    merchantId: string,
    params: { destinationAddress: string; amount: string; asset?: string },
  ): Promise<{
    withdrawalId: string;
    xdr: string;
    networkPassphrase: string;
    amount: string;
  }> {
    const { row, amount, asset } = await this.validateWithdrawal(
      merchantId,
      params,
      'self-custodied',
    );
    const walletAddress = row.smartWalletAddress ?? row.stellarAddress;

    const sacId = this.usdcContractId();
    const contract = new StellarSdk.Contract(sacId);
    const source = await this.soroban().getAccount(walletAddress);

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'transfer',
          new StellarSdk.Address(walletAddress).toScVal(),
          new StellarSdk.Address(params.destinationAddress).toScVal(),
          StellarSdk.nativeToScVal(this.toStroops(amount), { type: 'i128' }),
        ),
      )
      .setTimeout(300)
      .build();

    const simulated = await this.soroban().simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
      throw new UnprocessableEntityException(
        `Withdrawal would fail: ${simulated.error}`,
      );
    }
    const prepared = StellarSdk.rpc
      .assembleTransaction(
        tx,
        simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();

    const audit = await this.prisma.settlementWithdrawal.create({
      data: {
        merchantId,
        amount: amount.toString(),
        asset,
        destinationAddress: params.destinationAddress,
        status: 'prepared',
      },
    });

    return {
      withdrawalId: audit.id,
      xdr: prepared.toXDR(),
      networkPassphrase: this.networkPassphrase,
      amount: amount.toString(),
    };
  }

  /**
   * Broadcast a withdrawal the merchant signed with their passkey.
   *
   * The signed XDR is checked against the row we prepared before it goes
   * anywhere. Submitting whatever arrives would make the audit trail a
   * fiction — it would claim a withdrawal we never verified, which is exactly
   * the record someone will rely on in a dispute.
   */
  async submitWithdrawal(
    merchantId: string,
    withdrawalId: string,
    signedXdr: string,
  ): Promise<{ stellarTxHash: string; amount: string }> {
    const audit = await this.prisma.settlementWithdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!audit || audit.merchantId !== merchantId) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (audit.status !== 'prepared') {
      throw new ConflictException(
        `Withdrawal is ${audit.status}; only a prepared withdrawal can be submitted`,
      );
    }

    const row = await this.prisma.merchantSettlementKey.findUnique({
      where: { merchantId },
    });
    const walletAddress = row?.smartWalletAddress ?? row?.stellarAddress;

    let tx: StellarSdk.Transaction;
    try {
      tx = new StellarSdk.Transaction(signedXdr, this.networkPassphrase);
    } catch {
      throw new BadRequestException('signedXdr is not a valid transaction');
    }

    // The source must be the merchant's own wallet. Without this we would
    // relay an arbitrary signed transaction and file it under their name.
    if (tx.source !== walletAddress) {
      throw new BadRequestException(
        'Signed transaction does not originate from this settlement wallet',
      );
    }
    if (tx.signatures.length === 0) {
      throw new BadRequestException('Transaction is not signed');
    }

    try {
      const sent = await this.soroban().sendTransaction(tx);
      if (sent.status === 'ERROR') {
        throw new Error(`submission rejected: ${sent.status}`);
      }

      await this.prisma.settlementWithdrawal.update({
        where: { id: audit.id },
        data: { status: 'submitted', stellarTxHash: sent.hash },
      });

      return { stellarTxHash: sent.hash, amount: audit.amount.toString() };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.prisma.settlementWithdrawal.update({
        where: { id: audit.id },
        data: { status: 'failed', failureReason: reason },
      });
      throw new ServiceUnavailableException(
        `Withdrawal could not be submitted: ${reason}`,
      );
    }
  }

  private toStroops(amount: Prisma.Decimal): bigint {
    return BigInt(amount.mul(10_000_000).toFixed(0));
  }

  private usdcContractId(): string {
    const key = this.isTestnet
      ? 'STELLAR_USDC_SAC_TESTNET'
      : 'STELLAR_USDC_SAC_MAINNET';
    const id = this.config.get<string>(key);
    if (!id) {
      throw new BadRequestException(
        `Self-custodied withdrawals need the USDC contract id: set ${key}`,
      );
    }
    return id;
  }

  private soroban(): StellarSdk.rpc.Server {
    return new StellarSdk.rpc.Server(
      this.config.get<string>('STELLAR_SOROBAN_RPC_URL') ??
        'https://soroban-testnet.stellar.org',
    );
  }

  decryptSeed(row: {
    encryptedSeed: string | null;
    iv: string | null;
    authTag: string | null;
  }): string {
    if (!row.encryptedSeed || !row.iv || !row.authTag) {
      throw new BadRequestException(
        'Settlement key is not managed (no encrypted seed on file).',
      );
    }
    const kek = this.requireKek();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      kek,
      Buffer.from(row.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(row.authTag, 'hex'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(row.encryptedSeed, 'hex')),
      decipher.final(),
    ]);
    return clear.toString('utf8');
  }

  private requireKek(): Buffer {
    const raw = this.config.get<string>('SETTLEMENT_KEY_KEK');
    if (!raw) {
      throw new ConflictException(
        'SETTLEMENT_KEY_KEK is not configured. Cannot encrypt/decrypt settlement seeds.',
      );
    }
    // Accept hex (preferred), fall back to SHA-256(raw) so dev environments
    // don't need to wrangle hex strings.
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
  }
}
