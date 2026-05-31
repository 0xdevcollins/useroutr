import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StrKey } from '@stellar/stellar-sdk';
import { AttestationService } from './attestation.service.js';
import { EvmCctpClient, type EvmTransactionPayload } from './evm-cctp.client.js';
import { ForwarderService } from './forwarder.service.js';
import {
  StellarCctpClient,
  type StellarTransactionPayload,
} from './stellar-cctp.client.js';
import { getDomain, enabledDomains } from './domains.js';
import {
  STELLAR_CCTP,
  cctpEnvFromStellarNetwork,
} from './contracts.js';
import type {
  AttestationResponse,
  CctpTransferRecord,
  CctpTransferRequest,
} from './types.js';

/**
 * High-level orchestrator for CCTP V2 transfers — the only surface PR C
 * wires the rest of the API against. Keep the public API narrow:
 *
 *   - `prepareBurn(req)`         → returns unsigned tx for client to sign
 *   - `observe(txHash, source)`  → polls Iris, returns final settlement
 *   - `listSupportedRoutes()`    → for quote engine + dashboards
 *
 * Direction-specific code lives in the EVM and Stellar clients. The
 * orchestrator decides which client owns each request and weaves in the
 * forwarder + attestation services as needed.
 */
@Injectable()
export class CctpService {
  private readonly logger = new Logger(CctpService.name);

  constructor(
    private readonly attestation: AttestationService,
    private readonly forwarder: ForwarderService,
    private readonly evm: EvmCctpClient,
    private readonly stellar: StellarCctpClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Prepare the unsigned burn transaction the customer will sign in
   * their wallet. Includes:
   *  - chain-appropriate calldata (EVM viem-style payload or Stellar XDR)
   *  - Forwarder Service hook data when `mintMode === 'forwarder'`, so
   *    Circle picks up the destination mint and we never hold a
   *    hot wallet on the destination chain.
   *
   * `sourceAccount` is only required for Stellar sources (the Soroban
   * tx needs the sequence number from a specific account).
   */
  async prepareBurn(
    req: CctpTransferRequest,
    sourceAccount?: string,
  ): Promise<EvmTransactionPayload | StellarTransactionPayload> {
    this.validate(req);

    const source = getDomain(req.fromChain)!;

    if (source.kind === 'evm') {
      // EVM source: forwarder hook data depends on the destination kind.
      // EVM→Stellar uses an encoded strkey + forwarder contract id;
      // EVM→EVM uses the sentinel + the recipient as bytes32.
      const hookData = await this.buildHookData(req);
      const mintRecipient = this.computeMintRecipient(req);
      const tx = this.evm.buildBurnTransaction({
        ...req,
        hookData,
        mintRecipient,
      });
      this.logger.debug(
        `burn payload prepared on ${source.id}: ${tx.description} (hook ${hookData.slice(0, 18)}…)`,
      );
      return tx;
    }

    if (source.kind === 'stellar') {
      if (!sourceAccount) {
        throw new Error('Stellar burns require sourceAccount (G… strkey)');
      }
      // Stellar→EVM and Stellar→Stellar both use the same shape on the
      // Stellar side; hook data is a separate Soroban arg, handled by
      // the client when PR C wires it.
      return this.stellar.buildBurnTransaction(req, sourceAccount);
    }

    throw new Error(`CCTP source not supported yet: ${source.kind}`);
  }

  /**
   * Watch a confirmed source-side burn through to destination settlement.
   *
   * Flow:
   *   1. parse burn receipt   → extract nonce + amount + recipient
   *   2. poll Iris attestation → wait for status = complete
   *   3. (Forwarding Service) Iris response carries `forwardTxHash`
   *      when Circle has broadcast the mint — we treat that as settled
   *   4. (self-relay) call destination mint ourselves
   *
   * Returns a single record summarizing the full lifecycle. Throws on
   * unrecoverable failure (attestation timeout, mint revert, etc.) —
   * the caller (relay worker) handles retry / surface to the merchant.
   */
  async observe(
    txHash: string,
    sourceChainId: string,
  ): Promise<CctpTransferRecord> {
    const source = getDomain(sourceChainId);
    if (!source) {
      throw new Error(`unknown source chain: ${sourceChainId}`);
    }

    // Step 1 — parse the burn from the source chain receipt.
    const burn = await this.parseBurn(sourceChainId, txHash);
    if (!burn) {
      throw new Error(
        `burn tx ${txHash} not found on ${sourceChainId} (or not a CCTP burn)`,
      );
    }

    // Step 2 — poll Iris until attestation is ready or fails.
    const attestation = await this.attestation.pollUntilReady(
      source.domain,
      txHash,
    );

    if (attestation.status === 'failed') {
      throw new Error(
        `attestation failed for ${txHash}: ${attestation.error ?? 'no detail'}`,
      );
    }

    // Step 3 — record the settlement. If Iris has a forwardTxHash, the
    // mint is already on-chain. Otherwise the caller is on self-relay
    // and would dispatch the mint themselves (not done here — kept
    // separate so the service stays composable).
    const dest = getDomainByDomainNumber(burn.destinationDomain);
    return {
      request: {
        // Reconstructed from the burn — sufficient for downstream record-
        // keeping. Some fields (speed, mintMode) aren't on-chain so we
        // leave them as defaults; the caller knows what was originally
        // requested via the Quote row.
        fromChain: sourceChainId,
        toChain: dest?.id ?? `domain-${burn.destinationDomain}`,
        amount: burn.amount,
        recipient: burn.mintRecipient,
        speed: 'fast',
        mintMode: attestation.forwardTxHash ? 'forwarder' : 'self-relay',
        maxFee: burn.maxFee,
      },
      burn: {
        txHash,
        sourceDomain: source.domain,
        nonce: burn.nonce,
      },
      attestation,
      mintTxHash: attestation.forwardTxHash,
    };
  }

  /**
   * Enabled (source, destination) pairs for the quote engine. Excludes
   * same-chain self-routes and any chain that's flagged disabled in
   * the registry.
   */
  listSupportedRoutes(): Array<{ from: string; to: string }> {
    const enabled = enabledDomains();
    const routes: Array<{ from: string; to: string }> = [];
    for (const a of enabled) {
      for (const b of enabled) {
        if (a.id === b.id) continue;
        routes.push({ from: a.id, to: b.id });
      }
    }
    return routes;
  }

  /* ───────────────────────────── internals ──────────────────────── */

  private validate(req: CctpTransferRequest): void {
    const from = getDomain(req.fromChain);
    const to = getDomain(req.toChain);
    if (!from) throw new Error(`unknown source chain: ${req.fromChain}`);
    if (!to) throw new Error(`unknown destination chain: ${req.toChain}`);
    if (!from.enabled || !to.enabled) {
      throw new Error(
        `route ${req.fromChain} → ${req.toChain} is not currently enabled`,
      );
    }
    if (req.fromChain === req.toChain) {
      throw new Error('CCTP cannot bridge to the same chain');
    }
    if (req.amount <= 0n) {
      throw new Error('amount must be > 0');
    }
  }

  /** Pick the right hook data shape for the destination kind. */
  private async buildHookData(req: CctpTransferRequest): Promise<string> {
    if (req.hookData) return req.hookData;
    if (req.mintMode !== 'forwarder') return '0x';
    const dest = getDomain(req.toChain)!;
    if (dest.kind === 'stellar') {
      return this.forwarder.encodeStellarForwardHook(req.recipient);
    }
    return this.forwarder.evmForwardSentinel();
  }

  /**
   * Compute the bytes32 `mintRecipient` for the `depositForBurnWithHook`
   * call, based on the destination chain:
   *
   *   - EVM dest: leave unset; the EVM client encodes `req.recipient`
   *     (a 20-byte EVM address) as the bottom 20 bytes of a 32-byte field.
   *   - Stellar dest: the actual recipient strkey goes into hook data,
   *     and mintRecipient must be the Stellar CctpForwarder contract id
   *     (32-byte raw, hex-encoded).
   *
   * Caller-supplied `req.mintRecipient` always wins — useful for bypassing
   * the Forwarding Service or testing with a custom forwarder.
   */
  private computeMintRecipient(req: CctpTransferRequest): string | undefined {
    if (req.mintRecipient) return req.mintRecipient;
    const dest = getDomain(req.toChain)!;
    if (dest.kind !== 'stellar') return undefined;

    const env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
    const forwarder = STELLAR_CCTP[env].cctpForwarder;
    // Stellar contract IDs decode to 32 raw bytes. The CCTP V2 `bytes32`
    // mintRecipient field on EVM receives exactly that, hex-encoded.
    const raw = StrKey.decodeContract(forwarder);
    return '0x' + Buffer.from(raw).toString('hex');
  }

  /**
   * Dispatch to the right client for receipt parsing, then return a
   * single normalized shape so the orchestrator never has to branch on
   * chain kind further downstream.
   */
  private async parseBurn(
    sourceChainId: string,
    txHash: string,
  ): Promise<NormalizedBurn | null> {
    const source = getDomain(sourceChainId)!;
    if (source.kind === 'evm') {
      const parsed = await this.evm.parseBurnReceipt(sourceChainId, txHash);
      if (!parsed) return null;
      return {
        nonce: parsed.nonce,
        amount: parsed.amount,
        depositor: parsed.depositor,
        mintRecipient: parsed.mintRecipient,
        destinationDomain: parsed.destinationDomain,
        maxFee: parsed.maxFee,
      };
    }
    if (source.kind === 'stellar') {
      const parsed = await this.stellar.parseBurnEvent(txHash);
      if (!parsed) return null;
      return {
        nonce: parsed.nonce,
        amount: parsed.cctpAmount,
        depositor: parsed.depositor,
        mintRecipient: parsed.mintRecipient,
        destinationDomain: parsed.destinationDomain,
        maxFee: 0n, // Stellar burn event doesn't currently surface maxFee.
      };
    }
    throw new Error(`cannot parse burn for chain kind ${source.kind}`);
  }
}

/** Shape both EVM and Stellar burn parsers collapse into. */
interface NormalizedBurn {
  nonce: bigint;
  /** Always CCTP 6-decimal subunits (Stellar scaling is unwound on parse). */
  amount: bigint;
  depositor: string;
  mintRecipient: string;
  destinationDomain: number;
  /** Max fee from the burn payload; 0n when the chain doesn't surface it. */
  maxFee: bigint;
}

/* ─────────────────────────────────────────────────────── helpers ────────── */

function getDomainByDomainNumber(n: number) {
  return enabledDomains().find((d) => d.domain === n);
}
