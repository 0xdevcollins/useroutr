import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreatePayoutForm } from "../CreatePayoutForm";
import * as mockFetch from "@/__mocks__/fetch";

// Setup mocks
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock("@/components/recipients/RecipientSelect", () => ({
  RecipientSelect: ({ value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Select recipient</option>
      <option value="recipient-1">John Doe - Bank Account</option>
    </select>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("CreatePayoutForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("Rendering", () => {
    it("should render the form when open is true", () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("New Payout")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Send money to a recipient with support for bank accounts/i
        )
      ).toBeInTheDocument();
    });

    it("should not render when open is false", () => {
      const { container } = render(
        <CreatePayoutForm open={false} onOpenChange={jest.fn()} />,
        {
          wrapper: createWrapper(),
        }
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeInTheDocument();
    });

    it("should render recipient selection tabs", () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Saved Recipients")).toBeInTheDocument();
      expect(screen.getByText("New Recipient")).toBeInTheDocument();
    });
  });

  describe("Dynamic Field Switching", () => {
    it("should render bank account fields when BANK_ACCOUNT is selected", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      // Switch to new recipient
      fireEvent.click(screen.getByText("New Recipient"));

      // Verify bank account fields are visible
      expect(screen.getByLabelText("Account Number *")).toBeInTheDocument();
      expect(screen.getByLabelText("Country")).toBeInTheDocument();
    });

    it("should render mobile money fields when MOBILE_MONEY is selected", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Change to mobile money
      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "MOBILE_MONEY" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Phone Number *")).toBeInTheDocument();
        expect(screen.getByLabelText("Provider *")).toBeInTheDocument();
      });
    });

    it("should render crypto fields when CRYPTO_WALLET is selected", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "CRYPTO_WALLET" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Wallet Address *")).toBeInTheDocument();
        expect(screen.getByLabelText("Network *")).toBeInTheDocument();
      });
    });

    it("should render Stellar fields when STELLAR is selected", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const destTypeSelect = screen.getByLabelText("Destination Type");
      fireEvent.change(destTypeSelect, { target: { value: "STELLAR" } });

      await waitFor(() => {
        expect(
          screen.getByLabelText("Stellar Address (G...) *")
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Asset *")).toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("should show validation error for missing amount", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const recipientNameInput = screen.getByLabelText("Recipient Name");
      fireEvent.change(recipientNameInput, { target: { value: "John Doe" } });

      const accountNumberInput = screen.getByLabelText("Account Number *");
      fireEvent.change(accountNumberInput, {
        target: { value: "123456789" },
      });

      const countrySelect = screen.getByLabelText("Country");
      fireEvent.change(countrySelect, { target: { value: "US" } });

      // Try to submit without amount
      const reviewButton = screen.getByText("Review & Confirm");
      expect(reviewButton).toBeDisabled();
    });

    it("should show validation error for negative amount", async () => {
      const user = userEvent.setup();

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const amountInput = screen.getByLabelText("Amount");
      await user.clear(amountInput);
      await user.type(amountInput, "-100");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Amount must be greater than 0")).toBeInTheDocument();
      });
    });

    it("should validate required recipient name", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const amountInput = screen.getByLabelText("Amount");
      fireEvent.change(amountInput, { target: { value: "100" } });

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(
          screen.getByText("Recipient name is required")
        ).toBeInTheDocument();
      });
    });

    it("should validate bank account fields", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const recipientNameInput = screen.getByLabelText("Recipient Name");
      fireEvent.change(recipientNameInput, { target: { value: "John Doe" } });

      const amountInput = screen.getByLabelText("Amount");
      fireEvent.change(amountInput, { target: { value: "100" } });

      // Don't fill account number
      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(
          screen.getByText("Account number is required")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("should open confirmation modal when Review & Confirm is clicked with valid data", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Fill form
      fireEvent.change(screen.getByLabelText("Recipient Name"), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });
      fireEvent.change(screen.getByLabelText("Account Number *"), {
        target: { value: "123456789" },
      });

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });
    });

    it("should submit payout with correct payload", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Fill form
      fireEvent.change(screen.getByLabelText("Recipient Name"), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });
      fireEvent.change(screen.getByLabelText("Account Number *"), {
        target: { value: "123456789" },
      });

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Payout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/v1/payouts",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        );
      });
    });

    it("should handle API errors gracefully", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Insufficient funds" }),
      });
      global.fetch = mockFetch;

      const { toast } = require("@/components/ui/use-toast").useToast();

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      fireEvent.change(screen.getByLabelText("Recipient Name"), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });
      fireEvent.change(screen.getByLabelText("Account Number *"), {
        target: { value: "123456789" },
      });

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Confirm & Send")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm & Send"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Recipient Selection", () => {
    it("should allow selecting existing recipient", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("Saved Recipients"));

      const recipientSelect = screen.getByDisplayValue("Select recipient");
      fireEvent.change(recipientSelect, { target: { value: "recipient-1" } });

      await waitFor(() => {
        expect(recipientSelect).toHaveValue("recipient-1");
      });
    });

    it("should show validation error if existing recipient not selected", async () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const amountInput = screen.getByLabelText("Amount");
      fireEvent.change(amountInput, { target: { value: "100" } });

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(
          screen.getByText("Please select a recipient")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should render form correctly on small screens", () => {
      // Mock window size
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(
        <CreatePayoutForm open={true} onOpenChange={jest.fn()} />,
        {
          wrapper: createWrapper(),
        }
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();

      // Check that inputs are still accessible
      expect(screen.getByLabelText("Recipient")).toBeInTheDocument();
      expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for form fields", () => {
      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      // Check ARIA labels
      expect(screen.getByLabelText("Recipient Name")).toHaveAttribute(
        "id",
        expect.any(String)
      );
      expect(screen.getByLabelText("Amount")).toHaveAttribute(
        "type",
        "number"
      );
      expect(screen.getByLabelText("Currency")).toBeInTheDocument();
    });

    it("should have semantic form structure", () => {
      const { container } = render(
        <CreatePayoutForm open={true} onOpenChange={jest.fn()} />,
        {
          wrapper: createWrapper(),
        }
      );

      fireEvent.click(screen.getByText("New Recipient"));

      // Check for labels associated with inputs
      const inputs = container.querySelectorAll("input");
      inputs.forEach((input) => {
        if (input.id && input.id !== "radix-') {
          const label = container.querySelector(`label[for="${input.id}"]`);
          // Label should exist for important inputs
          if (["amount", "recipient-name"].some((id) => input.id.includes(id))) {
            expect(label).toBeInTheDocument();
          }
        }
      });
    });

    it("should set aria-invalid on invalid fields", async () => {
      const user = userEvent.setup();

      render(<CreatePayoutForm open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText("New Recipient"));

      const amountInput = screen.getByLabelText("Amount") as HTMLInputElement;
      await user.clear(amountInput);
      await user.type(amountInput, "-100");

      fireEvent.click(screen.getByText("Review & Confirm"));

      await waitFor(() => {
        expect(amountInput).toHaveAttribute("aria-invalid", "true");
      });
    });
  });
});
