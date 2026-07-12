import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ConfigService } from '@nestjs/config';

export const INVOICE_REMINDER_QUEUE = 'invoice-reminders';

export type ReminderType = 'before_due' | 'on_due' | 'after_due';

export interface ReminderJobData {
  invoiceId: string;
  merchantId: string;
  reminderType: ReminderType;
}

// Statuses that still need reminders (invoice hasn't been settled)
const PENDING_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

@Injectable()
@Processor(INVOICE_REMINDER_QUEUE)
export class InvoicesReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicesReminderProcessor.name);
  private readonly apiUrl: string;
  private readonly checkoutUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
    private readonly config: ConfigService,
  ) {
    super();
    this.apiUrl = this.config.get<string>('API_URL', 'http://localhost:3333');
    this.checkoutUrl = this.config.get<string>(
      'CHECKOUT_URL',
      'http://localhost:3002',
    );
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { invoiceId, merchantId, reminderType } = job.data;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      this.logger.warn(`Reminder skipped — invoice ${invoiceId} not found`);
      return;
    }

    // Skip if already settled
    if (!PENDING_STATUSES.includes(invoice.status)) {
      this.logger.log(
        `Reminder skipped — invoice ${invoiceId} status: ${invoice.status}`,
      );
      return;
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        name: true,
        email: true,
        logoUrl: true,
        brandColor: true,
        companyName: true,
      },
    });

    if (!merchant) return;

    const amountDue =
      Number(invoice.total.toString()) - Number(invoice.amountPaid.toString());

    const invoiceEmailData = {
      id: invoice.id,
      reference: invoice.invoiceNumber ?? invoice.id,
      amount: amountDue,
      currency: invoice.currency,
      dueDate: invoice.dueDate ?? new Date(),
      merchantName: merchant.companyName ?? merchant.name,
      merchantEmail: merchant.email,
      merchantLogo: merchant.logoUrl ?? undefined,
      merchantBrandColor: merchant.brandColor ?? undefined,
      customerName: invoice.customerName ?? undefined,
      checkoutUrl: `${this.checkoutUrl}/invoice/${invoice.id}`,
    };

    // ── after_due: mark OVERDUE + fire webhook ─────────────────────────────
    if (reminderType === 'after_due') {
      if (invoice.status !== InvoiceStatus.OVERDUE) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.OVERDUE },
        });

        await this.webhooks.dispatch(merchantId, 'invoice.overdue', {
          invoiceId,
          customerEmail: invoice.customerEmail,
          total: Number(invoice.total.toString()),
          amountPaid: Number(invoice.amountPaid.toString()),
          currency: invoice.currency,
          dueDate: invoice.dueDate?.toISOString(),
        });

        this.logger.log(`Invoice ${invoiceId} marked OVERDUE`);
      }
    }

    // ── Send reminder email for all types ──────────────────────────────────
    try {
      await this.notifications.sendInvoiceReminder(
        invoice.customerEmail,
        invoiceEmailData as Parameters<
          NotificationsService['sendInvoiceReminder']
        >[1],
      );
      this.logger.log(
        `Sent ${reminderType} reminder for invoice ${invoiceId} to ${invoice.customerEmail}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send ${reminderType} reminder for invoice ${invoiceId}`,
        err,
      );
      throw err; // let BullMQ retry
    }
  }
}
