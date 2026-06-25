import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

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
  private readonly settlementContractId: string;

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
    this.settlementContractId =
      process.env.SOROBAN_SETTLEMENT_CONTRACT_ID || '';
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
  }): Promise<string> {
    this.logger.log('Executing Stellar path payment');

    const keypair = this.requireKeypair();
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

  // ── Private helpers ────────────────────────────────────────────────────────

  private requireKeypair(): StellarSdk.Keypair {
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
