import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CctpService } from '../cctp/cctp.service';
import { PaymentsService } from './payments.service';
import { CctpProcessor } from './cctp.processor';
import {
  CCTP_OBSERVE_QUEUE,
  CCTP_OBSERVE_JOB,
  CCTP_MAX_ATTEMPTS,
  CCTP_RETRY_DELAYS_MS,
  type CctpObserveJobData,
} from './cctp.constants';

/**
 * Tests cover the three branches that matter for the worker:
 *
 *   1. Happy path: observe returns mintTxHash → PROCESSING → COMPLETED
 *   2. Forwarder didn't relay yet (no mintTxHash) → PROCESSING, no COMPLETED
 *   3. observe throws + retries remaining → re-enqueue with backoff
 *   4. observe throws + retries exhausted → FAILED with cctpError stashed
 *
 * The actual CCTP observation logic is exercised by cctp.service.spec /
 * attestation.service.spec — this processor is a thin orchestration shim.
 */
describe('CctpProcessor', () => {
  let processor: CctpProcessor;
  const cctpService = { observe: jest.fn() };
  const paymentsService = { updateStatus: jest.fn() };
  const queue = { add: jest.fn() };
  const prisma = {};

  function makeJob(
    overrides: Partial<CctpObserveJobData> = {},
  ): { name: string; data: CctpObserveJobData } {
    return {
      name: CCTP_OBSERVE_JOB,
      data: {
        paymentId: 'pay_123',
        sourceTxHash:
          '0x' + 'a'.repeat(64),
        sourceChain: 'base',
        attempt: 1,
        ...overrides,
      },
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CctpProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: CctpService, useValue: cctpService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: `BullQueue_${CCTP_OBSERVE_QUEUE}`, useValue: queue },
      ],
    }).compile();

    // Resolve via the testing module rather than `new CctpProcessor(...)`
    // so the forwardRef wrapping on PaymentsService resolves correctly.
    processor = module.get<CctpProcessor>(CctpProcessor);
  });

  it('transitions to PROCESSING then COMPLETED when forwarder relays the mint', async () => {
    cctpService.observe.mockResolvedValue({
      burn: { nonce: 42n },
      attestation: { attestation: '0xATTEST' },
      mintTxHash: '0xMINTHASH',
    });

    await processor.process(makeJob() as never);

    expect(paymentsService.updateStatus).toHaveBeenNthCalledWith(
      1,
      'pay_123',
      PaymentStatus.PROCESSING,
      { cctpNonce: '42', cctpAttestation: '0xATTEST' },
    );
    expect(paymentsService.updateStatus).toHaveBeenNthCalledWith(
      2,
      'pay_123',
      PaymentStatus.COMPLETED,
      { destTxHash: '0xMINTHASH' },
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('leaves payment in PROCESSING when no forwardTxHash (self-relay not in v1)', async () => {
    cctpService.observe.mockResolvedValue({
      burn: { nonce: 42n },
      attestation: { attestation: '0xATTEST' },
      mintTxHash: undefined,
    });

    await processor.process(makeJob() as never);

    expect(paymentsService.updateStatus).toHaveBeenCalledTimes(1);
    expect(paymentsService.updateStatus).toHaveBeenCalledWith(
      'pay_123',
      PaymentStatus.PROCESSING,
      expect.objectContaining({ cctpNonce: '42' }),
    );
  });

  it('re-enqueues with backoff when observe fails and retries remain', async () => {
    cctpService.observe.mockRejectedValue(new Error('iris timeout'));

    await expect(processor.process(makeJob({ attempt: 1 }) as never)).rejects.toThrow(
      /iris timeout/,
    );

    expect(queue.add).toHaveBeenCalledWith(
      CCTP_OBSERVE_JOB,
      expect.objectContaining({
        paymentId: 'pay_123',
        attempt: 2,
      }),
      expect.objectContaining({ delay: CCTP_RETRY_DELAYS_MS[0] }),
    );
    // No status transition yet — still in SOURCE_LOCKED, will retry
    expect(paymentsService.updateStatus).not.toHaveBeenCalled();
  });

  it('transitions to FAILED with cctpError when retries are exhausted', async () => {
    cctpService.observe.mockRejectedValue(new Error('attestation never settled'));

    await expect(
      processor.process(makeJob({ attempt: CCTP_MAX_ATTEMPTS }) as never),
    ).rejects.toThrow(/attestation never settled/);

    expect(queue.add).not.toHaveBeenCalled();
    expect(paymentsService.updateStatus).toHaveBeenCalledWith(
      'pay_123',
      PaymentStatus.FAILED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: expect.objectContaining({
          cctpError: 'attestation never settled',
        }),
      }),
    );
  });

  it('rejects unknown job names', async () => {
    await expect(
      processor.process({ name: 'something-else', data: {} } as never),
    ).rejects.toThrow(/Unknown job name/);
  });
});
