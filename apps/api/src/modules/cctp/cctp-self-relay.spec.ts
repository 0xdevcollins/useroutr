import type { ConfigService } from '@nestjs/config';
import { CctpService } from './cctp.service';
import type { AttestationService } from './attestation.service';
import type { ForwarderService } from './forwarder.service';
import type { EvmCctpClient } from './evm-cctp.client';
import type { StellarCctpClient } from './stellar-cctp.client';

/**
 * The last leg of a Stellar-destined payment.
 *
 * Circle's Forwarding Service returns no `forwardTxHash` for this route —
 * `mint_and_forward` on the Stellar CctpForwarder takes no authorisation and
 * nobody is watching on our behalf. So an attested message sat unminted and the
 * payment stopped at PROCESSING, one step short of the merchant being paid.
 * These cases pin the behaviour that fixed it.
 */
describe('CctpService — Stellar self-relay mint', () => {
  const BURN_TX = '0xburn';
  const NONCE = '0x' + 'ab'.repeat(32);

  function build(overrides: {
    isNonceUsed?: jest.Mock;
    submitMintViaForwarder?: jest.Mock;
    forwardTxHash?: string;
    /** Explicit null means "Iris returned no message at all". */
    message?: string | null;
    signature?: string | null;
  }) {
    const stellar = {
      isNonceUsed: overrides.isNonceUsed ?? jest.fn().mockResolvedValue(false),
      submitMintViaForwarder:
        overrides.submitMintViaForwarder ??
        jest.fn().mockResolvedValue('stellar_tx_hash'),
      parseBurnEvent: jest.fn(),
    } as unknown as StellarCctpClient;

    const evm = {
      // Domain 27 is Stellar. Amount/recipient are incidental here.
      parseBurnReceipt: jest.fn().mockResolvedValue({
        nonce: null,
        amount: 10_000n,
        depositor: '0xdepositor',
        mintRecipient: '0xforwarder',
        destinationDomain: 27,
        maxFee: 1n,
      }),
    } as unknown as EvmCctpClient;

    const attestation = {
      pollUntilReady: jest.fn().mockResolvedValue({
        status: 'complete',
        message:
          overrides.message === null
            ? undefined
            : (overrides.message ?? '0xmessage'),
        attestation:
          overrides.signature === null
            ? undefined
            : (overrides.signature ?? '0xsignature'),
        eventNonce: NONCE,
        forwardTxHash: overrides.forwardTxHash,
      }),
    } as unknown as AttestationService;

    const service = new CctpService(
      attestation,
      {} as ForwarderService,
      evm,
      stellar,
      {
        get: jest.fn((k: string) =>
          k === 'STELLAR_NETWORK' ? 'testnet' : undefined,
        ),
      } as unknown as ConfigService,
    );

    return { service, stellar };
  }

  it('mints on Stellar when Circle has not', async () => {
    const { service, stellar } = build({});

    const record = await service.observe(BURN_TX, 'ethereum');

    expect(stellar.submitMintViaForwarder).toHaveBeenCalledWith(
      '0xmessage',
      '0xsignature',
    );
    expect(record.mintTxHash).toBe('stellar_tx_hash');
  });

  it('leaves it to Circle when a forwardTxHash is present', async () => {
    const { service, stellar } = build({ forwardTxHash: '0xcircle' });

    const record = await service.observe(BURN_TX, 'ethereum');

    expect(stellar.submitMintViaForwarder).not.toHaveBeenCalled();
    expect(record.mintTxHash).toBe('0xcircle');
  });

  // The worker retries, and `mint_and_forward` rejects a message it has already
  // consumed. Without the nonce check, a successful mint would look identical
  // to a broken one on the next attempt and the payment would eventually be
  // marked FAILED after the money had already arrived.
  it('does not resubmit a message that was already minted', async () => {
    const { service, stellar } = build({
      isNonceUsed: jest.fn().mockResolvedValue(true),
    });

    await service.observe(BURN_TX, 'ethereum');

    expect(stellar.submitMintViaForwarder).not.toHaveBeenCalled();
  });

  // A payment that is merely un-minted is in a better state than one marked
  // failed: the next attempt can still settle it.
  it('reports no mint rather than throwing when the submit fails', async () => {
    const { service } = build({
      submitMintViaForwarder: jest
        .fn()
        .mockRejectedValue(new Error('soroban unavailable')),
    });

    const record = await service.observe(BURN_TX, 'ethereum');

    expect(record.mintTxHash).toBeUndefined();
    expect(record.attestation.status).toBe('complete');
  });

  it('does not attempt a mint without a message to submit', async () => {
    const { service, stellar } = build({ message: null });

    const record = await service.observe(BURN_TX, 'ethereum');

    expect(stellar.submitMintViaForwarder).not.toHaveBeenCalled();
    expect(record.mintTxHash).toBeUndefined();
  });
});
