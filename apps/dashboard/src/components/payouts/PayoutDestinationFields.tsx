"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FieldErrors {
  [key: string]: string;
}

interface BankDestinationFieldsProps {
  data: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    iban: string;
    bic: string;
    branchCode: string;
    country: string;
  };
  onChange: (field: string, value: string) => void;
  errors: FieldErrors;
}

export function BankDestinationFields({
  data,
  onChange,
  errors,
}: BankDestinationFieldsProps) {
  const COUNTRIES = [
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "IN", name: "India" },
    { code: "NG", name: "Nigeria" },
    { code: "GH", name: "Ghana" },
    { code: "ZA", name: "South Africa" },
  ];

  const getErrorMessage = (field: string) => errors[`destination.${field}`];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="country">Country</Label>
        <Select value={data.country} onValueChange={(val) => onChange("country", val)}>
          <SelectTrigger id="country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {getErrorMessage("country") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("country")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="account-number">Account Number *</Label>
        <Input
          id="account-number"
          placeholder="123456789"
          value={data.accountNumber}
          onChange={(e) => onChange("accountNumber", e.target.value)}
          aria-invalid={!!getErrorMessage("accountNumber")}
        />
        {getErrorMessage("accountNumber") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("accountNumber")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="routing-number">Routing Number</Label>
        <Input
          id="routing-number"
          placeholder="021000021"
          value={data.routingNumber}
          onChange={(e) => onChange("routingNumber", e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Required for US bank transfers
        </p>
      </div>

      <div>
        <Label htmlFor="bank-name">Bank Name</Label>
        <Input
          id="bank-name"
          placeholder="Chase Bank"
          value={data.bankName}
          onChange={(e) => onChange("bankName", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            placeholder="DE89370400440532013000"
            value={data.iban}
            onChange={(e) => onChange("iban", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bic">BIC</Label>
          <Input
            id="bic"
            placeholder="COBADEFF"
            value={data.bic}
            onChange={(e) => onChange("bic", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="branch-code">Branch Code</Label>
        <Input
          id="branch-code"
          placeholder="001"
          value={data.branchCode}
          onChange={(e) => onChange("branchCode", e.target.value)}
        />
      </div>
    </div>
  );
}

interface MobileMoneyDestinationFieldsProps {
  data: {
    phoneNumber: string;
    provider: string;
    country: string;
  };
  onChange: (field: string, value: string) => void;
  errors: FieldErrors;
}

export function MobileMoneyDestinationFields({
  data,
  onChange,
  errors,
}: MobileMoneyDestinationFieldsProps) {
  const PROVIDERS = [
    { code: "MTN", name: "MTN" },
    { code: "MPESA", name: "M-Pesa" },
    { code: "AIRTEL", name: "Airtel" },
    { code: "VODAFONE", name: "Vodafone" },
    { code: "SAFARICOM", name: "Safaricom" },
    { code: "ORANGE", name: "Orange Money" },
  ];

  const COUNTRIES = [
    { code: "GH", name: "Ghana" },
    { code: "NG", name: "Nigeria" },
    { code: "KE", name: "Kenya" },
    { code: "UG", name: "Uganda" },
    { code: "TZ", name: "Tanzania" },
    { code: "SN", name: "Senegal" },
    { code: "CI", name: "Côte d'Ivoire" },
  ];

  const getErrorMessage = (field: string) => errors[`destination.${field}`];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="provider">Provider *</Label>
          <Select value={data.provider} onValueChange={(val) => onChange("provider", val)}>
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.code} value={provider.code}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getErrorMessage("provider") && (
            <p className="text-sm text-destructive mt-1">
              {getErrorMessage("provider")}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="country">Country *</Label>
          <Select value={data.country} onValueChange={(val) => onChange("country", val)}>
            <SelectTrigger id="country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getErrorMessage("country") && (
            <p className="text-sm text-destructive mt-1">
              {getErrorMessage("country")}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="phone-number">Phone Number *</Label>
        <Input
          id="phone-number"
          type="tel"
          placeholder="+233 XXXXXXXXX"
          value={data.phoneNumber}
          onChange={(e) => onChange("phoneNumber", e.target.value)}
          aria-invalid={!!getErrorMessage("phoneNumber")}
        />
        {getErrorMessage("phoneNumber") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("phoneNumber")}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Include country code (e.g., +233 for Ghana)
        </p>
      </div>
    </div>
  );
}

interface CryptoDestinationFieldsProps {
  data: {
    address: string;
    network: string;
    asset: string;
  };
  onChange: (field: string, value: string) => void;
  errors: FieldErrors;
}

export function CryptoDestinationFields({
  data,
  onChange,
  errors,
}: CryptoDestinationFieldsProps) {
  const NETWORKS = [
    { code: "ethereum", name: "Ethereum (EVM)" },
    { code: "polygon", name: "Polygon" },
    { code: "arbitrum", name: "Arbitrum" },
    { code: "optimism", name: "Optimism" },
    { code: "base", name: "Base" },
    { code: "avalanche", name: "Avalanche" },
  ];

  const ASSETS = [
    { code: "USDC", name: "USD Coin (USDC)" },
    { code: "USDT", name: "Tether (USDT)" },
    { code: "ETH", name: "Ethereum (ETH)" },
    { code: "MATIC", name: "Polygon (MATIC)" },
  ];

  const getErrorMessage = (field: string) => errors[`destination.${field}`];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="network">Network *</Label>
        <Select value={data.network} onValueChange={(val) => onChange("network", val)}>
          <SelectTrigger id="network">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NETWORKS.map((network) => (
              <SelectItem key={network.code} value={network.code}>
                {network.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {getErrorMessage("network") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("network")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="asset">Asset *</Label>
        <Select value={data.asset} onValueChange={(val) => onChange("asset", val)}>
          <SelectTrigger id="asset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSETS.map((asset) => (
              <SelectItem key={asset.code} value={asset.code}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {getErrorMessage("asset") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("asset")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="address">Wallet Address *</Label>
        <Input
          id="address"
          placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f42e57"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
          className="font-mono text-sm"
          aria-invalid={!!getErrorMessage("address")}
        />
        {getErrorMessage("address") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("address")}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Ensure the address is valid for the selected network
        </p>
      </div>
    </div>
  );
}

interface StellarDestinationFieldsProps {
  data: {
    address: string;
    asset: string;
    memo: string;
  };
  onChange: (field: string, value: string) => void;
  errors: FieldErrors;
}

export function StellarDestinationFields({
  data,
  onChange,
  errors,
}: StellarDestinationFieldsProps) {
  const STELLAR_ASSETS = [
    { code: "native", name: "XLM (Native)" },
    { code: "USDC", name: "USD Coin (USDC)" },
    { code: "EURC", name: "Euro Coin (EURC)" },
    { code: "AQUA", name: "Aqua (AQUA)" },
  ];

  const getErrorMessage = (field: string) => errors[`destination.${field}`];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="stellar-address">Stellar Address (G...) *</Label>
        <Input
          id="stellar-address"
          placeholder="GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
          className="font-mono text-sm"
          aria-invalid={!!getErrorMessage("address")}
        />
        {getErrorMessage("address") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("address")}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Must be a valid Stellar public address starting with G
        </p>
      </div>

      <div>
        <Label htmlFor="stellar-asset">Asset *</Label>
        <Select value={data.asset} onValueChange={(val) => onChange("asset", val)}>
          <SelectTrigger id="stellar-asset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STELLAR_ASSETS.map((asset) => (
              <SelectItem key={asset.code} value={asset.code}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {getErrorMessage("asset") && (
          <p className="text-sm text-destructive mt-1">
            {getErrorMessage("asset")}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="stellar-memo">Memo (Optional)</Label>
        <Input
          id="stellar-memo"
          placeholder="Optional memo for the transaction"
          value={data.memo}
          onChange={(e) => onChange("memo", e.target.value)}
          maxLength={28}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Maximum 28 characters. Can be used for referencing transactions.
        </p>
      </div>
    </div>
  );
}
