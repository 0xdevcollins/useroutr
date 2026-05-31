import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
      (this.config.get<string>('STELLAR_NETWORK') as
        | 'testnet'
        | 'mainnet') ?? 'testnet';
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
    const ciphertext = Buffer.concat([cipher.update(seed, 'utf8'), cipher.final()]);
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
