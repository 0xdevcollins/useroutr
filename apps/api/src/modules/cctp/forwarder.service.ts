import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cctpEnvFromStellarNetwork,
  irisUrl,
  type CctpEnv,
} from './contracts.js';

/**
 * Encoders + fee lookups for Circle's Forwarding Service.
 *
 * Forwarding lets Circle pay the destination chain's gas + broadcast the
 * mint transaction. We embed instructions for it as **hook data** inside
 * the burn call (`depositForBurnWithHook` on EVM, `deposit_for_burn` with
 * a hook param on Stellar). Circle's attesters then route based on the
 * decoded hook data after attestation finishes.
 *
 * Hook data has two distinct shapes depending on direction:
 *
 *   1. **EVM → Stellar** — encodes the Stellar recipient as a UTF-8
 *      strkey because Stellar addresses are 56 chars (G…/C…/M…), not
 *      something that fits in a 32-byte EVM address slot. The layout
 *      mirrors what Circle's Stellar CctpForwarder expects:
 *        bytes  0–23: zero padding
 *        bytes 24–27: hook version (uint32 = 0)
 *        bytes 28–31: forward recipient length (uint32)
 *        bytes 32+ : strkey as UTF-8 bytes
 *
 *   2. **Stellar → EVM (and EVM → EVM)** — fixed magic value
 *      `cctp-forward` (in UTF-8, right-padded to 32 bytes). Circle's
 *      forwarder uses this as a "please handle the mint for us" sentinel
 *      and pulls the recipient from the canonical mintRecipient field.
 *
 * If we ever roll our own forwarder these encoders move into the new
 * code path — for now Circle's is the only target.
 */
@Injectable()
export class ForwarderService {
  private readonly logger = new Logger(ForwarderService.name);
  private readonly env: CctpEnv;

  constructor(private readonly config: ConfigService) {
    this.env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
  }

  /**
   * Encode hook data for **EVM → Stellar** transfers. Pass the recipient
   * Stellar strkey (G…/C…/M…); we'll lay it out in the format Circle's
   * Stellar CctpForwarder.mint_and_forward(...) expects.
   */
  encodeStellarForwardHook(stellarRecipient: string): `0x${string}` {
    assertStellarStrkey(stellarRecipient);

    const recipientBytes = Buffer.from(stellarRecipient, 'utf8');
    const totalLength = 32 + recipientBytes.length;
    const buf = Buffer.alloc(totalLength);

    // bytes 0–23 left as zeros (default Buffer.alloc behaviour).
    // bytes 24–27: hook version = 0
    buf.writeUInt32BE(0, 24);
    // bytes 28–31: length of recipient strkey
    buf.writeUInt32BE(recipientBytes.length, 28);
    // bytes 32+: the strkey itself
    recipientBytes.copy(buf, 32);

    return `0x${buf.toString('hex')}`;
  }

  /**
   * Magic value to pass as hook data when the recipient is on an EVM
   * destination. The recipient address rides in `mintRecipient`; the
   * hook just tells Circle "you handle the mint for us".
   *
   * Hex of "cctp-forward" + 20 zero bytes of padding = 32 bytes total.
   */
  evmForwardSentinel(): `0x${string}` {
    return '0x636374702d666f72776172640000000000000000000000000000000000000000';
  }

  /**
   * Quote the forwarding fee for a given route. Circle charges a per-
   * transfer fee covering destination gas; the rate moves with gas price
   * conditions so quotes are short-lived.
   *
   * Endpoint: GET {iris}/v2/burn/USDC/fees?sourceDomainId&destinationDomainId
   * Response (typed loosely — Iris returns extra fields we don't need):
   *   { data: [{ finalityThreshold, minimumFee }, ...] }
   */
  async quoteForwardingFee(
    sourceDomain: number,
    destinationDomain: number,
  ): Promise<{ minimumFeeBps: number }> {
    const url = irisUrl(
      this.env,
      `/v2/burn/USDC/fees?sourceDomainId=${sourceDomain}&destinationDomainId=${destinationDomain}&forward=true`,
    );

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(
        `iris fee quote failed (${res.status}): ${await res.text().catch(() => '')}`,
      );
    }

    const body = (await res.json()) as {
      data?: Array<{ minimumFee?: number }>;
    };
    // Use the most permissive available tier; caller can pick stricter
    // finality if needed.
    const minimumFee = body.data?.[0]?.minimumFee ?? 0;
    return { minimumFeeBps: minimumFee };
  }
}

/* ───────────────────────────────────────────────────────────────── helpers ── */

const STRKEY_PREFIXES = ['G', 'C', 'M'] as const;
const STRKEY_LENGTH = 56;

/**
 * Cheap sanity check — full strkey decoding lives in @stellar/stellar-sdk
 * (StrKey.isValidEd25519PublicKey). We only need to make sure callers
 * aren't accidentally passing an EVM address or empty string. Anything
 * that survives this still has to round-trip through the Stellar SDK
 * before we sign anything.
 */
function assertStellarStrkey(recipient: string): void {
  if (typeof recipient !== 'string' || recipient.length !== STRKEY_LENGTH) {
    throw new Error(
      `expected Stellar strkey (56 chars), got: ${recipient.slice(0, 16)}…`,
    );
  }
  if (!STRKEY_PREFIXES.includes(recipient[0] as (typeof STRKEY_PREFIXES)[number])) {
    throw new Error(
      `Stellar strkey must start with G, C, or M; got: ${recipient[0]}`,
    );
  }
}
