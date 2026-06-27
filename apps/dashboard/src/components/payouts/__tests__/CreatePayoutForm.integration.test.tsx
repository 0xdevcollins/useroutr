import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreatePayoutForm } from "../CreatePayoutForm";

// Mock API responses
const mockPayoutResponse = {
  id: "payout-123",
  status: "PENDING",
  amount: "100",
  currency: "USD",
  createdAt: new Date().toISOString(),
};

const mockFeeResponse = {
  amount: "100",
  currency: "USD",
  fee: "0.50",
  total: "100.50",
  conversionRate: "1.0",
  feePercentage: 0.5,
};

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock("@/components/recipients/RecipientSelect", () => ({
  RecipientSelect: ({ value, onValueChange }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="recipient-select"
    >
      <option value="">Select recipient</option>
      <option value="recipient-1">John Doe - Bank Account</option>
      <option value="recipient-2">Jane Smith - Mobile Money</option>
    </select>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("CreatePayoutForm Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("Complete New Recipient Flow - Bank Account", () => {
    it("should complete full flow from form to confirmation for bank account", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = jest.fn();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPayoutResponse,
        });

      render(
        <CreatePayoutForm open={true} onOpenChange={mockOnOpenChange} />,
        { wrapper: createWrapper() }
      );

      // Step 1: Switch to new recipient
      fireEvent.click(screen.getByText("New Recipient"));

      // Step 2: Fill recipient name
      const nameInput = screen.getByLabelText("Recipient Name");
      await user.clear(nameInput);
      await user.type(nameInput, "John Doe");

      // Step 3: Fill bank account details
      const accountInput = screen.getByLabelText("Account Number *");
      await user.clear(accountInput);
      await user.type(accountInput, "123456789");

      // Step 4: Fill payment amount
      const amountInput = screen.getByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "100.00");

      // Step 5: Click Review & Confirm
      fireEvent.click(screen.getByText("Review & Confirm"));

      // Step 6: Verify confirmation modal appears
      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText(/100/)).toBeInTheDocument();
      });

      // Step 7: Submit confirmation
      fireEvent.click(screen.getByText("Confirm & Send"));

      // Step 8: Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/v1/payouts",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      // Step 9: Verify custom event dispatched
      const dispatchEventSpy = jest.spyOn(window, "dispatchEvent");
      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "payouts:refetch",
          })
        );
      });

      dispatchEventSpy.mockRestore();
    });
  });

  describe("Complete Existing Recipient Flow", () => {
    it("should submit payout with existing recipient", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayoutResponse,
      });

      render(
        <CreatePayoutForm open={true} onOpenChange={mockOnOpenChange} />,
        { wrapper: createWrapper() }
      );

      // Use saved recipient
      const recipientSelect = screen.getByTestId("recipient-select");
      fireEvent.change(recipientSelect, { target: { value: "recipient-1" } });

      // Fill amount
      const amountInput = screen.getByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "50.00");

      // Review
      fireEvent.click(screen.getByText("Review & Confirm"));

      // Verify confirmation
      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      // Submit
      fireEvent.click(screen.getByText("Confirm & Send"));

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/v1/payouts",
          expect.any(Object)
        );

        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.recipientId).toBe("recipient-1");
      });
    });
  });

  describe("Mobile Money Flow", () => {
    it("should submit payout with mobile money details", async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayoutResponse,
      });

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Fill recipient name
      await user.type(screen.getByLabelText("Recipient Name"), "Jane Smith");

      // Change to mobile money
      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "MOBILE_MONEY" } });

      // Wait for fields to render
      await waitFor(() => {
        expect(screen.getByLabelText("Phone Number *")).toBeInTheDocument();
      });

      // Fill mobile money details
      await user.type(
        screen.getByLabelText("Phone Number *"),
        "+233500000000"
      );

      // Fill amount
      await user.type(screen.getByLabelText("Amount"), "50.00");

      // Review
      fireEvent.click(screen.getByText("Review & Confirm"));

      // Verify confirmation shows mobile money badge
      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
        expect(screen.getByText(/mobile money/i)).toBeInTheDocument();
      });

      // Submit
      fireEvent.click(screen.getByText("Confirm & Send"));

      // Verify payload
      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.destinationType).toBe("MOBILE_MONEY");
        expect(callBody.destination.phoneNumber).toBe("+233500000000");
      });
    });
  });

  describe("Crypto Flow", () => {
    it("should submit payout with crypto wallet", async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayoutResponse,
      });

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      await user.type(screen.getByLabelText("Recipient Name"), "Crypto User");

      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "CRYPTO_WALLET" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Wallet Address *")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Wallet Address *"),
        "0x742d35Cc6634C0532925a3b844Bc9e7595f42e57"
      );

      await user.type(screen.getByLabelText("Amount"), "100.00");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.destinationType).toBe("CRYPTO_WALLET");
        expect(callBody.destination.address).toBe(
          "0x742d35Cc6634C0532925a3b844Bc9e7595f42e57"
        );
      });
    });
  });

  describe("Stellar Flow", () => {
    it("should submit payout with Stellar address", async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayoutResponse,
      });

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      await user.type(screen.getByLabelText("Recipient Name"), "Stellar User");

      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "STELLAR" } });

      await waitFor(() => {
        expect(
          screen.getByLabelText("Stellar Address (G...) *")
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Stellar Address (G...) *"),
        "GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N"
      );

      await user.type(screen.getByLabelText("Amount"), "100.00");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.destinationType).toBe("STELLAR");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const user = userEvent.setup();
      const mockToast = jest.fn();

      jest.mock("@/components/ui/use-toast", () => ({
        useToast: () => ({
          toast: mockToast,
        }),
      }));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Insufficient funds" }),
      });

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      await user.type(screen.getByLabelText("Recipient Name"), "John Doe");
      await user.type(screen.getByLabelText("Account Number *"), "123456789");
      await user.type(screen.getByLabelText("Amount"), "100.00");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      // API called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Fee Estimation", () => {
    it("should fetch and display fee estimate", async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFeeResponse,
        });

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Type amount
      const amountInput = screen.getByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "100.00");

      // Wait for fee fetch
      await waitFor(
        () => {
          // Check if fee estimation was called
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/quotes/estimate-fee"),
            expect.any(Object)
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Form Reset", () => {
    it("should reset form after successful submission", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayoutResponse,
      });

      const { rerender } = render(
        <CreatePayoutForm open={true} onOpenChange={mockOnOpenChange} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText("New Recipient"));

      await user.type(screen.getByLabelText("Recipient Name"), "John");
      await user.type(screen.getByLabelText("Account Number *"), "123");
      await user.type(screen.getByLabelText("Amount"), "100");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      // Verify dialog closes
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
