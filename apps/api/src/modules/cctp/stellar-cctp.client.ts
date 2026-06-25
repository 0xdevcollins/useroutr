import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc as stellarRpc,
  xdr,
} from '@stellar/stellar-sdk';
import {
  cctpEnvFromStellarNetwork,
  getStellarContracts,
  type CctpEnv,
} from './contracts.js';
import { getDomain } from './domains.js';
import type { CctpTransferRequest } from './types.js';

/* ─────────────────────────────────────────────── Precision constants ──── */

/**
 * USDC on Stellar uses **7 decimals** (Stellar's universal asset
 * precision). CCTP messages always carry **6-decimal** amounts. So:
 *
 *   `cctpAmount * 10` → Stellar subunits   (on mint)
 *   `stellarSubunits / 10` → CCTP amount   (on burn, with strict floor)
 *
 * The seventh decimal — the bit Stellar represents but CCTP can't —
 * stays in the user's account on burn. Per Circle's docs, this is
 * expected behavior and not a precision loss for any practical amount.
 */
const STELLAR_TO_CCTP_SCALE = 10n;

/** Default fee bump for Soroban operations. 1 XLM = 10_000_000 stroops. */
const DEFAULT_BASE_FEE = '1000000'; // 0.1 XLM — generous; Soroban can be hungry.

/* ──────────────────────────────────────────────────── Payloads ────────── */

/**
 * What we hand back to the checkout app for the customer to sign. Same
 * shape philosophy as `EvmTransactionPayload` — the wallet (Freighter,
 * Albedo, Lobstr) takes the XDR, the user approves, the wallet submits.
 * We never see the secret key.
 */
export interface StellarTransactionPayload {
  /** Base64-encoded Stellar XDR. Hand to the wallet for signing. */
  xdr: string;
  /** Network passphrase the tx must be signed under. */
  networkPassphrase: string;
  /** Human label, for UX. */
  description: string;
}

/**
 * What we extract from a confirmed Soroban burn. CCTP nonces on Stellar
 * are 64-bit unsigned ints, same as EVM — Iris keys on them identically.
 */
export interface ParsedStellarBurn {
  nonce: bigint;
  /** Amount in CCTP 6-decimal subunits (already scaled down from 7-dec). */
  cctpAmount: bigint;
  depositor: string;
  /** 32-byte hex of the mint recipient (forwarder address on destination). */
  mintRecipient: string;
  destinationDomain: number;
}

/* ─────────────────────────────────────────────────── Service ──────────── */

/**
 * Stellar / Soroban-side CCTP V2 client.
 *
 * The pattern mirrors `EvmCctpClient`:
 *   - `buildBurnTransaction` — constructs an XDR for the customer to sign
 *   - `parseBurnEvent`       — pulls the nonce out of a confirmed tx
 *   - `submitMintViaForwarder` — self-relay path (not used in v1)
 *
 * Stellar-specific landmines we handle here so callers don't have to:
 *  - 7-decimal ↔ 6-decimal scaling at the boundary
 *  - 32-byte strkey encoding into CCTP's mint-recipient slot
 *  - i128 vs u64 vs u32 ScVal coercion for Soroban arg lists
 */
@Injectable()
export class StellarCctpClient {
  private readonly logger = new Logger(StellarCctpClient.name);
  private readonly env: CctpEnv;
  private readonly networkPassphrase: string;
  private readonly rpcUrl: string;

  /** Lazy Stellar RPC client. */
  private _server?: stellarRpc.Server;

  constructor(private readonly config: ConfigService) {
    const network = this.config.get<string>('STELLAR_NETWORK');
    this.env = cctpEnvFromStellarNetwork(network);
    this.networkPassphrase =
      this.env === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    this.rpcUrl =
      this.config.get<string>('STELLAR_SOROBAN_RPC_URL') ??
      (this.env === 'mainnet'
        ? 'https://soroban-rpc.stellar.org'
        : 'https://soroban-testnet.stellar.org');
  }

  /* ────────────────────────────── 1. Build calldata ─────────────── */

  /**
   * Build an unsigned Soroban tx that calls
   * `TokenMessengerMinter.deposit_for_burn(...)`. Caller passes the
   * Stellar source account public key — that's the one the customer
   * signs with — and the destination chain + recipient as usual.
   *
   * `req.amount` is in CCTP 6-decimal subunits; we scale up to 7-decimal
   * inside the burn argument so the on-chain balance check sees the
   * right number.
   */
  async buildBurnTransaction(
    req: CctpTransferRequest,
    sourcePublicKey: string,
  ): Promise<StellarTransactionPayload> {
    const source = requireDomain(req.fromChain);
    if (source.kind !== 'stellar') {
      throw new Error(
        `buildBurnTransaction expects a Stellar source chain, got ${req.fromChain}`,
      );
    }
    const dest = requireDomain(req.toChain);
    const contracts = getStellarContracts(this.env);
    const server = this.server();
    const account = await server.getAccount(sourcePublicKey);

    // Build the Soroban call args. Note Stellar amount is 7-decimal.
    const stellarAmount = req.amount * STELLAR_TO_CCTP_SCALE;
    const mintRecipient = recipientToScBytes(req.recipient, req.toChain);
    const destinationCaller = req.destinationCaller
      ? hexTo32ByteScBytes(req.destinationCaller)
      : xdr.ScVal.scvBytes(Buffer.alloc(32));

    const contract = new Contract(contracts.tokenMessengerMinter);
    const operation = contract.call(
      'deposit_for_burn',
      new Address(sourcePublicKey).toScVal(),
      nativeToScVal(stellarAmount, { type: 'i128' }),
      nativeToScVal(dest.domain, { type: 'u32' }),
      mintRecipient,
      new Address(contracts.usdc).toScVal(),
      destinationCaller,
      nativeToScVal(req.maxFee * STELLAR_TO_CCTP_SCALE, { type: 'i128' }),
      // minFinalityThreshold: ≤1000 picks Fast Transfer (same as EVM).
      nativeToScVal(req.speed === 'fast' ? 1000 : 2000, { type: 'u32' }),
    );

    let tx = new TransactionBuilder(account, {
      fee: DEFAULT_BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();

    // Soroban requires footprint + resource computation before sign.
    // `prepareTransaction` does both via simulation.
    tx = await server.prepareTransaction(tx);

    return {
      xdr: tx.toXDR(),
      networkPassphrase: this.networkPassphrase,
      description: `Burn ${formatCctp(req.amount)} USDC on Stellar → mint on ${dest.label}`,
    };
  }

  /* ────────────────────────────── 2. Parse events ───────────────── */

  /**
   * Pull burn metadata out of a confirmed Soroban tx. The
   * `DepositForBurn` event on Stellar mirrors the EVM event but is
   * encoded in Soroban event topics + data. We just look up the tx by
   * hash and decode the first matching event.
   *
   * Returns `null` if the tx hasn't been observed yet, or doesn't
   * contain a burn event (e.g., wrong tx hash). Caller decides how to
   * retry / surface.
   */
  async parseBurnEvent(txHash: string): Promise<ParsedStellarBurn | null> {
    const server = this.server();
    const result = await server.getTransaction(txHash);
    if (result.status !== 'SUCCESS') return null;

    // Soroban events live on the meta. For PR B we extract via the
    // helper getEvents endpoint; production-grade decoding will move
    // into a dedicated parser once we add tests against real ledgers.
    const events = result.resultMetaXdr.v3().sorobanMeta()?.events();

    if (!events || events.length === 0) return null;

    for (const event of events) {
      // Topic[0] of CCTP burn events is the symbol "deposit_for_burn".
      const topics = event.body().v0().topics();
      const topic0 = topics[0]?.sym?.()?.toString();
      if (topic0 !== 'deposit_for_burn') continue;

      // Event body is encoded as a Soroban Vec/Map — pull the fields by
      // name. We accept some boilerplate here because the event ABI is
      // stable and we'd rather be explicit than introspective.
      const data = event.body().v0().data();
      const map = data.map?.();
      if (!map) continue;

      const fields = decodeMap(map);
      return {
        nonce: BigInt(fields.nonce as string | number),
        cctpAmount:
          BigInt(fields.amount as string | number) / STELLAR_TO_CCTP_SCALE,
        depositor: fields.depositor as string,
        mintRecipient: fields.mint_recipient as string,
        destinationDomain: Number(fields.destination_domain),
      };
    }

    return null;
  }

  /* ────────────────────────────── 3. Self-relay mint ────────────── */

  /**
   * Submit `CctpForwarder.mint_and_forward(message, attestation)` on
   * Stellar — the self-relay path for an inbound mint. Not used when
   * Circle's Forwarding Service is enabled (which it is in v1), but
   * present so we have a fallback if Circle is degraded.
   *
   * Requires a Stellar relay keypair (`STELLAR_RELAY_KEYPAIR_SECRET`)
   * funded with XLM on the appropriate network.
   */
  async submitMintViaForwarder(
    message: string,
    attestation: string,
  ): Promise<string> {
    const relaySecret = this.config.get<string>('STELLAR_RELAY_KEYPAIR_SECRET');
    if (!relaySecret) {
      throw new Error(
        'self-relay mint requires STELLAR_RELAY_KEYPAIR_SECRET (configure or switch to mintMode=forwarder)',
      );
    }
    const keypair = Keypair.fromSecret(relaySecret);
    const contracts = getStellarContracts(this.env);
    const server = this.server();
    const account = await server.getAccount(keypair.publicKey());

    const contract = new Contract(contracts.cctpForwarder);
    const op = contract.call(
      'mint_and_forward',
      xdr.ScVal.scvBytes(Buffer.from(strip0x(message), 'hex')),
      xdr.ScVal.scvBytes(Buffer.from(strip0x(attestation), 'hex')),
    );

    let tx = new TransactionBuilder(account, {
      fee: DEFAULT_BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    tx = await server.prepareTransaction(tx);
    tx.sign(keypair);

    const sendResponse = await server.sendTransaction(tx);
    if (sendResponse.status !== 'PENDING') {
      throw new Error(
        `Stellar tx submission failed: ${sendResponse.status} (${sendResponse.errorResult?.toXDR('base64') ?? 'no detail'})`,
      );
    }
    this.logger.log(
      `self-relay mint submitted on Stellar: ${sendResponse.hash}`,
    );
    return sendResponse.hash;
  }

  /* ─────────────────────────────── internals ────────────────────── */

  private server(): stellarRpc.Server {
    if (!this._server) {
      this._server = new stellarRpc.Server(this.rpcUrl);
    }
    return this._server;
  }
}

/* ─────────────────────────────────────────────────────── helpers ────────── */

function requireDomain(chainId: string) {
  const entry = getDomain(chainId);
  if (!entry) throw new Error(`unknown CCTP chain id: ${chainId}`);
  return entry;
}

/**
 * Pack the recipient into the 32-byte `mintRecipient` slot. EVM
 * destinations get left-padded; Stellar destinations route through
 * CctpForwarder so the **forwarder address** (a contract id) goes
 * into mintRecipient — and the END-recipient strkey rides in hook data
 * (handled by ForwarderService).
 *
 * If you ever need a raw Stellar account as mintRecipient (no forwarder),
 * encode the strkey's underlying public-key bytes here. We don't expose
 * that path until we need it.
 */
function recipientToScBytes(
  recipient: string,
  destinationChain: string,
): xdr.ScVal {
  const dest = requireDomain(destinationChain);
  if (dest.kind === 'evm') {
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      throw new Error(
        `expected 20-byte EVM address for ${destinationChain}, got ${recipient}`,
      );
    }
    const buf = Buffer.alloc(32);
    Buffer.from(recipient.slice(2).toLowerCase(), 'hex').copy(buf, 12);
    return xdr.ScVal.scvBytes(buf);
  }
  if (dest.kind === 'stellar') {
    // Caller should have set `recipient` to a CctpForwarder contract id.
    // We accept either a strkey ("C…") or raw 32-byte hex.
    if (StrKey.isValidContract(recipient)) {
      return xdr.ScVal.scvBytes(StrKey.decodeContract(recipient));
    }
    if (recipient.startsWith('0x') && recipient.length === 66) {
      return xdr.ScVal.scvBytes(Buffer.from(recipient.slice(2), 'hex'));
    }
    throw new Error(
      `Stellar mintRecipient must be a contract strkey (C…) or 32-byte hex, got ${recipient.slice(0, 16)}…`,
    );
  }
  throw new Error(`cannot encode mintRecipient for chain kind ${dest.kind}`);
}

function hexTo32ByteScBytes(hex: string): xdr.ScVal {
  const clean = strip0x(hex);
  if (clean.length !== 64) {
    throw new Error(`expected 32-byte hex (64 chars), got ${clean.length}`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(clean, 'hex'));
}

function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function formatCctp(subunits: bigint): string {
  const whole = subunits / 1_000_000n;
  const frac = subunits % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}

/**
 * Decode a Soroban Map ScVal into a flat string-keyed object. Best-effort:
 * we expect the CCTP burn event payload to be a flat map of primitive
 * values (numbers, byte arrays, addresses). Anything more nested is
 * passed through opaquely as the raw ScVal.
 */
function decodeMap(map: xdr.ScMapEntry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of map) {
    const key = entry.key().sym?.()?.toString();
    if (!key) continue;
    const val = entry.val();
    const switchTag = val.switch().name;
    switch (switchTag) {
      case 'scvU32':
        out[key] = val.u32();
        break;
      case 'scvU64':
        out[key] = val.u64().toString();
        break;
      case 'scvI128':
      case 'scvU128': {
        // 128-bit ints — return as string so caller can convert via BigInt.
        const parts = switchTag === 'scvI128' ? val.i128() : val.u128();
        const hi = BigInt(parts.hi().toString());
        const lo = BigInt(parts.lo().toString());
        out[key] = ((hi << 64n) + lo).toString();
        break;
      }
      case 'scvBytes':
        out[key] = `0x${val.bytes().toString('hex')}`;
        break;
      case 'scvAddress':
        out[key] = Address.fromScAddress(val.address()).toString();
        break;
      case 'scvString':
        out[key] = val.str().toString();
        break;
      default:
        out[key] = val;
    }
  }
  return out;
}
