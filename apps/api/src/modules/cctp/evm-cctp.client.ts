import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  cctpEnvFromStellarNetwork,
  getEvmContracts,
  getUsdcAddress,
  type CctpEnv,
} from './contracts.js';
import { getDomain } from './domains.js';
import type { CctpTransferRequest } from './types.js';

/* ─────────────────────────────────────────────────────────── ABIs ────── */

/**
 * TokenMessenger V2 — only the entrypoints we actually call. Event
 * signature is included because we parse it from receipts to extract
 * the burn nonce (needed for Iris attestation lookup).
 */
const TOKEN_MESSENGER_V2_ABI = [
  'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) returns (uint64 nonce)',
  'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)',
] as const;

/**
 * MessageTransmitter V2 — entrypoint for self-relay mints on the
 * destination side. Not used in Forwarding-Service mode (the default).
 */
const MESSAGE_TRANSMITTER_V2_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
] as const;

/* ─────────────────────────────────────────────── shape helpers ────────── */

/**
 * Calldata payload returned to a client (checkout app) that holds the
 * customer's private key. The client only needs `to`, `data`, and
 * optionally `value` to construct a tx the user signs in their wallet.
 *
 * `expectedNonce` is omitted — the actual nonce is assigned on-chain
 * and only observable from the receipt log.
 */
export interface EvmTransactionPayload {
  /** Contract being called (e.g., TokenMessenger or ERC20 USDC). */
  to: string;
  /** Hex-encoded calldata. */
  data: string;
  /** ETH value. Always 0 for CCTP — burns are stablecoin only. */
  value: '0x0';
  /** Human label, for UX. */
  description: string;
}

/**
 * What `parseBurnReceipt` plucks from a confirmed source-side burn tx.
 * `nonce` is what Iris keys attestations by, so it's the critical bit.
 */
export interface ParsedBurn {
  nonce: bigint;
  amount: bigint;
  depositor: string;
  mintRecipient: string;
  destinationDomain: number;
  maxFee: bigint;
}

/* ───────────────────────────────────────────────── Threshold consts ───── */

/**
 * `minFinalityThreshold` value passed to `depositForBurnWithHook`. ≤1000
 * picks Fast Transfer (typically 8–20s); 2000 is the standard "wait for
 * hard finality" mode (~15 min on Ethereum L1).
 *
 * Reference: https://developers.circle.com/cctp/concepts/finality-and-block-confirmations
 */
const FINALITY_THRESHOLD = {
  fast: 1000,
  standard: 2000,
} as const;

/* ───────────────────────────────────────────────── Service ───────────── */

/**
 * EVM-side CCTP V2 client.
 *
 * Three responsibilities, each completely independent:
 *
 *  1. **Build calldata** for a customer to sign (`buildBurnTransaction`).
 *     We never hold the customer's private key — the checkout app sends
 *     this payload to MetaMask / WalletConnect for signing.
 *
 *  2. **Parse a confirmed burn receipt** (`parseBurnReceipt`) to extract
 *     the nonce and other fields. Used by the relay watcher to drive
 *     attestation polling and tie a customer burn to a payment record.
 *
 *  3. **Self-relay mint** (`submitMint`). Only called when running in
 *     `mintMode: 'self-relay'`, which we don't ship in v1 — Forwarding
 *     Service is the default. Implementation included so a future
 *     fallback path doesn't need a service rewrite.
 *
 * Crucially: this service never holds funds, never signs source-side
 * burns (customer's wallet does that), and only signs the destination
 * mint if explicitly configured to self-relay.
 */
/**
 * Public testnet endpoints, used when no `RPC_<CHAIN>_TESTNET` is configured.
 *
 * These are the chains' own published endpoints, not a third party's. They are
 * rate-limited and unsuitable for production — which is fine, because this map
 * is only consulted when `env === 'testnet'`. The point is that cloning the
 * repo and paying on Sepolia should not first require signing up to Alchemy.
 *
 * Networks match the testnets CCTP V2 addresses in contracts.ts refer to:
 * Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia and Avalanche Fuji.
 */
const PUBLIC_TESTNET_RPC: Record<string, string> = {
  ethereum: 'https://ethereum-sepolia-rpc.publicnode.com',
  base: 'https://sepolia.base.org',
  arbitrum: 'https://sepolia-rollup.arbitrum.io/rpc',
  optimism: 'https://sepolia.optimism.io',
  avalanche: 'https://api.avax-test.network/ext/bc/C/rpc',
};

@Injectable()
export class EvmCctpClient {
  private readonly logger = new Logger(EvmCctpClient.name);
  private readonly env: CctpEnv;

  /** Lazy per-chain RPC providers — built on first use, reused after. */
  private readonly providers = new Map<string, ethers.JsonRpcProvider>();

  /** Per-chain signer for self-relay mints (optional, gated by env). */
  private readonly signers = new Map<string, ethers.Wallet>();

  constructor(private readonly config: ConfigService) {
    this.env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
  }

  /* ────────────────────────────── 1. Build calldata ─────────────── */

  /**
   * Construct the raw transaction the customer will sign in their wallet
   * to burn USDC on `req.fromChain`. Returns a single payload for the
   * burn itself. Token approval is the caller's responsibility (typically
   * a separate UX step in the checkout app).
   */
  buildBurnTransaction(req: CctpTransferRequest): EvmTransactionPayload {
    const source = requireDomain(req.fromChain);
    const dest = requireDomain(req.toChain);

    const contracts = getEvmContracts(req.fromChain, this.env);
    const iface = new ethers.Interface(TOKEN_MESSENGER_V2_ABI);

    // For EVM destinations, derive the bytes32 mintRecipient from the
    // 20-byte EVM address. For non-EVM destinations (Stellar), the caller
    // (CctpService.prepareBurn) is responsible for providing the right
    // bytes32 in `req.mintRecipient` — typically the destination
    // forwarder contract id, with the end-recipient encoded into hookData.
    const mintRecipientBytes32 =
      req.mintRecipient ?? encodeRecipientBytes32(req.recipient, req.toChain);
    const destinationCallerBytes32 =
      req.destinationCaller ?? '0x' + '00'.repeat(32);

    // Hook data: supplied by the caller (CctpService.prepareBurn computes
    // it from req.recipient for the Forwarding-Service flow). When
    // unset, default to empty bytes — non-forwarder direct transfers.
    const hookData = req.hookData ?? '0x';

    const data = iface.encodeFunctionData('depositForBurnWithHook', [
      req.amount,
      dest.domain,
      mintRecipientBytes32,
      // USDC token address on the source chain. The per-chain registry is
      // in contracts.ts (USDC_ADDRESSES); this lookup picks the right
      // mainnet/testnet variant based on the configured env.
      getUsdcAddress(req.fromChain, this.env),
      destinationCallerBytes32,
      req.maxFee,
      req.speed === 'fast'
        ? FINALITY_THRESHOLD.fast
        : FINALITY_THRESHOLD.standard,
      hookData,
    ]);

    return {
      to: contracts.tokenMessenger,
      data,
      value: '0x0',
      description: `Burn ${formatUsdc(req.amount)} USDC on ${source.label} → mint on ${dest.label}`,
    };
  }

  /* ────────────────────────────── 2. Parse receipts ─────────────── */

  /**
   * Look up a confirmed burn tx by hash, parse the `DepositForBurn` log,
   * and return the structured fields downstream code needs. Returns
   * `null` if the tx isn't found or has no matching event (e.g., wrong
   * tx hash, not a CCTP burn).
   */
  async parseBurnReceipt(
    chainId: string,
    txHash: string,
  ): Promise<ParsedBurn | null> {
    const provider = this.providerFor(chainId);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    const iface = new ethers.Interface(TOKEN_MESSENGER_V2_ABI);
    const expectedTopic = iface.getEvent('DepositForBurn')!.topicHash;

    for (const log of receipt.logs) {
      if (log.topics[0] !== expectedTopic) continue;
      const parsed = iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (!parsed) continue;
      return {
        nonce: parsed.args.nonce as bigint,
        amount: parsed.args.amount as bigint,
        depositor: parsed.args.depositor as string,
        mintRecipient: parsed.args.mintRecipient as string,
        destinationDomain: Number(parsed.args.destinationDomain),
        maxFee: parsed.args.maxFee as bigint,
      };
    }

    return null;
  }

  /* ────────────────────────────── 3. Self-relay mint ────────────── */

  /**
   * Submit `receiveMessage(message, attestation)` on the destination
   * chain ourselves. Only called when `mintMode === 'self-relay'`.
   * Requires `EVM_RELAY_PRIVATE_KEY` to be set in env — throws if not.
   */
  async submitMint(
    chainId: string,
    message: string,
    attestation: string,
  ): Promise<string> {
    const signer = this.signerFor(chainId);
    const contracts = getEvmContracts(chainId, this.env);
    const transmitter = new ethers.Contract(
      contracts.messageTransmitter,
      MESSAGE_TRANSMITTER_V2_ABI,
      signer,
    );

    const tx = (await transmitter.receiveMessage(message, attestation)) as {
      hash: string;
      wait(): Promise<unknown>;
    };
    await tx.wait();
    this.logger.log(
      `self-relay mint on ${chainId} settled: ${tx.hash} (msg ${message.slice(0, 18)}…)`,
    );
    return tx.hash;
  }

  /* ─────────────────────────────── internals ────────────────────── */

  /**
   * Returns a (cached) RPC provider for `chainId`, on the network this client
   * is configured for.
   *
   * The chain id does not change between networks — `ethereum` is `ethereum`
   * whether we mean mainnet or Sepolia; only the contract addresses switch on
   * `env`. So a single `RPC_ETHEREUM` cannot serve both, and when it was the
   * only lookup, a testnet payment read Sepolia's USDC and TokenMessenger
   * addresses off a *mainnet* node. Nothing is deployed at those addresses
   * there, so the calls came back as empty reverts — or, if the mainnet URL
   * carried a stale key, as a bare 401 that looked like a credentials problem
   * rather than a wrong-network one.
   *
   * On testnet the per-chain override is `RPC_<CHAIN>_TESTNET`, falling back to
   * that chain's public endpoint so a local testnet run needs no third-party
   * key at all. Mainnet keeps `RPC_<CHAIN>` and no default: guessing a public
   * endpoint for real money is not a favour.
   */
  private providerFor(chainId: string): ethers.JsonRpcProvider {
    const cached = this.providers.get(chainId);
    if (cached) return cached;

    const rpcUrl = this.rpcUrlFor(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.providers.set(chainId, provider);
    return provider;
  }

  private rpcUrlFor(chainId: string): string {
    const upper = chainId.toUpperCase();

    if (this.env === 'testnet') {
      const envKey = `RPC_${upper}_TESTNET`;
      const configured = this.config.get<string>(envKey);
      if (configured) return configured;

      const fallback = PUBLIC_TESTNET_RPC[chainId];
      if (fallback) {
        this.logger.debug(
          `No ${envKey} set for "${chainId}" — using the public testnet endpoint ${fallback}. ` +
            `Set ${envKey} to use your own provider.`,
        );
        return fallback;
      }

      throw new Error(
        `missing testnet RPC endpoint for chain "${chainId}" (set ${envKey})`,
      );
    }

    const envKey = `RPC_${upper}`;
    const configured = this.config.get<string>(envKey);
    if (!configured) {
      throw new Error(
        `missing RPC endpoint for chain "${chainId}" (set ${envKey})`,
      );
    }
    return configured;
  }

  /**
   * Signer for self-relay mints. We use a single relay key across all
   * EVM destinations — the same wallet is funded with native gas on
   * each chain it might mint on. Forwarding-Service mode skips this
   * entirely and there's no funding requirement.
   */
  private signerFor(chainId: string): ethers.Wallet {
    const cached = this.signers.get(chainId);
    if (cached) return cached;

    const pk = this.config.get<string>('EVM_RELAY_PRIVATE_KEY');
    if (!pk) {
      throw new Error(
        'self-relay mint requires EVM_RELAY_PRIVATE_KEY (configure or switch to mintMode=forwarder)',
      );
    }

    const signer = new ethers.Wallet(pk, this.providerFor(chainId));
    this.signers.set(chainId, signer);
    return signer;
  }
}

/* ─────────────────────────────────────────────────────── helpers ────────── */

function requireDomain(chainId: string) {
  const entry = getDomain(chainId);
  if (!entry) throw new Error(`unknown CCTP chain id: ${chainId}`);
  return entry;
}

/**
 * Pack a chain-native address into the 32-byte slot CCTP messages use.
 * For EVM destinations we left-pad the 20-byte address; for Stellar we
 * defer — the customer-visible recipient is a strkey, but the value
 * that goes into `mintRecipient` is the **CctpForwarder** address (so
 * Circle's forwarder catches the mint and routes via hook data).
 */
function encodeRecipientBytes32(
  recipient: string,
  destinationChain: string,
): string {
  const dest = requireDomain(destinationChain);
  if (dest.kind === 'evm') {
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      throw new Error(
        `expected 20-byte EVM address for ${destinationChain}, got ${recipient}`,
      );
    }
    return '0x' + '00'.repeat(12) + recipient.slice(2).toLowerCase();
  }
  // Stellar: caller is responsible for setting mintRecipient to the
  // CctpForwarder contract id (Circle's forwarder picks recipient from
  // hook data). The strkey of the END-recipient goes into the hook,
  // not here.
  throw new Error(
    `non-EVM destination recipients must be encoded by the calling client (got ${destinationChain})`,
  );
}

function formatUsdc(subunits: bigint): string {
  // CCTP messages always carry 6-decimal amounts (regardless of source
  // chain's native precision).
  const whole = subunits / 1_000_000n;
  const frac = subunits % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}
