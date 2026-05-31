import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLinkDto } from './dto/create-link.dto.js';

/**
 * Canonical link state surfaced to clients. Derived from the underlying
 * `active` flag, `expiresAt`, and `usedCount` so consumers don't have to
 * recompute. Matches the `LinkStatus` union in `@useroutr/types`.
 */
export type LinkStatus = 'active' | 'expired' | 'deactivated';

// qrcode is CJS — typed require keeps the import lean (no full namespace).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode') as {
  toDataURL(text: string): Promise<string>;
};

const BASE_URL =
  process.env.PAYMENT_LINK_BASE_URL ?? 'https://pay.useroutr.com';
const SHORT_CODE_LENGTH = 8;
const SHORT_CODE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MAX_SHORT_CODE_ATTEMPTS = 10;

/**
 * Payment-link domain service. Owns CRUD against `PaymentLink` plus the
 * public-facing `resolve` flow that the checkout app calls when a customer
 * lands on `pay.useroutr.com/{shortCode}`.
 *
 * All write paths that touch `usedCount` use atomic conditional updates so
 * single-use links can't double-charge under concurrent payment attempts.
 */
@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  /* ────────────────────────────────────────── Merchant-facing CRUD ─────────────────────────── */

  async create(merchantId: string, dto: CreateLinkDto) {
    const shortCode = await this.generateUniqueShortCode();
    const url = `${BASE_URL}/${shortCode}`;
    const qrCodeUrl = await QRCode.toDataURL(url);

    const link = await this.prisma.paymentLink.create({
      data: {
        merchantId,
        shortCode,
        amount: dto.amount ?? null,
        currency: dto.currency,
        description: dto.description ?? null,
        singleUse: dto.single_use,
        expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
        qrCodeUrl,
      },
    });

    return this.formatLink(link, url);
  }

  /**
   * Get a link the calling merchant owns. Scoped by merchant so two
   * tenants can't enumerate each other's link IDs.
   */
  async getById(merchantId: string, linkId: string) {
    const link = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Payment link not found');
    if (link.merchantId !== merchantId) {
      // 404 rather than 403 so we don't confirm a foreign link exists.
      throw new NotFoundException('Payment link not found');
    }

    return this.formatLink(link, this.urlFor(link.shortCode));
  }

  async getByMerchant(
    merchantId: string,
    filters?: { page?: number; limit?: number; status?: LinkStatus | 'all' },
  ) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Translate the derived `status` filter back to underlying columns so
    // pagination + count stay correct. `active` / `expired` / `deactivated`
    // map to: (active=true AND not-yet-expired) / (active=true AND expired)
    // / (active=false). The dashboard sends `status=all` for "no filter."
    const now = new Date();
    const where: Prisma.PaymentLinkWhereInput = { merchantId };
    if (filters?.status === 'active') {
      where.active = true;
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    } else if (filters?.status === 'expired') {
      where.active = true;
      where.expiresAt = { lt: now };
    } else if (filters?.status === 'deactivated') {
      where.active = false;
    }

    const [links, total] = await Promise.all([
      this.prisma.paymentLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentLink.count({ where }),
    ]);

    return {
      data: links.map((l) => this.formatLink(l, this.urlFor(l.shortCode))),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async deactivate(merchantId: string, linkId: string) {
    // Single round-trip + scope check via `where`. If the merchant doesn't
    // own the link (or it doesn't exist), updateMany returns count:0 and we
    // throw NotFound — same opaque error as getById, no info leak.
    const result = await this.prisma.paymentLink.updateMany({
      where: { id: linkId, merchantId },
      data: { active: false },
    });

    if (result.count === 0) {
      throw new NotFoundException('Payment link not found');
    }

    const updated = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
    });
    return this.formatLink(updated!, this.urlFor(updated!.shortCode));
  }

  /* ────────────────────────────────────────── Customer / public flow ───────────────────────── */

  /**
   * Public-facing resolve. Called by the hosted checkout app when a
   * customer lands on `pay.useroutr.com/{shortCode}`. Returns the
   * minimum information needed to render the payment page — never the
   * internal id, never anything that would let a stranger enumerate.
   *
   * Side effect: increments view count. We accept that bots and
   * refreshes will inflate the counter; cleaner attribution waits for
   * a proper analytics module.
   */
  async resolve(shortCode: string) {
    const link = await this.prisma.paymentLink.findUnique({
      where: { shortCode },
      include: {
        merchant: {
          select: {
            name: true,
            companyName: true,
            logoUrl: true,
            brandColor: true,
          },
        },
      },
    });

    if (!link) throw new NotFoundException('Payment link not found');
    if (!link.active) {
      throw new GoneException('This payment link is no longer active');
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('This payment link has expired');
    }
    if (link.singleUse && link.usedCount > 0) {
      throw new GoneException('This payment link has already been used');
    }

    await this.prisma.paymentLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: this.formatId(link.id),
      amount: link.amount ? Number(link.amount) : null,
      currency: link.currency,
      description: link.description,
      singleUse: link.singleUse,
      expiresAt: link.expiresAt,
      merchantName: link.merchant.name,
      // Branding fields powering the hosted checkout. `companyName` may
      // differ from `name` (the legal entity vs the customer-facing brand);
      // checkout falls back to `name` when `companyName` is unset.
      merchantCompanyName: link.merchant.companyName,
      merchantLogo: link.merchant.logoUrl,
      merchantBrandColor: link.merchant.brandColor,
    };
  }

  /**
   * Mark a link as used by a successful payment. Atomic against the
   * `singleUse` constraint: if two payments race for the same single-use
   * link, only one wins. The loser sees a `ForbiddenException` so the
   * caller can refund the user.
   *
   * Returns the updated `usedCount` so the payment processor can decide
   * what to do with the second one (refund / error to user / etc.).
   */
  async markUsed(linkId: string, paymentId: string): Promise<number> {
    // Conditional update — `singleUse=false OR usedCount=0`. Postgres
    // serializes this under READ COMMITTED so the first writer wins.
    const result = await this.prisma.paymentLink.updateMany({
      where: {
        id: linkId,
        OR: [{ singleUse: false }, { usedCount: 0 }],
      },
      data: { usedCount: { increment: 1 } },
    });

    if (result.count === 0) {
      // Either the link doesn't exist, or it's a single-use link that
      // already had a payment. Distinguish for the caller.
      const link = await this.prisma.paymentLink.findUnique({
        where: { id: linkId },
        select: { id: true, singleUse: true, usedCount: true },
      });
      if (!link) throw new NotFoundException('Payment link not found');
      throw new ForbiddenException(
        'This single-use payment link has already been used',
      );
    }

    // Associate the payment with the link. Done after the count update so
    // the constraint check runs first — if the link is exhausted we don't
    // touch the payment row.
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { linkId },
    });

    const updated = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
      select: { usedCount: true },
    });
    return updated?.usedCount ?? 0;
  }

  /* ────────────────────────────────────────── Stats / reporting ────────────────────────────── */

  async getStats(merchantId: string, linkId: string) {
    const link = await this.prisma.paymentLink.findFirst({
      where: { id: linkId, merchantId },
    });

    if (!link) throw new NotFoundException('Payment link not found');

    const payments = await this.prisma.payment.findMany({
      where: { linkId, status: 'COMPLETED' },
      select: { destAmount: true },
    });

    const totalPayments = payments.length;
    const totalRevenue = payments.reduce(
      (sum, p) => sum + Number(p.destAmount),
      0,
    );
    const conversionRate =
      link.viewCount > 0 ? (totalPayments / link.viewCount) * 100 : 0;

    return {
      linkId: this.formatId(link.id),
      totalViews: link.viewCount,
      totalPayments,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalRevenue,
      currency: link.currency,
    };
  }

  /* ────────────────────────────────────────── Webhook fan-out ──────────────────────────────── */

  /**
   * Queue a `link.paid` event for the webhooks worker to deliver. The row
   * lands in `WebhookEvent` with `status: PENDING`; the BullMQ relay picks
   * it up and POSTs to the merchant's configured endpoint.
   *
   * Named `queueLinkPaidEvent` rather than `fireWebhook` so callers don't
   * mistake "we wrote a row" for "we delivered the HTTP call".
   */
  async queueLinkPaidEvent(
    merchantId: string,
    linkId: string,
    paymentId: string,
  ): Promise<void> {
    const link = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
    });
    if (!link) return;

    await this.prisma.webhookEvent.create({
      data: {
        merchantId,
        paymentId,
        eventType: 'link.paid',
        payload: {
          linkId: this.formatId(linkId),
          paymentId,
          currency: link.currency,
          amount: link.amount ? Number(link.amount) : null,
        },
        status: 'PENDING',
      },
    });
  }

  /* ────────────────────────────────────────── Internals ─────────────────────────────────────── */

  private urlFor(shortCode: string): string {
    return `${BASE_URL}/${shortCode}`;
  }

  /**
   * Shape sent to all clients. Matches the `PaymentLink` interface in
   * `@useroutr/types` exactly: camelCase, ISO date strings, derived
   * `status` and `type` so consumers don't reimplement the state machine.
   */
  private formatLink(
    link: {
      id: string;
      shortCode: string;
      amount: unknown;
      currency: string;
      description: string | null;
      singleUse: boolean;
      usedCount: number;
      expiresAt: Date | null;
      active: boolean;
      createdAt: Date;
      updatedAt?: Date;
      qrCodeUrl: string | null;
    },
    url: string,
  ) {
    return {
      id: this.formatId(link.id),
      url,
      qrCodeUrl: link.qrCodeUrl,
      amount: link.amount ? Number(link.amount) : undefined,
      currency: link.currency,
      description: link.description ?? undefined,
      type: link.singleUse ? ('single-use' as const) : ('multi-use' as const),
      status: this.computeStatus(link),
      usageCount: link.usedCount,
      expiresAt: link.expiresAt?.toISOString(),
      createdAt: link.createdAt.toISOString(),
      updatedAt: (link.updatedAt ?? link.createdAt).toISOString(),
    };
  }

  /**
   * Derive the canonical `status` from the underlying columns:
   *
   *   - `deactivated`: merchant turned the link off (active=false)
   *   - `expired`:     past its `expiresAt`
   *   - `active`:      everything else (including single-use links that
   *                    haven't been claimed yet — the 410 enforcement in
   *                    `resolve` is a runtime concern, not a status one)
   */
  private computeStatus(link: {
    active: boolean;
    expiresAt: Date | null;
  }): LinkStatus {
    if (!link.active) return 'deactivated';
    if (link.expiresAt && link.expiresAt < new Date()) return 'expired';
    return 'active';
  }

  private formatId(id: string): string {
    return `lnk_${id}`;
  }

  /**
   * 8 chars from a 62-symbol alphabet = 218 trillion combinations. Collision
   * probability at our likely scale (< 1M links) is astronomically small,
   * but the retry loop is here for completeness.
   */
  private async generateUniqueShortCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt++) {
      const code = this.randomShortCode();
      const existing = await this.prisma.paymentLink.findUnique({
        where: { shortCode: code },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique short code');
  }

  private randomShortCode(): string {
    const bytes = crypto.randomBytes(SHORT_CODE_LENGTH);
    return Array.from(bytes)
      .map((b) => SHORT_CODE_CHARS[b % SHORT_CODE_CHARS.length])
      .join('');
  }
}
