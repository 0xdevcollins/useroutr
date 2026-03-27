import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '../../generated/prisma';
import { EventsGateway } from '../events/events/events.gateway';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async handleSourceLock(event: {
    lockId: string;
    sender: string;
    receiver: string;
    amount: bigint;
    hashlock: string;
    timelock: number;
    token: string;
    chain: string;
  }) {
    this.logger.log(`Handling source lock: ${event.lockId} on ${event.chain}`);

    // Match hashlock to a pending payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        hashlock: event.hashlock,
        status: PaymentStatus.PENDING,
      },
    });

    if (!payment) {
      this.logger.warn(`No pending payment found for hashlock: ${event.hashlock}`);
      return;
    }

    // Update payment with source lock info
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        sourceLockId: event.lockId,
        sourceAddress: event.sender,
        status: PaymentStatus.SOURCE_LOCKED,
      },
    });

    // Emit real-time update
    this.eventsGateway.server.to(payment.id).emit('payment.updated', updatedPayment);

    return updatedPayment;
  }

  async updateStatus(id: string, status: PaymentStatus, txHash?: string) {
    this.logger.log(`Updating payment ${id} status to ${status}`);
    
    const data: any = { status };
    if (txHash) {
      if (status === PaymentStatus.STELLAR_LOCKED) {
        data.stellarTxHash = txHash;
      } else if (status === PaymentStatus.COMPLETED) {
        data.destTxHash = txHash;
        data.completedAt = new Date();
      }
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data,
    });

    this.eventsGateway.server.to(id).emit('payment.updated', updatedPayment);
    return updatedPayment;
  }

  async findByStellarLockId(stellarLockId: string) {
    return this.prisma.payment.findFirst({
      where: { stellarLockId },
    });
  }

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findExpiredPayments() {
    const now = new Date();
    // Simplified: finding payments in LOCKED status that should be expired
    // In a real app, we'd check the timelock from the contract or stored metadata
    return this.prisma.payment.findMany({
      where: {
        status: {
          in: [PaymentStatus.SOURCE_LOCKED, PaymentStatus.STELLAR_LOCKED],
        },
        // For simplicity, we assume payments older than 1 hour are expired if not completed
        // A better way would be to store the actual timelock timestamp
        createdAt: {
          lt: new Date(now.getTime() - 3600 * 1000),
        },
      },
    });
  }
}
