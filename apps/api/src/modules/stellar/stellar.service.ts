import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Prisma } from '@prisma/client';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface PathPaymentPath {
  sourceAsset: {
    native?: boolean;
    code?: string;
    issuer?: string;
  };
  destinationAsset: {
    native?: boolean;
    code?: string;
    issuer?: string;
  };
  path: Array<{
    native?: boolean;
    code?: string;
    issuer?: string;
  }>;
  destinationAmount: string;
}

interface StrictSendPathResult {
  paths: PathPaymentPath[];
  destinationAmount: string;
}

// ── Service ──────────────────────────────────────────────────────────────────
//
// Post-CCTP-V2 surface: account ops, Horizon path payments, and the Soroban
// fee-collector contract. The HTLC + settlement Soroban methods were removed
// in the CCTP V2 cutover — bridging now flows through Circle's burn/mint, and
// the merchant-side fee deduction is the only remaining Soroban touchpoint.

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);

  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly sorobanServer: StellarSdk.rpc.Server;
  private readonly relayKeypair: StellarSdk.Keypair | null;
  private readonly networkPassphrase: string;

  private readonly feeCollectorContractId: string;

  constructor() {
    const network =
      (process.env.STELLAR_NETWORK as 'testnet' | 'mainnet') || 'testnet';
    const isMainnet = network === 'mainnet';

    this.networkPassphrase = isMainnet
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;

    this.horizonServer = new StellarSdk.Horizon.Server(
      process.env.STELLAR_HORIZON_URL ||
        (isMainnet
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org'),
    );

    this.sorobanServer = new StellarSdk.rpc.Server(
      process.env.STELLAR_SOROBAN_RPC_URL ||
        'https://soroban-testnet.stellar.org',
    );

    const secret = process.env.STELLAR_RELAY_KEYPAIR_SECRET;
    this.relayKeypair = secret ? StellarSdk.Keypair.fromSecret(secret) : null;

    this.feeCollectorContractId =
      process.env.SOROBAN_FEE_COLLECTOR_CONTRACT_ID || '';
  }

  // ── Account management ─────────────────────────────────────────────────────

  createAccount(): { publicKey: string; secret: string } {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secret: keypair.secret(),
    };
  }

  async getAccount(
    publicKey: string,
  ): Promise<StellarSdk.Horizon.AccountResponse> {
    return await this.horizonServer.loadAccount(publicKey);
  }

  async fundTestnetAccount(publicKey: string): Promise<void> {
    if (this.networkPassphrase !== (StellarSdk.Networks.TESTNET as string)) {
      throw new BadRequestException('Friendbot is only available on testnet');
    }
    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
    await fetch(url);
    this.logger.log(`Funded testnet account ${publicKey}`);
  }

  // ── Path payments ──────────────────────────────────────────────────────────

  async findStrictSendPaths(params: {
    sourceAsset: string;
    sourceAmount: string;
    destinationAssets: string[];
    destinationAccount?: string;
  }): Promise<StrictSendPathResult> {
    try {
      this.logger.debug(
        `Finding strict send paths for ${params.sourceAmount} ${params.sourceAsset}`,
      );

      const sourceAsset = this.parseAsset(params.sourceAsset);
      const destAssets = params.destinationAssets.map((a) =>
        this.parseAsset(a),
      );

      const response = await this.horizonServer
        .strictSendPaths(sourceAsset, params.sourceAmount, destAssets)
        .call();

      if (!response.records || response.records.length === 0) {
        throw new BadRequestException(
          `No liquidity found for ${params.sourceAmount} ${params.sourceAsset}`,
        );
      }

      const paths = this.mapPathRecords(response.records);
      const bestPath = paths[0];
      this.logger.debug(
        `Found ${paths.length} paths, best destination amount: ${bestPath.destinationAmount}`,
      );

      return { paths, destinationAmount: bestPath.destinationAmount };
    } catch (error) {
      this.logger.error('Error finding strict send paths:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Failed to find path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findStrictReceivePaths(params: {
    sourceAssets: string[];
    destinationAsset: string;
    destinationAmount: string;
  }): Promise<StrictSendPathResult> {
    try {
      const srcAssets = params.sourceAssets.map((a) => this.parseAsset(a));
      const destAsset = this.parseAsset(params.destinationAsset);

      const response = await this.horizonServer
        .strictReceivePaths(srcAssets, destAsset, params.destinationAmount)
        .call();

      if (!response.records || response.records.length === 0) {
        throw new BadRequestException(
          `No liquidity found for ${params.destinationAmount} ${params.destinationAsset}`,
        );
      }

      const paths = this.mapPathRecords(response.records);
      return { paths, destinationAmount: paths[0].destinationAmount };
    } catch (error) {
      this.logger.error('Error finding strict receive paths:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Failed to find path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async executePathPayment(params: {
    sourceAsset: string;
    sourceAmount: string;
    destinationAsset: string;
    destinationMinAmount: string;
    destinationAccount: string;
    path: string[];
    sourceSecret?: string;
  }): Promise<string> {
    this.logger.log('Executing Stellar path payment');

    const keypair = this.requireKeypair(params.sourceSecret);
    const account = await this.horizonServer.loadAccount(keypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: this.parseAsset(params.sourceAsset),
          sendAmount: params.sourceAmount,
          destination: params.destinationAccount,
          destAsset: this.parseAsset(params.destinationAsset),
          destMin: params.destinationMinAmount,
          path: params.path.map((a) => this.parseAsset(a)),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await this.horizonServer.submitTransaction(tx);
    return result.hash;
  }

  /**
   * Direct payment for same-asset transfers (e.g. XLM → XLM). A path payment
   * requires a conversion route through the DEX; Horizon rejects a strict-send
   * path query when the source and destination asset are identical, so those
   * transfers must use a plain payment operation instead.
   */
  async sendPayment(params: {
    asset: string;
    amount: string;
    destinationAccount: string;
    sourceSecret?: string;
  }): Promise<string> {
    this.logger.log('Executing Stellar direct payment');

    const keypair = this.requireKeypair(params.sourceSecret);
    const account = await this.horizonServer.loadAccount(keypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: params.destinationAccount,
          asset: this.parseAsset(params.asset),
          amount: params.amount,
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await this.horizonServer.submitTransaction(tx);
    return result.hash;
  }

  // ── Fee collector ──────────────────────────────────────────────────────────
  //
  // Soroban fee-collector deducts the platform fee from the gross amount and
  // returns (merchant_amount, fee_amount). Called after CCTP V2 mints USDC on
  // Stellar so the merchant only ever sees their net amount.

  async deductFee(
    token: string,
    grossAmount: bigint,
    merchant: string,
  ): Promise<{ merchantAmount: bigint; feeAmount: bigint }> {
    this.logger.log(`Deducting fee for ${grossAmount} units of ${token}`);

    const args = [
      new StellarSdk.Address(token).toScVal(),
      StellarSdk.nativeToScVal(grossAmount, { type: 'i128' }),
      new StellarSdk.Address(merchant).toScVal(),
    ];

    const result = await this.invokeSorobanContract(
      this.feeCollectorContractId,
      'deduct',
      args,
    );

    const success =
      result as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse;
    if (!success.returnValue) {
      throw new Error('Fee deduction returned no value');
    }

    const [merchantAmount, feeAmount] = StellarSdk.scValToNative(
      success.returnValue,
    ) as [bigint, bigint];

    return { merchantAmount, feeAmount };
  }

  /**
   * Verify that a transaction on the ledger really paid us what a client
   * claims it did.
   *
   * The client supplies only the hash — where to look. Success, destination,
   * asset and amount all come from Horizon, so an invented hash, a pointer at
   * an unrelated transaction, or an underpayment are all rejected rather than
   * taken on trust.
   */
  async verifyIncomingPayment(params: {
    txHash: string;
    destination: string;
    minAmount: string;
    assetCode: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    // A Soroban contract cannot receive a classic payment operation. Paying a
    // smart-wallet merchant emits a token-contract `transfer` event instead,
    // and looking for operations would find nothing — rejecting a payment
    // that actually arrived. Failing closed on real money is the worst
    // direction for this check to be wrong in.
    if (/^C[A-Z2-7]{55}$/.test(params.destination)) {
      return this.verifyContractPayment(params);
    }

    let operations: StellarSdk.Horizon.ServerApi.OperationRecord[];
    try {
      const tx = await this.horizonServer
        .transactions()
        .transaction(params.txHash)
        .call();

      // A transaction can be included in a ledger and still have failed.
      if (!tx.successful) {
        return { ok: false, reason: 'transaction failed on-chain' };
      }

      const ops = await this.horizonServer
        .operations()
        .forTransaction(params.txHash)
        .limit(200)
        .call();
      operations = ops.records;
    } catch {
      // Covers both "no such transaction" and Horizon being unreachable. We
      // cannot tell them apart from the client's side, and treating an
      // unverifiable payment as unverified is the safe direction.
      return { ok: false, reason: 'transaction not found on the ledger' };
    }

    const required = Number(params.minAmount);

    // Sum every payment leg to this destination in the transaction: a wallet
    // may legitimately split one transfer across operations, and requiring a
    // single matching op would reject a valid payment.
    // Horizon types `op.type` as an enum, so it is widened to a string once
    // rather than compared against literals eight times.
    type PaymentLeg = {
      type: string;
      to?: string;
      asset_code?: string;
      amount?: string;
    };
    const PAID_TYPES = ['payment', 'path_payment_strict_receive'];

    const paid = (operations as unknown as PaymentLeg[])
      .filter(
        (op) =>
          PAID_TYPES.includes(String(op.type)) &&
          op.to === params.destination &&
          op.asset_code === params.assetCode,
      )
      .reduce((sum, op) => sum + Number(op.amount ?? 0), 0);

    if (paid <= 0) {
      return {
        ok: false,
        reason: `no ${params.assetCode} payment to ${params.destination} in this transaction`,
      };
    }
    // Tolerate a rounding hair below the expected amount, not a real shortfall.
    if (paid + 1e-7 < required) {
      return {
        ok: false,
        reason: `paid ${paid} ${params.assetCode}, expected at least ${required}`,
      };
    }

    return { ok: true };
  }

  /**
   * Verify a transfer into a Soroban contract address by reading the
   * transaction's events.
   *
   * The Stellar Asset Contract emits `transfer` with topics
   * [symbol "transfer", from, to, asset] and the amount as data. Amounts are
   * in stroops here, unlike the decimal strings Horizon reports, so the
   * comparison converts rather than trusting them to look alike.
   */
  private async verifyContractPayment(params: {
    txHash: string;
    destination: string;
    minAmount: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    let tx: StellarSdk.rpc.Api.GetTransactionResponse;
    try {
      tx = await this.sorobanServer.getTransaction(params.txHash);
    } catch {
      return { ok: false, reason: 'transaction not found on the ledger' };
    }

    if (tx.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      return { ok: false, reason: `transaction status is ${tx.status}` };
    }

    const events =
      (
        tx as unknown as {
          resultMetaXdr?: {
            v3?: () => {
              sorobanMeta?: () => { events?: () => unknown[] } | null;
            };
          };
        }
      ).resultMetaXdr
        ?.v3?.()
        ?.sorobanMeta?.()
        ?.events?.() ?? [];

    const required = BigInt(
      new Prisma.Decimal(params.minAmount).mul(10_000_000).toFixed(0),
    );

    let received = 0n;
    for (const raw of events) {
      try {
        const ev = raw as {
          body: () => {
            v0: () => {
              topics: () => StellarSdk.xdr.ScVal[];
              data: () => StellarSdk.xdr.ScVal;
            };
          };
        };
        const v0 = ev.body().v0();
        // scValToNative is typed `any`; name the shape we actually rely on
        // rather than letting it leak through the rest of the loop.
        const topics: unknown[] = v0
          .topics()
          .map((t): unknown => StellarSdk.scValToNative(t));

        // [ 'transfer', from, to, asset ]
        if (topics[0] !== 'transfer') continue;
        if (String(topics[2]) !== params.destination) continue;

        received += BigInt(
          StellarSdk.scValToNative(v0.data()) as string | number | bigint,
        );
      } catch {
        // A malformed or unrelated event is not a reason to reject the
        // transaction; it is a reason to ignore that event.
        continue;
      }
    }

    if (received === 0n) {
      return {
        ok: false,
        reason: `no transfer to ${params.destination} in this transaction`,
      };
    }
    if (received < required) {
      return {
        ok: false,
        reason: `transferred ${received} stroops, expected at least ${required}`,
      };
    }

    return { ok: true };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private requireKeypair(sourceSecret?: string): StellarSdk.Keypair {
    if (sourceSecret) {
      return StellarSdk.Keypair.fromSecret(sourceSecret);
    }
    if (!this.relayKeypair) {
      throw new Error('STELLAR_RELAY_KEYPAIR_SECRET is not configured');
    }
    return this.relayKeypair;
  }

  private parseAsset(assetString: string): StellarSdk.Asset {
    if (assetString === 'native') {
      return StellarSdk.Asset.native();
    }
    const [code, issuer] = assetString.split(':');
    if (!code || !issuer) {
      throw new BadRequestException(
        `Invalid asset format: ${assetString}. Expected "native" or "CODE:issuer"`,
      );
    }
    return new StellarSdk.Asset(code, issuer);
  }

  /**
   * Shared Soroban contract invocation: build → simulate → sign → submit → poll.
   */
  private async invokeSorobanContract(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
    const keypair = this.requireKeypair();
    const contract = new StellarSdk.Contract(contractId);
    const sourceAccount = await this.sorobanServer.getAccount(
      keypair.publicKey(),
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
      throw new Error(`Soroban simulation failed: ${simulated.error}`);
    }

    const prepared = StellarSdk.rpc
      .assembleTransaction(
        tx,
        simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();

    prepared.sign(keypair);

    const sendResponse = await this.sorobanServer.sendTransaction(prepared);
    if (sendResponse.status === 'ERROR') {
      throw new Error(`Soroban tx send failed: ${sendResponse.status}`);
    }

    // Poll for finality
    let result = await this.sorobanServer.getTransaction(sendResponse.hash);
    while (
      result.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      await this.sleep(1000);
      result = await this.sorobanServer.getTransaction(sendResponse.hash);
    }

    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Soroban tx failed: ${sendResponse.hash}`);
    }

    return result;
  }

  private mapPathRecords(
    records: StellarSdk.Horizon.ServerApi.PaymentPathRecord[],
  ): PathPaymentPath[] {
    return records.map((record) => ({
      sourceAsset: {
        native: record.source_asset_type === 'native',
        code: record.source_asset_code,
        issuer: record.source_asset_issuer,
      },
      destinationAsset: {
        native: record.destination_asset_type === 'native',
        code: record.destination_asset_code,
        issuer: record.destination_asset_issuer,
      },
      path: record.path.map(
        (p: {
          asset_type: string;
          asset_code?: string;
          asset_issuer?: string;
        }) => ({
          native: p.asset_type === 'native',
          code: p.asset_code,
          issuer: p.asset_issuer,
        }),
      ),
      destinationAmount: record.destination_amount,
    }));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
