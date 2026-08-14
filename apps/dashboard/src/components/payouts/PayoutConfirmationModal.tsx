"use client";

import { Button } from "@useroutr/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import type { FormState } from "./CreatePayoutForm";

interface PayoutConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formState: FormState;
  feeEstimate: {
    fee: string;
    total: string;
    conversionRate?: string;
  } | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PayoutConfirmationModal({
  open,
  onOpenChange,
  formState,
  feeEstimate,
  isPending,
  onConfirm,
  onCancel,
}: PayoutConfirmationModalProps) {
  const getDestinationDisplay = () => {
    const destType = formState.destinationType;

    switch (destType) {
      case "BANK_ACCOUNT": {
        const { accountNumber, routingNumber, bankName, country } =
          formState.bankAccount;
        return (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Account:</span> ****
              {accountNumber.slice(-4)}
            </p>
            {routingNumber && (
              <p>
                <span className="text-muted-foreground">Routing:</span>{" "}
                {routingNumber}
              </p>
            )}
            {bankName && (
              <p>
                <span className="text-muted-foreground">Bank:</span> {bankName}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Country:</span> {country}
            </p>
          </div>
        );
      }
      case "MOBILE_MONEY": {
        const { phoneNumber, provider, country } = formState.mobileMoney;
        return (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Provider:</span>{" "}
              {provider}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {phoneNumber}
            </p>
            <p>
              <span className="text-muted-foreground">Country:</span> {country}
            </p>
          </div>
        );
      }
      case "CRYPTO_WALLET": {
        const { address, network, asset } = formState.crypto;
        return (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Network:</span> {network}
            </p>
            <p>
              <span className="text-muted-foreground">Asset:</span> {asset}
            </p>
            <p className="font-mono text-xs break-all">
              <span className="text-muted-foreground">Address:</span>{" "}
              {address.substring(0, 20)}...
            </p>
          </div>
        );
      }
      case "STELLAR": {
        const { address, asset } = formState.stellar;
        return (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Asset:</span> {asset}
            </p>
            <p className="font-mono text-xs break-all">
              <span className="text-muted-foreground">Address:</span>{" "}
              {address.substring(0, 20)}...
            </p>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Payout</DialogTitle>
          <DialogDescription>
            Please review the details before submitting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Recipient</h3>
            <div className="bg-muted p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {formState.recipientName}
                </span>
                <Badge variant="outline" className="capitalize">
                  {formState.destinationType.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </div>
              <div>{getDestinationDisplay()}</div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Payment Details</h3>
            <div className="space-y-2 bg-muted p-3 rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  {formState.amount} {formState.currency}
                </span>
              </div>

              {feeEstimate && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee:</span>
                    <span>{feeEstimate.fee}</span>
                  </div>
                  {feeEstimate.conversionRate && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Conversion Rate:
                      </span>
                      <span>{feeEstimate.conversionRate}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{feeEstimate.total}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Please verify all details</p>
              <p className="text-xs mt-1">
                Once submitted, this payout cannot be reversed. Ensure all
                recipient information is correct.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            isLoading={isPending}
          >
            {isPending ? "Submitting..." : "Confirm & Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
