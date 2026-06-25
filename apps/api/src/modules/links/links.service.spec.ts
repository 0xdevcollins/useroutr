import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';

// QRCode is a side-effect import inside links.service — stub it so tests
// don't hit the qrcode native renderer. Returns a fixed data-URL.
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(async () => 'data:image/png;base64,QR'),
}));

// PrismaService is global — stub the module so we don't load the
// generated client.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';

/* ── In-memory Prisma double ────────────────────────────────────────────── */

interface FakeLink {
  id: string;
  merchantId: string;
  shortCode: string;
  amount: number | null;
  currency: string;
  description: string | null;
  singleUse: boolean;
  usedCount: number;
  viewCount: number;
  qrCodeUrl: string | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
}

interface FakePayment {
  id: string;
  linkId: string | null;
  status: string;
  destAmount: number;
}

interface FakeWebhook {
  merchantId: string;
  paymentId: string;
  eventType: string;
  payload: unknown;
  status: string;
}

// Minimal subset of Prisma's WhereInput the link service actually uses.
// The fake honors merchantId equality, active flag, expiresAt comparisons
// (gt / lt), and a top-level OR list — enough for getByMerchant's status
// filter without pulling in the full Prisma type surface.
interface WhereClause {
  merchantId?: string;
  active?: boolean;
  expiresAt?: null | { gt?: Date; lt?: Date };
  OR?: WhereClause[];
}

function matchesWhere(link: FakeLink, where?: WhereClause): boolean {
  if (!where) return true;
  if (where.merchantId !== undefined && link.merchantId !== where.merchantId)
    return false;
  if (where.active !== undefined && link.active !== where.active) return false;
  if (where.expiresAt !== undefined) {
    if (where.expiresAt === null) {
      if (link.expiresAt !== null) return false;
    } else {
      if (
        where.expiresAt.gt !== undefined &&
        !(link.expiresAt && link.expiresAt > where.expiresAt.gt)
      )
        return false;
      if (
        where.expiresAt.lt !== undefined &&
        !(link.expiresAt && link.expiresAt < where.expiresAt.lt)
      )
        return false;
    }
  }
  if (where.OR) {
    if (!where.OR.some((clause) => matchesWhere(link, clause))) return false;
  }
  return true;
}

interface FakePrisma {
  links: Map<string, FakeLink>;
  payments: Map<string, FakePayment>;
  webhooks: FakeWebhook[];

  paymentLink: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  payment: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
  webhookEvent: {
    create: jest.Mock;
  };
}

function makePrisma(): FakePrisma {
  const links = new Map<string, FakeLink>();
  const payments = new Map<string, FakePayment>();
  const webhooks: FakeWebhook[] = [];

  const fake: FakePrisma = {
    links,
    payments,
    webhooks,

    paymentLink: {
      create: jest.fn(async (args: { data: Partial<FakeLink> }) => {
        const id = args.data.id ?? `cuid_${links.size + 1}`;
        const row: FakeLink = {
          id,
          merchantId: args.data.merchantId ?? '',
          shortCode: args.data.shortCode ?? 'CODE',
          amount: args.data.amount ?? null,
          currency: args.data.currency ?? 'USD',
          description: args.data.description ?? null,
          singleUse: args.data.singleUse ?? false,
          usedCount: 0,
          viewCount: 0,
          qrCodeUrl: args.data.qrCodeUrl ?? null,
          expiresAt: args.data.expiresAt ?? null,
          active: true,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        };
        links.set(id, row);
        return row;
      }),

      findUnique: jest.fn(async (args: { where: { id?: string; shortCode?: string } }) => {
        if (args.where.id) return links.get(args.where.id) ?? null;
        if (args.where.shortCode) {
          for (const l of links.values()) {
            if (l.shortCode === args.where.shortCode) {
              return {
                ...l,
                merchant: {
                  name: 'Acme Co',
                  companyName: 'Acme Inc.',
                  logoUrl: 'https://cdn.example.com/acme-logo.png',
                  brandColor: '#ff5b1f',
                },
              };
            }
          }
        }
        return null;
      }),

      findFirst: jest.fn(async (args: { where: { id: string; merchantId: string } }) => {
        const l = links.get(args.where.id);
        if (l && l.merchantId === args.where.merchantId) return l;
        return null;
      }),

      findMany: jest.fn(
        async (args: {
          where: WhereClause;
          skip?: number;
          take?: number;
        }) => {
          const all = Array.from(links.values()).filter((l) =>
            matchesWhere(l, args.where),
          );
          const skip = args.skip ?? 0;
          const take = args.take ?? 20;
          return all.slice(skip, skip + take);
        },
      ),

      count: jest.fn(async (args: { where: WhereClause }) => {
        return Array.from(links.values()).filter((l) =>
          matchesWhere(l, args.where),
        ).length;
      }),

      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const l = links.get(args.where.id);
        if (!l) throw new Error('not found');
        // Handle viewCount/usedCount increment objects
        for (const [k, v] of Object.entries(args.data)) {
          const inc = (v as { increment?: number })?.increment;
          if (typeof inc === 'number') {
            (l as unknown as Record<string, number>)[k] =
              ((l as unknown as Record<string, number>)[k] ?? 0) + inc;
          } else {
            (l as unknown as Record<string, unknown>)[k] = v;
          }
        }
        return l;
      }),

      updateMany: jest.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const l of links.values()) {
          if (!matchesUpdateManyWhere(l, args.where)) continue;
          for (const [k, v] of Object.entries(args.data)) {
            const inc = (v as { increment?: number })?.increment;
            if (typeof inc === 'number') {
              (l as unknown as Record<string, number>)[k] =
                ((l as unknown as Record<string, number>)[k] ?? 0) + inc;
            } else {
              (l as unknown as Record<string, unknown>)[k] = v;
            }
          }
          count++;
        }
        return { count };
      }),
    },

    payment: {
      findMany: jest.fn(async (args: { where: { linkId: string; status: string } }) => {
        return Array.from(payments.values()).filter(
          (p) => p.linkId === args.where.linkId && p.status === args.where.status,
        );
      }),
      update: jest.fn(async (args: { where: { id: string }; data: { linkId: string } }) => {
        const p = payments.get(args.where.id);
        if (!p) throw new Error('payment not found');
        p.linkId = args.data.linkId;
        return p;
      }),
    },

    webhookEvent: {
      create: jest.fn(async (args: { data: FakeWebhook }) => {
        webhooks.push(args.data);
        return args.data;
      }),
    },
  };

  return fake;
}

/**
 * Mirrors the subset of Prisma's where-clause logic that the service uses:
 *  - flat equality on id / merchantId
 *  - OR array (used by the single-use guard in markUsed)
 */
function matchesUpdateManyWhere(
  link: FakeLink,
  where: Record<string, unknown>,
): boolean {
  if (where.id !== undefined && link.id !== where.id) return false;
  if (where.merchantId !== undefined && link.merchantId !== where.merchantId)
    return false;
  if (Array.isArray(where.OR)) {
    const anyMatch = (where.OR as Array<Record<string, unknown>>).some((cond) => {
      if (cond.singleUse !== undefined && link.singleUse !== cond.singleUse)
        return false;
      if (cond.usedCount !== undefined && link.usedCount !== cond.usedCount)
        return false;
      return true;
    });
    if (!anyMatch) return false;
  }
  return true;
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('LinksService', () => {
  let service: LinksService;
  let prisma: FakePrisma;

  beforeEach(() => {
    prisma = makePrisma();
    service = new LinksService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('persists a link, generates a short code, and returns the formatted url', async () => {
      const result = await service.create('merchant_1', {
        amount: 49,
        currency: 'USD',
        description: 'Pro plan',
        single_use: false,
      });

      expect(result.id).toMatch(/^lnk_/);
      expect(result.url).toMatch(/^https:\/\/pay\.useroutr\.com\/[A-Za-z0-9]{8}$/);
      expect(result.amount).toBe(49);
      expect(result.currency).toBe('USD');
      expect(result.qrCodeUrl).toBe('data:image/png;base64,QR');
      // New camelCase shape now matches @useroutr/types PaymentLink.
      expect(result.type).toBe('multi-use');
      expect(result.status).toBe('active');
      expect(result.usageCount).toBe(0);
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
      expect(prisma.links.size).toBe(1);
    });

    it('accepts an open-amount link (amount omitted)', async () => {
      const result = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      // Open-amount links omit `amount` entirely rather than emitting null —
      // matches the optional `amount?: number` in the shared type.
      expect(result.amount).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('returns the link when the merchant owns it', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const raw = created.id.slice(4); // strip lnk_

      const result = await service.getById('merchant_1', raw);
      expect(result.id).toBe(created.id);
    });

    it('throws NotFoundException when the link does not exist', async () => {
      await expect(service.getById('merchant_1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the link belongs to a different merchant (no leak)', async () => {
      const created = await service.create('merchant_A', {
        currency: 'USD',
        single_use: false,
      });
      const raw = created.id.slice(4);

      await expect(service.getById('merchant_B', raw)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getByMerchant', () => {
    it('paginates and returns meta correctly', async () => {
      for (let i = 0; i < 25; i++) {
        await service.create('merchant_1', { currency: 'USD', single_use: false });
      }

      const page1 = await service.getByMerchant('merchant_1', { page: 1, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.meta).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });

      const page3 = await service.getByMerchant('merchant_1', { page: 3, limit: 10 });
      expect(page3.data).toHaveLength(5);
    });

    it('returns empty list with zero pages for a merchant with no links', async () => {
      const result = await service.getByMerchant('empty_merchant');
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('filters by status=deactivated', async () => {
      const a = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      await service.create('merchant_1', { currency: 'USD', single_use: false });
      await service.deactivate('merchant_1', a.id.slice(4));

      const result = await service.getByMerchant('merchant_1', {
        status: 'deactivated',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('deactivated');
    });

    it('filters by status=expired (active flag true, expiresAt in the past)', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const raw = prisma.links.get(created.id.slice(4))!;
      raw.expiresAt = new Date('2020-01-01');

      const expired = await service.getByMerchant('merchant_1', {
        status: 'expired',
      });
      expect(expired.data).toHaveLength(1);
      expect(expired.data[0].status).toBe('expired');

      // Active-only filter excludes it
      const active = await service.getByMerchant('merchant_1', {
        status: 'active',
      });
      expect(active.data).toHaveLength(0);
    });
  });

  describe('deactivate', () => {
    it('marks an owned link inactive', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const raw = created.id.slice(4);

      const result = await service.deactivate('merchant_1', raw);
      expect(result.status).toBe('deactivated');
    });

    it('throws NotFoundException for a foreign merchant (no leak)', async () => {
      const created = await service.create('merchant_A', {
        currency: 'USD',
        single_use: false,
      });
      const raw = created.id.slice(4);

      await expect(
        service.deactivate('merchant_B', raw),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('returns customer-safe metadata and bumps view count', async () => {
      const created = await service.create('merchant_1', {
        amount: 25,
        currency: 'USD',
        single_use: false,
      });
      const raw = prisma.links.get(created.id.slice(4))!;

      const result = await service.resolve(raw.shortCode);
      expect(result).toMatchObject({
        amount: 25,
        currency: 'USD',
        merchantName: 'Acme Co',
        merchantCompanyName: 'Acme Inc.',
        merchantLogo: 'https://cdn.example.com/acme-logo.png',
        merchantBrandColor: '#ff5b1f',
      });

      // viewCount incremented
      expect(prisma.links.get(raw.id)!.viewCount).toBe(1);

      // We never expose the merchant id or short code internals
      expect(result).not.toHaveProperty('merchantId');
      expect(result).not.toHaveProperty('shortCode');
    });

    it('404 for missing short code', async () => {
      await expect(service.resolve('UNKNOWN1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('410 Gone when inactive', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const raw = prisma.links.get(created.id.slice(4))!;
      raw.active = false;

      await expect(service.resolve(raw.shortCode)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('410 Gone when expired', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const raw = prisma.links.get(created.id.slice(4))!;
      raw.expiresAt = new Date('2020-01-01T00:00:00Z');

      await expect(service.resolve(raw.shortCode)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('410 Gone when single-use and already consumed', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: true,
      });
      const raw = prisma.links.get(created.id.slice(4))!;
      raw.usedCount = 1;

      await expect(service.resolve(raw.shortCode)).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });

  describe('markUsed', () => {
    it('increments usedCount and associates the payment', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: false,
      });
      const link = prisma.links.get(created.id.slice(4))!;
      prisma.payments.set('pay_1', {
        id: 'pay_1',
        linkId: null,
        status: 'COMPLETED',
        destAmount: 25,
      });

      const next = await service.markUsed(link.id, 'pay_1');
      expect(next).toBe(1);
      expect(prisma.payments.get('pay_1')!.linkId).toBe(link.id);
    });

    it('blocks a second payment on a single-use link (race-safe)', async () => {
      const created = await service.create('merchant_1', {
        currency: 'USD',
        single_use: true,
      });
      const link = prisma.links.get(created.id.slice(4))!;
      prisma.payments.set('pay_1', {
        id: 'pay_1',
        linkId: null,
        status: 'COMPLETED',
        destAmount: 10,
      });
      prisma.payments.set('pay_2', {
        id: 'pay_2',
        linkId: null,
        status: 'COMPLETED',
        destAmount: 10,
      });

      await service.markUsed(link.id, 'pay_1');
      await expect(service.markUsed(link.id, 'pay_2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      // First payment is associated, second is not
      expect(prisma.payments.get('pay_1')!.linkId).toBe(link.id);
      expect(prisma.payments.get('pay_2')!.linkId).toBeNull();
      expect(prisma.links.get(link.id)!.usedCount).toBe(1);
    });

    it('throws NotFoundException for an unknown link', async () => {
      await expect(service.markUsed('missing', 'pay_x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('returns zeros when no payments exist', async () => {
      const created = await service.create('merchant_1', {
        amount: 100,
        currency: 'USD',
        single_use: false,
      });
      const link = prisma.links.get(created.id.slice(4))!;
      link.viewCount = 5;

      const stats = await service.getStats('merchant_1', link.id);
      expect(stats).toEqual({
        linkId: created.id,
        totalViews: 5,
        totalPayments: 0,
        conversionRate: 0,
        totalRevenue: 0,
        currency: 'USD',
      });
    });

    it('computes conversion rate and revenue from completed payments', async () => {
      const created = await service.create('merchant_1', {
        amount: 100,
        currency: 'USD',
        single_use: false,
      });
      const link = prisma.links.get(created.id.slice(4))!;
      link.viewCount = 10;
      prisma.payments.set('p1', {
        id: 'p1',
        linkId: link.id,
        status: 'COMPLETED',
        destAmount: 99.5,
      });
      prisma.payments.set('p2', {
        id: 'p2',
        linkId: link.id,
        status: 'COMPLETED',
        destAmount: 99.5,
      });

      const stats = await service.getStats('merchant_1', link.id);
      expect(stats.totalPayments).toBe(2);
      expect(stats.totalRevenue).toBeCloseTo(199, 2);
      expect(stats.conversionRate).toBe(20); // 2 / 10 * 100
    });

    it('throws NotFoundException for a foreign merchant', async () => {
      const created = await service.create('merchant_A', {
        currency: 'USD',
        single_use: false,
      });
      const raw = created.id.slice(4);
      await expect(
        service.getStats('merchant_B', raw),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('queueLinkPaidEvent', () => {
    it('writes a PENDING webhook row with the link.paid payload', async () => {
      const created = await service.create('merchant_1', {
        amount: 49,
        currency: 'USD',
        single_use: false,
      });
      const link = prisma.links.get(created.id.slice(4))!;

      await service.queueLinkPaidEvent('merchant_1', link.id, 'pay_42');

      expect(prisma.webhooks).toHaveLength(1);
      expect(prisma.webhooks[0]).toMatchObject({
        merchantId: 'merchant_1',
        paymentId: 'pay_42',
        eventType: 'link.paid',
        status: 'PENDING',
      });
      expect(prisma.webhooks[0].payload).toMatchObject({
        linkId: created.id,
        paymentId: 'pay_42',
        currency: 'USD',
        amount: 49,
      });
    });

    it('silently no-ops for a missing link (defensive — should never happen but caller might be stale)', async () => {
      await service.queueLinkPaidEvent('merchant_1', 'missing', 'pay_x');
      expect(prisma.webhooks).toHaveLength(0);
    });
  });
});
