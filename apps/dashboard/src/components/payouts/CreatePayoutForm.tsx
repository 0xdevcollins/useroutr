"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import { Button } from "@useroutr/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { RecipientSelect } from "@/components/recipients/RecipientSelect";
import { DestType, Recipient } from "@useroutr/types";
import {
  BankDestinationFields,
  MobileMoneyDestinationFields,
  CryptoDestinationFields,
  StellarDestinationFields,
} from "./PayoutDestinationFields";
import { PayoutConfirmationModal } from "./PayoutConfirmationModal";
import { FeeEstimator } from "./FeeEstimator";
import {
  CreatePayoutSchema,
  type CreatePayoutDto,
} from "@/lib/validation/payout.validation";

type DestinationType = "existing" | "new";
type PayoutDestType = DestType;

interface FormErrors {
  [key: string]: string;
}

interface FormState {
  // Recipient selection
  recipientType: DestinationType;
  existingRecipientId: string;
  recipientName: string;

  // Destination type
  destinationType: PayoutDestType;

  // Dynamic destination fields
  bankAccount: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    iban: string;
    bic: string;
    branchCode: string;
    country: string;
  };
  mobileMoney: {
    phoneNumber: string;
    provider: string;
    country: string;
  };
  crypto: {
    address: string;
    network: string;
    asset: string;
  };
  stellar: {
    address: string;
    asset: string;
    memo: string;
  };

  // Payment details
  amount: string;
  currency: string;

  // Recipient management
  saveAsDefault: boolean;
  recipientAlias: string;
}

const initialFormState: FormState = {
  recipientType: "existing",
  existingRecipientId: "",
  recipientName: "",
  destinationType: "BANK_ACCOUNT",
  bankAccount: {
    accountNumber: "",
    routingNumber: "",
    bankName: "",
    iban: "",
    bic: "",
    branchCode: "",
    country: "US",
  },
  mobileMoney: {
    phoneNumber: "",
    provider: "MTN",
    country: "GH",
  },
  crypto: {
    address: "",
    network: "ethereum",
    asset: "USDC",
  },
  stellar: {
    address: "",
    asset: "native",
    memo: "",
  },
  amount: "",
  currency: "USD",
  saveAsDefault: false,
  recipientAlias: "",
};

const DESTINATION_TYPES: { value: PayoutDestType; label: string }[] = [
  { value: "BANK_ACCOUNT", label: "Bank Account" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CRYPTO_WALLET", label: "Crypto Wallet" },
  { value: "STELLAR", label: "Stellar" },
];

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "INR",
  "USDC",
  "USDT",
];

export interface CreatePayoutFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePayoutForm({
  open,
  onOpenChange,
  onSuccess,
}: CreatePayoutFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    null
  );
  const [feeEstimate, setFeeEstimate] = useState<{
    fee: string;
    total: string;
    conversionRate?: string;
  } | null>(null);

  const handleRecipientTypeChange = (type: DestinationType) => {
    setForm((prev) => ({
      ...prev,
      recipientType: type,
      existingRecipientId: "",
      recipientName: "",
    }));
    setErrors({});
  };

  const handleExistingRecipientChange = (recipientId: string) => {
    setForm((prev) => ({
      ...prev,
      existingRecipientId: recipientId,
    }));
    setErrors((prev) => ({ ...prev, existingRecipientId: "" }));
  };

  const handleDestinationTypeChange = (type: PayoutDestType) => {
    setForm((prev) => ({
      ...prev,
      destinationType: type,
    }));
    setErrors({});
  };

  const handleFieldChange = (
    section: keyof Omit<
      FormState,
      | "recipientType"
      | "existingRecipientId"
      | "recipientName"
      | "destinationType"
      | "saveAsDefault"
      | "recipientAlias"
    >,
    field: string,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setErrors((prev) => ({
      ...prev,
      [`${section}.${field}`]: "",
    }));
  };

  const handleAmountChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      amount: value,
    }));
    setErrors((prev) => ({ ...prev, amount: "" }));
  };

  const handleCurrencyChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      currency: value,
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate amount
    if (!form.amount || parseFloat(form.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Validate recipient
    if (form.recipientType === "existing") {
      if (!form.existingRecipientId) {
        newErrors.existingRecipientId = "Please select a recipient";
      }
    } else {
      if (!form.recipientName.trim()) {
        newErrors.recipientName = "Recipient name is required";
      }

      // Validate destination fields based on type
      const destFields = getDestinationFields();
      const destinationSchema = getDestinationSchema();

      const result = destinationSchema.safeParse(destFields);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          const path = err.path.join(".");
          newErrors[`destination.${path}`] = err.message;
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getDestinationFields = () => {
    switch (form.destinationType) {
      case "BANK_ACCOUNT":
        return {
          type: "BANK_ACCOUNT",
          ...form.bankAccount,
        };
      case "MOBILE_MONEY":
        return {
          type: "MOBILE_MONEY",
          ...form.mobileMoney,
        };
      case "CRYPTO_WALLET":
        return {
          type: "CRYPTO_WALLET",
          ...form.crypto,
        };
      case "STELLAR":
        return {
          type: "STELLAR",
          ...form.stellar,
        };
    }
  };

  const getDestinationSchema = () => {
    const BankAccountDestSchema = z.object({
      type: z.literal("BANK_ACCOUNT"),
      accountNumber: z.string().min(1, "Account number is required"),
      routingNumber: z.string().max(20).optional(),
      bankName: z.string().max(255).optional(),
      iban: z.string().max(34).optional(),
      bic: z.string().max(11).optional(),
      branchCode: z.string().max(20).optional(),
      country: z.string().length(2, "Country code must be 2 characters"),
    });

    const MobileMoneyDestSchema = z.object({
      type: z.literal("MOBILE_MONEY"),
      phoneNumber: z.string().min(7, "Phone number is required"),
      provider: z.string().min(1, "Provider is required"),
      country: z.string().length(2, "Country code must be 2 characters"),
    });

    const CryptoWalletDestSchema = z.object({
      type: z.literal("CRYPTO_WALLET"),
      address: z.string().min(1, "Wallet address is required"),
      network: z.string().min(1, "Network is required"),
      asset: z.string().min(1, "Asset is required"),
    });

    const StellarDestSchema = z.object({
      type: z.literal("STELLAR"),
      address: z.string().min(1, "Stellar address is required"),
      asset: z.string().min(1, "Asset is required"),
      memo: z.string().max(28).optional(),
    });

    return z.discriminatedUnion("type", [
      BankAccountDestSchema,
      MobileMoneyDestSchema,
      CryptoWalletDestSchema,
      StellarDestSchema,
    ]);
  };

  const buildPayoutDto = (): CreatePayoutDto => {
    const destination = getDestinationFields();

    return {
      recipientId:
        form.recipientType === "existing"
          ? form.existingRecipientId
          : undefined,
      recipientName: form.recipientName,
      destinationType: form.destinationType,
      destination,
      amount: form.amount,
      currency: form.currency,
    };
  };

  const handlePreviewClick = () => {
    if (validateForm()) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmSubmit = () => {
    startTransition(async () => {
      try {
        const payoutDto = buildPayoutDto();

        // Validate with schema
        const result = CreatePayoutSchema.safeParse(payoutDto);
        if (!result.success) {
          result.error.errors.forEach((err) => {
            const path = err.path.join(".");
            setErrors((prev) => ({ ...prev, [path]: err.message }));
          });
          toast({
            title: "Validation Error",
            description: "Please check the form and try again",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch("/api/v1/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to create payout"
          );
        }

        toast({
          title: "Payout Created",
          description: `Payout of ${form.amount} ${form.currency} has been sent.`,
        });

        // Reset form
        setForm(initialFormState);
        setErrors({});
        setShowConfirmation(false);
        onOpenChange(false);

        // Trigger refetch
        window.dispatchEvent(new CustomEvent("payouts:refetch"));
        onSuccess?.();
      } catch (error) {
        console.error("Payout creation error:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to create payout",
          variant: "destructive",
        });
      }
    });
  };

  const handleClose = () => {
    setForm(initialFormState);
    setErrors({});
    setShowConfirmation(false);
    setFeeEstimate(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Payout</DialogTitle>
            <DialogDescription>
              Send money to a recipient with support for bank accounts, mobile
              money, crypto, or Stellar addresses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Recipient Selection Tab */}
            <div className="space-y-3">
              <Label>Recipient</Label>
              <Tabs
                value={form.recipientType}
                onValueChange={handleRecipientTypeChange}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Saved Recipients</TabsTrigger>
                  <TabsTrigger value="new">New Recipient</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="space-y-3">
                  <RecipientSelect
                    value={form.existingRecipientId}
                    onValueChange={handleExistingRecipientChange}
                  />
                  {errors.existingRecipientId && (
                    <p className="text-sm text-destructive">
                      {errors.existingRecipientId}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="new" className="space-y-4">
                  <div>
                    <Label htmlFor="recipient-name">Recipient Name</Label>
                    <Input
                      id="recipient-name"
                      placeholder="John Doe"
                      value={form.recipientName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          recipientName: e.target.value,
                        }))
                      }
                      aria-invalid={!!errors.recipientName}
                    />
                    {errors.recipientName && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.recipientName}
                      </p>
                    )}
                  </div>

                  {/* Destination Type Selector */}
                  <div>
                    <Label htmlFor="dest-type">Destination Type</Label>
                    <Select
                      value={form.destinationType}
                      onValueChange={
                        handleDestinationTypeChange as (value: string) => void
                      }
                    >
                      <SelectTrigger id="dest-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DESTINATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dynamic Destination Fields */}
                  <div className="space-y-4 border-t pt-4">
                    {form.destinationType === "BANK_ACCOUNT" && (
                      <BankDestinationFields
                        data={form.bankAccount}
                        onChange={(field, value) =>
                          handleFieldChange("bankAccount", field, value)
                        }
                        errors={errors}
                      />
                    )}
                    {form.destinationType === "MOBILE_MONEY" && (
                      <MobileMoneyDestinationFields
                        data={form.mobileMoney}
                        onChange={(field, value) =>
                          handleFieldChange("mobileMoney", field, value)
                        }
                        errors={errors}
                      />
                    )}
                    {form.destinationType === "CRYPTO_WALLET" && (
                      <CryptoDestinationFields
                        data={form.crypto}
                        onChange={(field, value) =>
                          handleFieldChange("crypto", field, value)
                        }
                        errors={errors}
                      />
                    )}
                    {form.destinationType === "STELLAR" && (
                      <StellarDestinationFields
                        data={form.stellar}
                        onChange={(field, value) =>
                          handleFieldChange("stellar", field, value)
                        }
                        errors={errors}
                      />
                    )}
                  </div>

                  {/* Save as Default */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="save-recipient"
                      checked={form.saveAsDefault}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          saveAsDefault: e.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor="save-recipient"
                      className="cursor-pointer"
                    >
                      Save as default recipient for future payouts
                    </Label>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Payment Details */}
            <div className="space-y-3 border-t pt-4">
              <Label>Payment Details</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    aria-invalid={!!errors.amount}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.amount}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fee Estimator */}
              {form.amount && (
                <FeeEstimator
                  amount={form.amount}
                  currency={form.currency}
                  destinationType={form.destinationType}
                  onEstimate={setFeeEstimate}
                />
              )}

              {feeEstimate && (
                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Estimated Fee:</span>
                    <span className="font-medium">{feeEstimate.fee}</span>
                  </div>
                  {feeEstimate.conversionRate && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Conversion Rate:</span>
                      <span>{feeEstimate.conversionRate}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-medium">
                    <span>Total:</span>
                    <span>{feeEstimate.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handlePreviewClick}
              disabled={
                isPending ||
                !form.amount ||
                (form.recipientType === "existing" &&
                  !form.existingRecipientId) ||
                (form.recipientType === "new" && !form.recipientName)
              }
            >
              Review & Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <PayoutConfirmationModal
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          formState={form}
          feeEstimate={feeEstimate}
          isPending={isPending}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </>
  );
}
