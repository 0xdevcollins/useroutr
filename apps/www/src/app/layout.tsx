import type { Metadata } from "next";
import "./globals.css";
import {
  Hanken_Grotesk,
  Instrument_Serif,
  Fraunces,
  JetBrains_Mono,
} from "next/font/google";
import { cn } from "@/lib/utils";
import { StructuredData } from "@/components/StructuredData";

// Hanken Grotesk — clean confident grotesque. Carries the editorial financial
// feel that altitude.xyz / withpersona / mercury share. Used for both display
// headlines and body — letting tracking and weight carry the contrast.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Fraunces — variable serif. Used for italic editorial accents inline in
// headlines and the occasional pull-quote. More expressive than Instrument
// Serif's narrow Roman, with optical sizing for big-display moments.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  // axes: ["SOFT", "opsz"],
  display: "swap",
});

// Instrument Serif — kept for the smaller editorial italic moments where
// Fraunces' optical-size variant is too expressive.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

// JetBrains Mono — eyebrow labels, code, numerals.
const jetMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jet-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
<<<<<<< Updated upstream
  title:
    "Useroutr — Payouts to bank accounts & mobile money, settled on Stellar",
  description:
    "The payout platform for businesses paying Africa. Accept USDC from any major chain and deliver to bank accounts and mobile money in Nigeria — settled on Stellar, at a fraction of legacy cost.",
  keywords: [
    "cross-border payouts",
    "stablecoin payouts",
    "Nigeria payout API",
    "mobile money API",
    "USDC to NGN",
    "stellar payments",
    "bulk disbursement API",
=======
  title: "Useroutr — Pay anything. Settle everywhere.",
  description:
    "Non-custodial cross-chain payment infrastructure built on Stellar. One SDK, one API, one dashboard for accepting payments and settling them where you want.",
  keywords: [
    "non-custodial payment processor",
    "stellar payment gateway",
    "crypto payment infrastructure",
    "cross-chain payment API",
    "USDC payment processing",
    "MoneyGram API",
    "stellar soroban payments",
    "global payouts API",
>>>>>>> Stashed changes
    "Useroutr",
  ],
  authors: [{ name: "Useroutr" }],
  creator: "Useroutr",
  publisher: "Useroutr",
  formatDetection: { email: false, address: false, telephone: false },
<<<<<<< Updated upstream
  metadataBase: new URL("https://useroutr.com"),
=======
  metadataBase: new URL("https://useroutr.io"),
>>>>>>> Stashed changes
  alternates: { canonical: "/" },
  openGraph: {
    title:
      "Useroutr — Payouts to bank accounts & mobile money, settled on Stellar",
    description:
<<<<<<< Updated upstream
      "Accept USDC from any major chain and deliver to bank accounts and mobile money in Nigeria — settled on Stellar.",
    url: "https://useroutr.com",
=======
      "Non-custodial cross-chain payment infrastructure built on Stellar. Useroutr never holds the money in between.",
    url: "https://useroutr.io",
>>>>>>> Stashed changes
    siteName: "Useroutr",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
<<<<<<< Updated upstream
        alt: "Useroutr — cross-border payouts settled on Stellar",
=======
        alt: "Useroutr — non-custodial cross-chain payments",
>>>>>>> Stashed changes
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Useroutr — Payouts to bank accounts & mobile money, settled on Stellar",
    description:
<<<<<<< Updated upstream
      "The payout platform for businesses paying Africa. Settled on Stellar.",
=======
      "Non-custodial cross-chain payment infrastructure built on Stellar.",
>>>>>>> Stashed changes
    creator: "@useroutr",
    images: ["/twitter-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        hanken.variable,
        fraunces.variable,
        instrumentSerif.variable,
        jetMono.variable,
      )}
    >
      <body className="antialiased min-h-screen bg-bg text-ink">
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
