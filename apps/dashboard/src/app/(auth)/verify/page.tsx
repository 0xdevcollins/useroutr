"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { AuthScaffold } from "@/components/brand/AuthScaffold";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const { merchant, verificationEmail, resendVerificationEmail, verifyOtp } =
    useAuth();

  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const email =
    searchParams.get("email") ?? verificationEmail ?? merchant?.email ?? null;
  const registerHref = email
    ? `/register?email=${encodeURIComponent(email)}`
    : "/register";

  const handleResend = async () => {
    setStatus(null);
    setIsResending(true);
    try {
      await resendVerificationEmail();
      setOtp("");
      setStatus({
        tone: "success",
        message: "A fresh code is on its way.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't resend the code. Try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (!email || code.length !== 6) return;
    setStatus(null);
    setIsVerifying(true);
    try {
      await verifyOtp(email, code);
      // Redirect handled by AuthProvider
    } catch (error) {
      setOtp("");
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Invalid or expired code. Try again.",
      });
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    if (status?.tone === "error") setStatus(null);
  };

  return (
    <AuthScaffold
      illustration="verify"
      eyebrow="Verify your email"
      title={
        <>
          Check your <span className="editorial-italic">inbox.</span>
        </>
      }
      description={
        email ? (
          <>
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>. Drop
            it in below.
          </>
        ) : (
          "We sent a 6-digit verification code to your email."
        )
      }
      footnote={
        <Link
          href="/login"
          className="inline-flex items-center gap-1 link-underline text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      {status && (
        <div
          role="status"
          className={`mb-4 rounded-lg px-4 py-3 text-[13px] ${
            status.tone === "success"
              ? "border border-accent/30 bg-accent/8 text-accent-ink"
              : "border border-destructive/30 bg-destructive/8 text-destructive"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <span className="eyebrow">Enter your 6-digit code</span>
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={handleOtpChange}
          onComplete={handleVerify}
          disabled={isVerifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        {isVerifying && (
          <p className="text-[13px] text-muted-foreground">Verifying…</p>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={isResending || !email}
          onClick={handleResend}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-card text-[14px] font-medium text-foreground transition-colors hover:border-foreground disabled:opacity-60"
        >
          {isResending ? "Resending…" : "Resend code"}
        </button>
        <Link
          href={registerHref}
          className="inline-flex h-11 w-full items-center justify-center rounded-full text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Change email address
        </Link>
      </div>
    </AuthScaffold>
  );
}
