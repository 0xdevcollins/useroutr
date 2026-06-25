import type { Metadata } from "next";
import { Suspense } from "react";
import { Hanken_Grotesk, Fraunces, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import "./globals.css";
import { ToastProvider } from "@useroutr/ui";
import { TooltipProvider } from "@/components/ui/tooltip";

// Hanken Grotesk — display + body. Same family as the marketing site so the
// brand voice is unbroken between useroutr.com and dashboard.useroutr.com.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Fraunces — variable serif for editorial italic accents.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// JetBrains Mono — eyebrow labels, IDs, code, balances.
const jetMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jet-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Useroutr Dashboard",
    template: "%s · Useroutr",
  },
  description:
    "Manage payments, payouts, invoicing, and analytics on Useroutr.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("useroutr-theme");var t=p==="dark"?"dark":p==="light"?"light":window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";document.documentElement.classList.add(t)}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${hanken.variable} ${fraunces.variable} ${jetMono.variable} antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <Suspense>
              <AuthProvider>
                <TooltipProvider>
                  <ToastProvider>{children}</ToastProvider>
                </TooltipProvider>
              </AuthProvider>
            </Suspense>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
