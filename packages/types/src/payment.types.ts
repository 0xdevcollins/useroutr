export interface Payment {
	id: string;
	merchantId?: string;
	amount: bigint | number | string;
	currency?: string;
	status?: string;
	createdAt?: string;
}

export type PaymentStatus =
	| 'PENDING'
	| 'QUOTE_LOCKED'
	| 'SOURCE_LOCKED'
	| 'STELLAR_LOCKED'
	| 'PROCESSING'
	| 'COMPLETED'
	| 'REFUNDING'
	| 'REFUNDED'
	| 'EXPIRED'
	| 'FAILED';

/* ── Payment Links ── */

export type LinkType = 'single-use' | 'multi-use';
export type LinkStatus = 'active' | 'expired' | 'deactivated';

export interface PaymentLink {
	id: string;
	amount?: number;
	currency: string;
	description?: string;
	type: LinkType;
	status: LinkStatus;
	usageCount: number;
	expiresAt?: string;
	url: string;
	qrCodeUrl?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PaymentLinkStats {
	usageCount: number;
	totalAmount: number;
	lastPaymentAt?: string;
}

// Matches backend CreateLinkDto
export interface CreatePaymentLinkInput {
	amount?: number;
	currency?: string;
	description?: string;
	single_use?: boolean;
	expires_at?: string;
}

/**
 * Pagination envelope shared by the paginated list endpoints.
 *
 * The API's TransformInterceptor treats a `{ data, meta }` payload as already
 * wrapped and passes it through untouched, so this is exactly what a client
 * receives — `meta` is a sibling of `data`, not flattened alongside it.
 */
export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

/**
 * Response of `GET /v1/payment-links`.
 *
 * This previously declared `total`, `page` and `limit` as siblings of `data`,
 * which is not a shape the API has ever sent. Nothing caught it because the one
 * consumer read `.data` off it and never touched the counts — so pagination had
 * nothing to render from.
 */
export interface PaymentLinksResponse {
	data: PaymentLink[];
	meta: PaginationMeta;
}

export default {};
