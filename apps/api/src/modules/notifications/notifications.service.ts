import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Notification, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { EventsService } from '../events/events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailJobData,
  Invoice as EmailInvoice,
  Payment as EmailPayment,
  Payout as EmailPayout,
} from './types';
import * as templates from './templates';

interface NotificationListOptions {
  limit?: number;
  cursor?: string;
}

interface CreateNotificationInput {
  merchantId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue | null;
}

function formatCurrency(amount: number | string, currency = 'USD'): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return String(amount);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

@Injectable()
export class NotificationsService {
  private readonly appUrl: string;

  constructor(
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue<EmailJobData>,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {
    this.appUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
  }

  private async dispatch(data: EmailJobData) {
    if (!data.subject || !data.to || !data.html) {
      throw new Error('Missing required email data');
    }

    await this.notificationsQueue.add('sendEmail', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        merchantId: input.merchantId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.metadata !== undefined
          ? { metadata: input.metadata ?? Prisma.JsonNull }
          : {}),
      },
    });

    this.eventsService.emitNotificationCreated(input.merchantId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata ?? undefined,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async listNotifications(
    merchantId: string,
    options: NotificationListOptions = {},
  ) {
    const take = Math.min(Math.max(options.limit ?? 50, 1), 50);

    let createdAtCursor: Date | undefined;
    if (options.cursor) {
      const cursorItem = await this.prisma.notification.findFirst({
        where: {
          id: options.cursor,
          merchantId,
        },
        select: { createdAt: true },
      });

      createdAtCursor = cursorItem?.createdAt;
    }

    const where: Prisma.NotificationWhereInput = {
      merchantId,
      ...(createdAtCursor ? { createdAt: { lt: createdAtCursor } } : {}),
    };

    const [items, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.notification.count({
        where: {
          merchantId,
          read: false,
        },
      }),
      this.prisma.notification.count({ where: { merchantId } }),
    ]);

    return {
      data: items,
      meta: {
        total,
        limit: take,
        unreadCount,
        nextCursor: items.length === take ? items[items.length - 1]?.id : null,
      },
    };
  }

  async markAsRead(merchantId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, merchantId },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.read) {
      return existing;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(merchantId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        merchantId,
        read: false,
      },
      data: { read: true },
    });

    return {
      updatedCount: result.count,
    };
  }

  async notifyPaymentReceived(
    merchantId: string,
    paymentId: string,
    amount: number | string,
    currency = 'USD',
    customerEmail?: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'payment.received',
      title: 'Payment received',
      body: `${formatCurrency(amount, currency)}${customerEmail ? ` from ${customerEmail}` : ''}`,
      metadata: {
        paymentId,
        amount: String(amount),
        currency,
        ...(customerEmail ? { customerEmail } : {}),
      },
    });
  }

  async notifyPayoutCompleted(
    merchantId: string,
    payoutId: string,
    recipientName: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'payout.completed',
      title: 'Payout completed',
      body: `Payout to ${recipientName} completed`,
      metadata: {
        payoutId,
        recipientName,
      },
    });
  }

  async notifyPayoutFailed(
    merchantId: string,
    payoutId: string,
    recipientName: string,
    failureReason?: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'payout.failed',
      title: 'Payout failed',
      body: failureReason
        ? `Payout to ${recipientName} failed: ${failureReason}`
        : `Payout to ${recipientName} failed`,
      metadata: {
        payoutId,
        recipientName,
        ...(failureReason ? { failureReason } : {}),
      },
    });
  }

  async notifyInvoicePaid(
    merchantId: string,
    invoiceId: string,
    invoiceNumber?: string | null,
  ) {
    return this.createNotification({
      merchantId,
      type: 'invoice.paid',
      title: 'Invoice paid',
      body: `Invoice ${invoiceNumber ? `#${invoiceNumber}` : ''} marked as paid`.trim(),
      metadata: {
        invoiceId,
        ...(invoiceNumber ? { invoiceNumber } : {}),
      },
    });
  }

  async notifyRefundInitiated(merchantId: string, paymentId: string) {
    return this.createNotification({
      merchantId,
      type: 'refund.initiated',
      title: 'Refund initiated',
      body: 'A refund has been started for one of your payments.',
      metadata: { paymentId },
    });
  }

  async notifyTeamMemberJoined(
    merchantId: string,
    email: string,
    role: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'team.member_joined',
      title: 'Team member joined',
      body: `${email} was added to your team as ${role.toLowerCase()}.`,
      metadata: { email, role },
    });
  }

  async notifyApiKeyCreated(
    merchantId: string,
    keyId: string,
    keyName: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'api_key.created',
      title: 'API key created',
      body: `API key '${keyName}' was created successfully.`,
      metadata: { apiKeyId: keyId, keyName },
    });
  }

  async notifyWebhookFailed(
    merchantId: string,
    webhookUrl: string,
    eventType?: string,
    eventId?: string,
  ) {
    return this.createNotification({
      merchantId,
      type: 'webhook.failed',
      title: 'Webhook failed',
      body: `Webhook delivery to ${webhookUrl} failed`,
      metadata: {
        webhookUrl,
        ...(eventType ? { eventType } : {}),
        ...(eventId ? { eventId } : {}),
      },
    });
  }

  // Auth emails
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    await this.dispatch({
      to: email,
      subject: 'Verify your email',
      html: templates.verificationTemplate(token, this.appUrl),
    });
  }

  async sendVerificationCodeEmail(email: string, code: string): Promise<void> {
    await this.dispatch({
      to: email,
      subject: `Your Useroutr verification code: ${code}`,
      html: templates.verificationCodeTemplate(code, this.appUrl),
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    await this.dispatch({
      to: email,
      subject: 'Reset your password',
      html: templates.passwordResetTemplate(token, this.appUrl),
    });
  }

  // Team
  async sendTeamInvite(
    email: string,
    merchantName: string,
    inviteLink: string,
  ): Promise<void> {
    await this.dispatch({
      to: email,
      subject: `You've been invited to ${merchantName}`,
      html: templates.teamInviteTemplate(merchantName, inviteLink),
    });
  }

  // Payments
  async sendPaymentReceipt(
    customerEmail: string,
    payment: EmailPayment,
  ): Promise<void> {
    await this.dispatch({
      to: customerEmail,
      subject: `Payment Receipt for ${payment.merchantName}`,
      html: templates.paymentReceiptTemplate(payment),
    });
  }

  async sendPaymentNotification(
    merchantEmail: string,
    payment: EmailPayment,
  ): Promise<void> {
    await this.dispatch({
      to: merchantEmail,
      subject: 'New Payment Received',
      html: templates.merchantPaymentNotificationTemplate(payment),
    });
  }

  // Invoices
  async sendInvoice(
    customerEmail: string,
    invoice: EmailInvoice,
    pdfBuffer: Buffer,
  ): Promise<void> {
    await this.dispatch({
      to: customerEmail,
      subject: `Invoice ${invoice.reference ?? invoice.id} is available`,
      html: templates.invoiceTemplate(invoice, this.appUrl),
      attachments: [
        {
          filename: `invoice-${invoice.reference ?? invoice.id}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });
  }

  async sendInvoiceReminder(
    customerEmail: string,
    invoice: EmailInvoice,
  ): Promise<void> {
    const now = new Date();
    const diff = Math.ceil(
      (invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dueLabel =
      diff <= 0
        ? 'overdue'
        : diff === 1
          ? 'due tomorrow'
          : `due in ${diff} days`;

    await this.dispatch({
      to: customerEmail,
      subject: `Your invoice is ${dueLabel}`,
      html: templates.invoiceReminderTemplate(invoice, this.appUrl),
    });
  }

  // Payouts
  async sendPayoutConfirmation(
    merchantEmail: string,
    payout: EmailPayout,
  ): Promise<void> {
    await this.dispatch({
      to: merchantEmail,
      subject: 'Payout Confirmation',
      html: templates.payoutConfirmationTemplate(payout),
    });
  }
}
