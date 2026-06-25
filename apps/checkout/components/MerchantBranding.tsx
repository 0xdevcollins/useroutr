interface MerchantBrandingProps {
  /** Legal entity name — always present from the API. Used as fallback. */
  merchantName: string;
  /** Public-facing brand name. Preferred over `merchantName` when set. */
  merchantCompanyName?: string | null;
  /** Square logo URL. Falls back to a monogram chip when absent. */
  merchantLogo?: string | null;
}

export function MerchantBranding({
  merchantName,
  merchantCompanyName,
  merchantLogo,
}: MerchantBrandingProps) {
  const displayName = merchantCompanyName?.trim() || merchantName || "Useroutr";

  return (
    <div className="text-center">
      {merchantLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={merchantLogo}
          alt={displayName}
          className="mx-auto h-10 w-10 rounded-lg object-cover"
        />
      ) : (
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <p className="mt-2 text-sm font-medium text-foreground">{displayName}</p>
    </div>
  );
}
