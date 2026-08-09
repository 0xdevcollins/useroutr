import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Client for the Soroban escrow contract (`contract/soroban/contracts/escrow`).
 *
 * The contract holds a settled payment for a dispute window, after which the
 * merchant is paid — by the arbiter calling `release`, or by anyone calling
 * `auto_release` once the window closes. A payer who objects calls `dispute`
 * inside the window, which freezes the escrow until the arbiter `resolve`s it,
 * or until anyone calls `expire_dispute` 14 days later.
 *
 * Two constraints from the contract shape the caller's job here:
 *
 *  - `lock` pulls funds from `payer` and requires that account's signature, so
 *    the money must already be in an account we can sign for before we call it.
 *  - payer, merchant and arbiter must all be distinct. An arbiter that is also
 *    a beneficiary can rule in its own favour, so the contract rejects it.
 *
 * That is why funds transit a dedicated holding account rather than being
 * locked straight out of the merchant's settlement wallet: the merchant cannot
 * be both `payer` and `merchant`.
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  private readonly sorobanServer: StellarSdk.rpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly relayKeypair: StellarSdk.Keypair | null;
  private readonly holdingKeypair: StellarSdk.Keypair | null;

  constructor() {
    const network = process.env.STELLAR_NETWORK || 'testnet';
    this.networkPassphrase =
      network === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    this.sorobanServer = new StellarSdk.rpc.Server(
      process.env.STELLAR_SOROBAN_RPC_URL ||
        'https://soroban-testnet.stellar.org',
    );

    this.contractId = process.env.SOROBAN_ESCROW_CONTRACT_ID || '';

    // The relay is the arbiter — the only party that can release or resolve.
    this.relayKeypair = process.env.STELLAR_RELAY_KEYPAIR_SECRET
      ? StellarSdk.Keypair.fromSecret(process.env.STELLAR_RELAY_KEYPAIR_SECRET)
      : null;

    // Distinct from the relay so the contract's payer != arbiter check passes.
    this.holdingKeypair = process.env.STELLAR_ESCROW_HOLDING_SECRET
      ? StellarSdk.Keypair.fromSecret(process.env.STELLAR_ESCROW_HOLDING_SECRET)
      : null;
  }

  /** Whether escrow can actually be used, rather than merely switched on. */
  isConfigured(): boolean {
    return Boolean(this.contractId && this.relayKeypair && this.holdingKeypair);
  }

  get holdingAddress(): string | null {
    return this.holdingKeypair?.publicKey() ?? null;
  }

  get arbiterAddress(): string | null {
    return this.relayKeypair?.publicKey() ?? null;
  }

  /**
   * Lock a settled payment. Returns the contract's escrow id as hex.
   *
   * `paymentId` is passed through to the contract, which derives the escrow id
   * from it together with the two party addresses — so the same payment cannot
   * be locked twice, and a retried call fails loudly rather than double-locking.
   */
  async lock(params: {
    merchantAddress: string;
    token: string;
    amount: bigint;
    paymentId: string;
    releaseAt: Date;
  }): Promise<string> {
    this.assertConfigured();

    const holding = this.holdingKeypair as StellarSdk.Keypair;
    const arbiter = this.relayKeypair as StellarSdk.Keypair;

    const args = [
      new StellarSdk.Address(holding.publicKey()).toScVal(),
      new StellarSdk.Address(params.merchantAddress).toScVal(),
      new StellarSdk.Address(arbiter.publicKey()).toScVal(),
      new StellarSdk.Address(params.token).toScVal(),
      StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(Buffer.from(params.paymentId, 'utf8'), {
        type: 'bytes',
      }),
      StellarSdk.nativeToScVal(
        BigInt(Math.floor(params.releaseAt.getTime() / 1000)),
        { type: 'u64' },
      ),
    ];

    // Signed by the holding account: `lock` calls payer.require_auth().
    const result = await this.invoke('lock', args, holding);
    const returned = (
      result as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse
    ).returnValue;
    if (!returned) {
      throw new Error('escrow lock returned no escrow id');
    }

    const escrowId = StellarSdk.scValToNative(returned) as Buffer;
    return Buffer.from(escrowId).toString('hex');
  }

  /**
   * Build an unsigned `lock` transaction for the payer to sign themselves.
   *
   * This is the shape that makes the contract's guarantee real. When the payer
   * is the one who signs, their own address is recorded as the escrow's
   * `payer` — so a dispute resolved in their favour pays *them*, not us. Locking
   * with our holding account as payer (the only option for a CCTP payer, who
   * has no Stellar account) means a "refund" lands back with Useroutr and the
   * rest is a promise.
   *
   * Returned as XDR because we cannot sign for the payer and should not want
   * to: the whole point is that moving their money requires their key.
   */
  async buildLockTransaction(params: {
    payerAddress: string;
    merchantAddress: string;
    token: string;
    amount: bigint;
    paymentId: string;
    releaseAt: Date;
  }): Promise<{ xdr: string; networkPassphrase: string }> {
    this.assertConfigured();
    const arbiter = this.relayKeypair as StellarSdk.Keypair;

    if (
      params.payerAddress === params.merchantAddress ||
      params.payerAddress === arbiter.publicKey()
    ) {
      // The contract rejects these, but failing here costs a round trip
      // instead of a reverted transaction the payer has already signed.
      throw new Error(
        'payer must differ from both the merchant and the arbiter',
      );
    }

    const contract = new StellarSdk.Contract(this.contractId);
    const source = await this.sorobanServer.getAccount(params.payerAddress);

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'lock',
          new StellarSdk.Address(params.payerAddress).toScVal(),
          new StellarSdk.Address(params.merchantAddress).toScVal(),
          new StellarSdk.Address(arbiter.publicKey()).toScVal(),
          new StellarSdk.Address(params.token).toScVal(),
          StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
          StellarSdk.nativeToScVal(Buffer.from(params.paymentId, 'utf8'), {
            type: 'bytes',
          }),
          StellarSdk.nativeToScVal(
            BigInt(Math.floor(params.releaseAt.getTime() / 1000)),
            { type: 'u64' },
          ),
        ),
      )
      .setTimeout(300)
      .build();

    // Simulating server-side means the payer's wallet is handed a transaction
    // with footprint and resource fees already attached, and a lock that would
    // revert — a duplicate payment, a paused contract — fails here rather than
    // after they have approved it.
    const simulated = await this.sorobanServer.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
      throw new Error(`escrow lock would fail: ${simulated.error}`);
    }

    const prepared = StellarSdk.rpc
      .assembleTransaction(
        tx,
        simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();

    return {
      xdr: prepared.toXDR(),
      networkPassphrase: this.networkPassphrase,
    };
  }

  /** Arbiter releases the full amount to the merchant. */
  async release(escrowId: string): Promise<void> {
    this.assertConfigured();
    await this.invoke(
      'release',
      [this.escrowIdArg(escrowId)],
      this.relayKeypair as StellarSdk.Keypair,
    );
  }

  /**
   * Permissionless once the window closes — we call it so merchants do not have
   * to, but the contract does not require it to be us.
   */
  async autoRelease(escrowId: string): Promise<void> {
    this.assertConfigured();
    await this.invoke(
      'auto_release',
      [this.escrowIdArg(escrowId)],
      this.relayKeypair as StellarSdk.Keypair,
    );
  }

  /** Arbiter splits the escrow. `payerBps + merchantBps` must be 10_000. */
  async resolve(
    escrowId: string,
    payerBps: number,
    merchantBps: number,
  ): Promise<void> {
    this.assertConfigured();
    if (payerBps + merchantBps !== 10_000) {
      throw new Error('payerBps + merchantBps must equal 10000');
    }
    await this.invoke(
      'resolve',
      [
        this.escrowIdArg(escrowId),
        StellarSdk.nativeToScVal(payerBps, { type: 'u32' }),
        StellarSdk.nativeToScVal(merchantBps, { type: 'u32' }),
      ],
      this.relayKeypair as StellarSdk.Keypair,
    );
  }

  /**
   * The escrow id the contract will derive for these parties.
   *
   * Same derivation `lock` uses, exposed by the contract so it can be known
   * before the escrow exists — which is what lets us record the id when we
   * build the transaction rather than having to find it afterwards.
   */
  async computeEscrowId(params: {
    paymentId: string;
    payerAddress: string;
    merchantAddress: string;
  }): Promise<string> {
    this.assertConfigured();
    const result = await this.invoke(
      'compute_escrow_id',
      [
        StellarSdk.nativeToScVal(Buffer.from(params.paymentId, 'utf8'), {
          type: 'bytes',
        }),
        new StellarSdk.Address(params.payerAddress).toScVal(),
        new StellarSdk.Address(params.merchantAddress).toScVal(),
      ],
      this.relayKeypair as StellarSdk.Keypair,
      { simulateOnly: true },
    );

    const raw = StellarSdk.scValToNative(
      (result as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse)
        .returnValue as StellarSdk.xdr.ScVal,
    ) as Buffer;
    return Buffer.from(raw).toString('hex');
  }

  /** Read the on-chain entry. The chain is authoritative over our mirror. */
  async getEscrow(escrowId: string): Promise<{
    state: string;
    amount: bigint;
    releaseAt: bigint;
    disputedAt: bigint;
    payer: string;
    merchant: string;
  }> {
    this.assertConfigured();
    const result = await this.invoke(
      'get_escrow',
      [this.escrowIdArg(escrowId)],
      this.relayKeypair as StellarSdk.Keypair,
      { simulateOnly: true },
    );

    const entry = StellarSdk.scValToNative(
      (result as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse)
        .returnValue as StellarSdk.xdr.ScVal,
    ) as Record<string, unknown>;

    return {
      state: String(entry.state),
      amount: BigInt(entry.amount as string | number | bigint),
      releaseAt: BigInt(entry.release_at as string | number | bigint),
      disputedAt: BigInt(entry.disputed_at as string | number | bigint),
      payer: String(entry.payer),
      merchant: String(entry.merchant),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private assertConfigured(): void {
    if (this.isConfigured()) return;
    const missing = [
      !this.contractId && 'SOROBAN_ESCROW_CONTRACT_ID',
      !this.relayKeypair && 'STELLAR_RELAY_KEYPAIR_SECRET',
      !this.holdingKeypair && 'STELLAR_ESCROW_HOLDING_SECRET',
    ].filter(Boolean);
    throw new Error(`escrow is not configured: missing ${missing.join(', ')}`);
  }

  private escrowIdArg(escrowId: string): StellarSdk.xdr.ScVal {
    return StellarSdk.nativeToScVal(Buffer.from(escrowId, 'hex'), {
      type: 'bytes',
    });
  }

  /**
   * build → simulate → sign → submit → poll. Mirrors StellarService's private
   * helper; kept here so escrow can sign as the holding account, which that one
   * cannot do.
   */
  private async invoke(
    method: string,
    args: StellarSdk.xdr.ScVal[],
    signer: StellarSdk.Keypair,
    opts?: { simulateOnly?: boolean },
  ): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
    const contract = new StellarSdk.Contract(this.contractId);
    const sourceAccount = await this.sorobanServer.getAccount(
      signer.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simulated = await this.sorobanServer.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
      throw new Error(`escrow.${method} simulation failed: ${simulated.error}`);
    }

    // Reads do not need a transaction on the ledger; returning the simulation
    // keeps `get_escrow` free and instant.
    if (opts?.simulateOnly) {
      return {
        status: StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: (
          simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse
        ).result?.retval,
      } as StellarSdk.rpc.Api.GetTransactionResponse;
    }

    const prepared = StellarSdk.rpc
      .assembleTransaction(
        tx,
        simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();
    prepared.sign(signer);

    const sent = await this.sorobanServer.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new Error(`escrow.${method} send failed`);
    }

    let result = await this.sorobanServer.getTransaction(sent.hash);
    while (
      result.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.sorobanServer.getTransaction(sent.hash);
    }
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`escrow.${method} failed on-chain: ${sent.hash}`);
    }

    this.logger.log(`escrow.${method} ok — ${sent.hash}`);
    return result;
  }
}
