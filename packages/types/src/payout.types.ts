export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type DestType = 'BANK_ACCOUNT' | 'MOBILE_MONEY' | 'CRYPTO_WALLET' | 'STELLAR';

export interface Recipient {
  id: string;
  merchantId: string;
  name: string;
  type: 'BANK_ACCOUNT' | 'MOBILE_MONEY' | 'CRYPTO_WALLET' | 'STELLAR';
  details: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payout {
	id: string;
	merchantId: string;
	recipientId?: string | null;
	recipientName: string;
	destinationType: DestType;
	destination: Record<string, any>;
	amount: string;
	currency: string;
	status: PayoutStatus;
	stellarTxHash: string | null;
	scheduledAt: string | null;
	completedAt: string | null;
	failureReason: string | null;
	batchId: string | null;
	idempotencyKey: string | null;
	createdAt: string;
}

export interface PayoutListResponse {
  total: number;
  limit: number;
  offset: number;
  data: Payout[];
}

export interface PayoutFilters {
  status?: PayoutStatus;
  destinationType?: DestType;
  currency?: string;
  dateFrom?: Date;
  dateTo?: Date;
  batchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BatchSummary {
  batchId: string;
  totalPayouts: number;
  totalAmount: number;
  currency: string;
  statusCounts: Record<PayoutStatus, number>;
}

export default {};
