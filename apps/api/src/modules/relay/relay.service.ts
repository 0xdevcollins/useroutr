import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ethers } from 'ethers';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { StellarService } from '../stellar/stellar.service';
import { PaymentsService } from '../payments/payments.service';
import { BridgeRouterService } from '../bridge/bridge-router.service';
import { Chain, SourceLockEvent } from '@tavvio/types';
import { PaymentStatus } from '../../generated/prisma';

@Injectable()
export class RelayService implements OnModuleInit {
  private readonly logger = new Logger(RelayService.name);
  private readonly DEFAULT_BACKOFF = {
    type: 'exponential',
    delay: 1000,
  };

  constructor(
    @InjectQueue('relay') private readonly relayQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly stellarService: StellarService,
    private readonly paymentsService: PaymentsService,
    private readonly bridgeRouter: BridgeRouterService,
  ) {}

  private async getProcessedBlock(chain: string): Promise<number> {
    const block = await this.redis.get(`last_processed_block:${chain}`);
    return block ? parseInt(block, 10) : 0;
  }

  private async setProcessedBlock(
    chain: string,
    blockAt: number,
  ): Promise<void> {
    await this.redis.set(`last_processed_block:${chain}`, blockAt.toString());
  }

  async onModuleInit() {
    this.logger.log('RelayService initializing...');

    // Watch Stellar HTLC events
    this.watchStellarHTLC();

    // Start watching supported EVM chains
    const evmChains: Chain[] = [
      'ethereum',
      'base',
      'polygon',
      'arbitrum',
      'avalanche',
    ];
    for (const chain of evmChains) {
      this.watchSourceChain(chain);
    }

    // Schedule expired lock watchdog every 60s
    await this.relayQueue.add(
      'watchExpired',
      {},
      {
        repeat: { every: 60_000 },
        jobId: 'watchExpired',
      },
    );
  }

  private async watchStellarHTLC(): Promise<void> {
    const htlcContractId = process.env.STELLAR_HTLC_CONTRACT_ID || '';
    if (!htlcContractId) {
      this.logger.warn(
        'STELLAR_HTLC_CONTRACT_ID not set, skipping Stellar watcher',
      );
      return;
    }

    this.stellarService.streamContractEvents(htlcContractId, async (event) => {
      if (event.type === 'Withdrawn') {
        await this.handleStellarWithdrawal({
          lockId: event.lock_id,
          preimage: event.preimage,
        });
      }
    });
  }

  // Detected on-chain secret reveal
  private async handleStellarWithdrawal(event: {
    lockId: string;
    preimage: string;
  }): Promise<void> {
    this.logger.log(`Detected Stellar withdrawal for lock ${event.lockId}`);

    const payment = await this.paymentsService.findByStellarLockId(
      event.lockId,
    );
    if (!payment) {
      this.logger.warn(`No payment found for Stellar lock ${event.lockId}`);
      return;
    }

    // Already completed?
    if (payment.status === PaymentStatus.COMPLETED) return;

    await this.relayQueue.add(
      'completeSourceUnlock',
      {
        paymentId: payment.id,
        preimage: event.preimage,
      },
      {
        attempts: 10,
        backoff: this.DEFAULT_BACKOFF,
      },
    );
  }

  private async watchSourceChain(chain: Chain): Promise<void> {
    const rpcUrl = process.env[`RPC_URL_${chain.toUpperCase()}`];
    const htlcAddress = process.env[`HTLC_ADDRESS_${chain.toUpperCase()}`];

    if (!rpcUrl || !htlcAddress) {
      this.logger.debug(
        `RPC or HTLC address missing for ${chain}, skipping watcher`,
      );
      return;
    }

    this.logger.log(`Watching EVM chain: ${chain} at ${htlcAddress}`);

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const htlc = new ethers.Contract(
        htlcAddress,
        [
          'event Locked(bytes32 indexed lockId, address indexed sender, address indexed receiver, uint256 amount, bytes32 hashlock, uint256 timelock, address token)',
        ],
        provider,
      );

      const lastBlock = await this.getProcessedBlock(chain);
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock > 0 && lastBlock < currentBlock) {
        this.logger.log(
          `Scanning ${chain} for missed events from block ${lastBlock} to ${currentBlock}`,
        );
        const query = htlc.filters.Locked();
        const events = await htlc.queryFilter(
          query,
          lastBlock + 1,
          currentBlock,
        );

        for (const event of events as any[]) {
          if (event.args) {
            const [
              lockId,
              sender,
              receiver,
              amount,
              hashlock,
              timelock,
              token,
            ] = event.args;
            await this.handleSourceLock({
              lockId,
              sender,
              receiver,
              amount,
              hashlock,
              timelock: Number(timelock),
              token,
              chain,
            });
          }
        }
      }
      await this.setProcessedBlock(chain, currentBlock);

      htlc.on(
        'Locked',
        async (
          lockId,
          sender,
          receiver,
          amount,
          hashlock,
          timelock,
          token,
          event,
        ) => {
          await this.handleSourceLock({
            lockId,
            sender,
            receiver,
            amount,
            hashlock,
            timelock: Number(timelock),
            token,
            chain,
          });
          await this.setProcessedBlock(chain, event.log.blockNumber);
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to watch ${chain}: ${message}`);
    }
  }

  private async handleSourceLock(event: SourceLockEvent): Promise<void> {
    this.logger.log(`Detected source lock: ${event.lockId} on ${event.chain}`);

    const payment = await this.paymentsService.handleSourceLock(event);
    if (payment) {
      await this.relayQueue.add(
        'completeStellarLock',
        { paymentId: payment.id },
        {
          attempts: 10,
          backoff: this.DEFAULT_BACKOFF,
        },
      );
    }
  }

  async processExpiredLocks(): Promise<void> {
    this.logger.log('Checking for expired locks...');
    // findExpiredPending identified payments that timed out in PENDING status
    // but here we need to find payments that are locked but never completed
    const expiredPayments = await this.paymentsService.findExpiredLocked();

    for (const payment of expiredPayments) {
      this.logger.log(`Refunding expired payment: ${payment.id}`);

      // 1. Refund Stellar side
      if (payment.stellarLockId) {
        try {
          await this.stellarService.refundHTLC(payment.stellarLockId);
        } catch (err) {
          this.logger.error(
            `Failed to refund Stellar lock ${payment.stellarLockId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // 2. Refund Source side (EVM)
      if (payment.sourceLockId) {
        try {
          await this.bridgeRouter.refundSourceLock({
            chain: payment.sourceChain as any,
            lockId: payment.sourceLockId,
          });
        } catch (err) {
          this.logger.error(
            `Failed to refund Source lock ${payment.sourceLockId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      await this.paymentsService.updateStatus(payment.id, PaymentStatus.FAILED);
    }
  }
}
