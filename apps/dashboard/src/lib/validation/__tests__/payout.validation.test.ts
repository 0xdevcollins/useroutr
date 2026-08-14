import {
  validateBankAccount,
  validateMobileMoney,
  validateCryptoWallet,
  validateStellar,
  validatePayout,
  validateRecipient,
} from "../payout.validation";

describe("Payout Validation", () => {
  describe("Bank Account Validation", () => {
    it("should validate correct bank account", () => {
      const result = validateBankAccount({
        type: "BANK_ACCOUNT",
        accountNumber: "123456789",
        country: "US",
      });

      expect(result.success).toBe(true);
    });

    it("should reject missing account number", () => {
      const result = validateBankAccount({
        type: "BANK_ACCOUNT",
        country: "US",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("accountNumber");
      }
    });

    it("should reject invalid country code", () => {
      const result = validateBankAccount({
        type: "BANK_ACCOUNT",
        accountNumber: "123456789",
        country: "USA", // Should be 2 chars
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("country");
      }
    });

    it("should accept optional fields", () => {
      const result = validateBankAccount({
        type: "BANK_ACCOUNT",
        accountNumber: "123456789",
        routingNumber: "021000021",
        bankName: "Chase",
        iban: "DE89370400440532013000",
        country: "DE",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Mobile Money Validation", () => {
    it("should validate correct mobile money", () => {
      const result = validateMobileMoney({
        type: "MOBILE_MONEY",
        phoneNumber: "+233500000000",
        provider: "MTN",
        country: "GH",
      });

      expect(result.success).toBe(true);
    });

    it("should reject missing phone number", () => {
      const result = validateMobileMoney({
        type: "MOBILE_MONEY",
        provider: "MTN",
        country: "GH",
      });

      expect(result.success).toBe(false);
    });

    it("should reject short phone number", () => {
      const result = validateMobileMoney({
        type: "MOBILE_MONEY",
        phoneNumber: "123", // Too short
        provider: "MTN",
        country: "GH",
      });

      expect(result.success).toBe(false);
    });

    it("should accept various providers", () => {
      const providers = ["MTN", "MPESA", "AIRTEL", "VODAFONE"];

      providers.forEach((provider) => {
        const result = validateMobileMoney({
          type: "MOBILE_MONEY",
          phoneNumber: "+233500000000",
          provider,
          country: "GH",
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Crypto Wallet Validation", () => {
    it("should validate correct EVM address", () => {
      const result = validateCryptoWallet({
        type: "CRYPTO_WALLET",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42e57",
        network: "ethereum",
        asset: "USDC",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid EVM address format", () => {
      const result = validateCryptoWallet({
        type: "CRYPTO_WALLET",
        address: "742d35Cc6634C0532925a3b844Bc9e7595f42e57", // Missing 0x
        network: "ethereum",
        asset: "USDC",
      });

      expect(result.success).toBe(false);
    });

    it("should reject address with wrong length", () => {
      const result = validateCryptoWallet({
        type: "CRYPTO_WALLET",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42e", // Too short
        network: "ethereum",
        asset: "USDC",
      });

      expect(result.success).toBe(false);
    });

    it("should validate various networks", () => {
      const networks = ["ethereum", "polygon", "arbitrum", "optimism"];

      networks.forEach((network) => {
        const result = validateCryptoWallet({
          type: "CRYPTO_WALLET",
          address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42e57",
          network,
          asset: "USDC",
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Stellar Validation", () => {
    it("should validate correct Stellar address", () => {
      const result = validateStellar({
        type: "STELLAR",
        address:
          "GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N",
        asset: "native",
      });

      expect(result.success).toBe(true);
    });

    it("should reject address not starting with G", () => {
      const result = validateStellar({
        type: "STELLAR",
        address: "ABNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N",
        asset: "native",
      });

      expect(result.success).toBe(false);
    });

    it("should accept optional memo", () => {
      const result = validateStellar({
        type: "STELLAR",
        address:
          "GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N",
        asset: "native",
        memo: "Payment for invoice 123",
      });

      expect(result.success).toBe(true);
    });

    it("should reject memo exceeding 28 characters", () => {
      const result = validateStellar({
        type: "STELLAR",
        address:
          "GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N",
        asset: "native",
        memo: "This is a very long memo that exceeds the maximum length allowed",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Full Payout Validation", () => {
    it("should validate complete bank payout", () => {
      const result = validatePayout({
        recipientName: "John Doe",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        amount: "100.50",
        currency: "USD",
      });

      expect(result.success).toBe(true);
    });

    it("should validate complete mobile money payout", () => {
      const result = validatePayout({
        recipientName: "Jane Smith",
        destinationType: "MOBILE_MONEY",
        destination: {
          type: "MOBILE_MONEY",
          phoneNumber: "+233500000000",
          provider: "MTN",
          country: "GH",
        },
        amount: "50.00",
        currency: "GHS",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid amount", () => {
      const result = validatePayout({
        recipientName: "John Doe",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        amount: "-100", // Negative
        currency: "USD",
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid currency code", () => {
      const result = validatePayout({
        recipientName: "John Doe",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        amount: "100",
        currency: "USDA", // Invalid length
      });

      expect(result.success).toBe(false);
    });

    it("should accept optional recipientId", () => {
      const result = validatePayout({
        recipientId: "existing-recipient-id",
        recipientName: "John Doe",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        amount: "100",
        currency: "USD",
      });

      expect(result.success).toBe(true);
    });

    it("should accept optional scheduledAt", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const result = validatePayout({
        recipientName: "John Doe",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        amount: "100",
        currency: "USD",
        scheduledAt: futureDate.toISOString(),
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Recipient Validation", () => {
    it("should validate bank account recipient", () => {
      const result = validateRecipient({
        name: "John Doe",
        type: "BANK_ACCOUNT",
        details: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
      });

      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = validateRecipient({
        name: "",
        type: "BANK_ACCOUNT",
        details: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
      });

      expect(result.success).toBe(false);
    });

    it("should accept optional isDefault flag", () => {
      const result = validateRecipient({
        name: "John Doe",
        type: "BANK_ACCOUNT",
        details: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789",
          country: "US",
        },
        isDefault: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Amount Format Validation", () => {
    it("should accept valid decimal amounts", () => {
      const validAmounts = [
        "100",
        "100.50",
        "0.01",
        "1000000.123456789",
      ];

      validAmounts.forEach((amount) => {
        const result = validatePayout({
          recipientName: "John",
          destinationType: "BANK_ACCOUNT",
          destination: {
            type: "BANK_ACCOUNT",
            accountNumber: "123",
            country: "US",
          },
          amount,
          currency: "USD",
        });

        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid amount formats", () => {
      const invalidAmounts = [
        "-100",
        "0",
        "100.999999999999999999", // Too many decimals
        "abc",
        "100,50", // Comma separator
      ];

      invalidAmounts.forEach((amount) => {
        const result = validatePayout({
          recipientName: "John",
          destinationType: "BANK_ACCOUNT",
          destination: {
            type: "BANK_ACCOUNT",
            accountNumber: "123",
            country: "US",
          },
          amount,
          currency: "USD",
        });

        expect(result.success).toBe(false);
      });
    });
  });

  describe("Discriminated Union Type Checking", () => {
    it("should match destination type with payload type", () => {
      const result = validatePayout({
        recipientName: "John",
        destinationType: "MOBILE_MONEY",
        destination: {
          type: "MOBILE_MONEY",
          phoneNumber: "+233500000000",
          provider: "MTN",
          country: "GH",
        },
        amount: "100",
        currency: "GHS",
      });

      expect(result.success).toBe(true);
    });

    it("should reject mismatched destination type", () => {
      const result = validatePayout({
        recipientName: "John",
        destinationType: "BANK_ACCOUNT",
        destination: {
          type: "MOBILE_MONEY", // Mismatch
          phoneNumber: "+233500000000",
          provider: "MTN",
          country: "GH",
        } as any,
        amount: "100",
        currency: "GHS",
      });

      expect(result.success).toBe(false);
    });
  });
});
