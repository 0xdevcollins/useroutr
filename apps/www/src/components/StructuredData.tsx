import React from "react";

export function StructuredData() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Useroutr",
    "url": "https://useroutr.com",
    "logo": "https://useroutr.com/logo.svg",
    "sameAs": [
      "https://twitter.com/useroutr",
      "https://github.com/useroutr",
      "https://linkedin.com/company/useroutr"
    ],
    "description": "The payout platform for businesses paying Africa. Accept USDC from any major chain and deliver to bank accounts and mobile money — settled on Stellar."
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Useroutr",
    "applicationCategory": "FinancialApplication",
    "operatingSystem": "Web",
    "abstract": "One API to accept USDC from any major chain and pay out to bank accounts and mobile money — settled on Stellar.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
    </>
  );
}
