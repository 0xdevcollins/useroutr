"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { z } from "zod";

import { api } from "@/lib/api";
import { AuthScaffold } from "@/components/brand/AuthScaffold";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = schema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setIsSubmitted(true);
    } catch {
      // Always show success to prevent enumeration
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthScaffold
        illustration="forgot-password"
        eyebrow="Check your inbox"
        title={
          <>
            On its <span className="editorial-italic">way.</span>
          </>
        }
        description={
          <>
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email}</span>,
            we&apos;ve sent a password reset link. Check spam if it
            doesn&apos;t land in a couple of minutes.
          </>
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
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
              <Check className="size-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-medium text-foreground">
                Reset email sent
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                The link is valid for 24 hours.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsSubmitted(false);
            setEmail("");
          }}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card text-[14px] font-medium text-foreground transition-colors hover:border-foreground"
        >
          Try a different email
        </button>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      illustration="forgot-password"
      eyebrow="Reset password"
      title={
        <>
          Forgot your <span className="editorial-italic">password?</span>
        </>
      }
      description="Enter your email and we'll send you a link to set a new one."
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
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <label className="block">
          <span className="eyebrow block">Work email</span>
          <span className="mt-2 block">
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              autoComplete="email"
              required
              className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </span>
          {error && (
            <span className="mt-1.5 block text-[12px] text-destructive">
              {error}
            </span>
          )}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="magnet mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
          {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.6} />}
        </button>
      </form>
    </AuthScaffold>
  );
}
