"use client";

import {
  ShadInput as Input,
  ShadLabel as Label,
  ShadSelect as Select,
  ShadSelectContent as SelectContent,
  ShadSelectItem as SelectItem,
  ShadSelectTrigger as SelectTrigger,
  ShadSelectValue as SelectValue,
} from "@useroutr/ui";
import { DestType } from "@useroutr/types";

type Details = Record<string, string | undefined>;

interface RecipientDetailsFieldsProps {
  type: DestType;
  value: Details;
  onChange: (next: Details) => void;
}

/**
 * Renders the destination-specific input fields for a recipient, bound to a
 * shared `details` object. The API expects `details` to be a discriminated
 * union keyed by `type`, so the inner `type` is always kept in sync here.
 * Shared by the Create and Edit dialogs so the two never drift.
 */
export function RecipientDetailsFields({
  type,
  value,
  onChange,
}: RecipientDetailsFieldsProps) {
  const set = (key: string, v: string) =>
    onChange({ ...value, type, [key]: v });

  switch (type) {
    case "BANK_ACCOUNT":
      return (
        <div className="space-y-4">
          <Field label="Account Number" required>
            <Input
              placeholder="0123456789"
              value={value.accountNumber ?? ""}
              onChange={(e) => set("accountNumber", e.target.value)}
            />
          </Field>
          <Field label="Bank Name">
            <Input
              placeholder="GTBank"
              value={value.bankName ?? ""}
              onChange={(e) => set("bankName", e.target.value)}
            />
          </Field>
          <Field label="Routing Number (optional)">
            <Input
              placeholder="021000021"
              value={value.routingNumber ?? ""}
              onChange={(e) => set("routingNumber", e.target.value)}
            />
          </Field>
          <Field label="Country" required>
            <Input
              placeholder="NG"
              maxLength={2}
              value={value.country ?? ""}
              onChange={(e) => set("country", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      );

    case "MOBILE_MONEY":
      return (
        <div className="space-y-4">
          <Field label="Phone Number" required>
            <Input
              placeholder="+2348012345678"
              value={value.phoneNumber ?? ""}
              onChange={(e) => set("phoneNumber", e.target.value)}
            />
          </Field>
          <Field label="Provider" required>
            <Input
              placeholder="MTN"
              value={value.provider ?? ""}
              onChange={(e) => set("provider", e.target.value)}
            />
          </Field>
          <Field label="Country" required>
            <Input
              placeholder="NG"
              maxLength={2}
              value={value.country ?? ""}
              onChange={(e) => set("country", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      );

    case "CRYPTO_WALLET":
      return (
        <div className="space-y-4">
          <Field label="Wallet Address" required>
            <Input
              placeholder="0x…"
              value={value.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Network" required>
            <Select
              value={value.network ?? ""}
              onValueChange={(v) => set("network", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum</SelectItem>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="solana">Solana</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Asset" required>
            <Input
              placeholder="USDC"
              value={value.asset ?? ""}
              onChange={(e) => set("asset", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      );

    case "STELLAR":
      return (
        <div className="space-y-4">
          <Field label="Stellar Address" required>
            <Input
              placeholder="G…"
              value={value.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Asset">
            <Input
              placeholder="native"
              value={value.asset ?? ""}
              onChange={(e) => set("asset", e.target.value)}
            />
          </Field>
          <Field label="Memo (optional)">
            <Input
              placeholder=""
              maxLength={28}
              value={value.memo ?? ""}
              onChange={(e) => set("memo", e.target.value)}
            />
          </Field>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Returns true when `details` has the required fields for its `type` — used to
 * gate the submit button in the dialogs.
 */
export function isRecipientDetailsComplete(
  type: DestType,
  d: Details,
): boolean {
  switch (type) {
    case "BANK_ACCOUNT":
      return Boolean(d.accountNumber && d.country);
    case "MOBILE_MONEY":
      return Boolean(d.phoneNumber && d.provider && d.country);
    case "CRYPTO_WALLET":
      return Boolean(d.address && d.network && d.asset);
    case "STELLAR":
      return Boolean(d.address);
    default:
      return false;
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
