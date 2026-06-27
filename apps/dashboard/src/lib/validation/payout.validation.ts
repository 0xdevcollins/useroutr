import { z } from "zod";

// ── Destination sub-schemas ────────────────────────────────────────────────────

const BankAccountDestSchema = z.object({
  type: z.literal("BANK_ACCOUNT"),
  accountNumber: z.string().min(1, "Account number is required").max(64),
  routingNumber: z.string().max(20).optional(),
  bankName: z.string().max(255).optional(),
  iban: z.string().max(34).optional(),
  bic: z.string().max(11).optional(),
  branchCode: z.string().max(20).optional(),
  country: z.string().length(2, "Country must be a 2-letter code").toUpperCase(),
});

const MobileMoneyDestSchema = z.object({
  type: z.literal("MOBILE_MONEY"),
  phoneNumber: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long"),
  provider: z.string().min(1, "Provider is required").max(100),
  country: z.string().length(2, "Country must be a 2-letter code").toUpperCase(),
});

const CryptoWalletDestSchema = z.object({
  type: z.literal("CRYPTO_WALLET"),
  address: z
    .string()
    .min(1, "Wallet address is required")
    .max(255)
    .refine(
      (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
      "Invalid EVM address format"
    ),
  network: z.string().min(1, "Network is required").max(50),
  asset: z.string().min(1, "Asset is required").max(50),
});

const StellarDestSchema = z.object({
  type: z.literal("STELLAR"),
  address: z
    .string()
    .min(1, "Stellar address is required")
    .max(255)
    .startsWith("G", "Stellar address must start with G"),
  asset: z.string().min(1, "Asset is required").max(50).default("native"),
  memo: z.string().max(28, "Memo must be 28 characters or less").optional(),
});

const DestinationSchema = z.discriminatedUnion("type", [
  BankAccountDestSchema,
  MobileMoneyDestSchema,
  CryptoWalletDestSchema,
  StellarDestSchema,
]);

// ── Create single payout ───────────────────────────────────────────────────────

export const CreatePayoutSchema = z.object({
  recipientId: z.string().optional(),
  recipientName: z.string().min(1, "Recipient name is required").max(255),
  destinationType: z.enum([
    "BANK_ACCOUNT",
    "MOBILE_MONEY",
    "CRYPTO_WALLET",
    "STELLAR",
  ]),
  destination: DestinationSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/, "Amount must be a valid decimal number")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
  currency: z.string().length(3, "Currency must be 3 characters").toUpperCase(),
  scheduledAt: z.coerce.date().optional(),
});

export type CreatePayoutDto = z.infer<typeof CreatePayoutSchema>;

// ── Recipient validation ───────────────────────────────────────────────────────

export const CreateRecipientSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: z.enum(["BANK_ACCOUNT", "MOBILE_MONEY", "CRYPTO_WALLET", "STELLAR"]),
  details: DestinationSchema,
  isDefault: z.boolean().optional(),
});

export type CreateRecipientDto = z.infer<typeof CreateRecipientSchema>;

// ── Fee estimation query validation ───────────────────────────────────────────

export const FeeEstimationSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/, "Invalid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive"),
  currency: z.string().length(3).toUpperCase(),
  destinationType: z.enum([
    "BANK_ACCOUNT",
    "MOBILE_MONEY",
    "CRYPTO_WALLET",
    "STELLAR",
  ]),
});

export type FeeEstimationDto = z.infer<typeof FeeEstimationSchema>;

// ── Utility validators ───────────────────────────────────────────────────────

export const validateBankAccount = (data: unknown) => {
  return BankAccountDestSchema.safeParse(data);
};

export const validateMobileMoney = (data: unknown) => {
  return MobileMoneyDestSchema.safeParse(data);
};

export const validateCryptoWallet = (data: unknown) => {
  return CryptoWalletDestSchema.safeParse(data);
};

export const validateStellar = (data: unknown) => {
  return StellarDestSchema.safeParse(data);
};

export const validatePayout = (data: unknown) => {
  return CreatePayoutSchema.safeParse(data);
};

export const validateRecipient = (data: unknown) => {
  return CreateRecipientSchema.safeParse(data);
};
