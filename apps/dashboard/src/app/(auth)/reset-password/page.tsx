"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { z } from "zod";

import { api } from "@/lib/api";
import { AuthScaffold } from "@/components/brand/AuthScaffold";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormErrors = { password?: string; confirmPassword?: string };

const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
];

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = schema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token: resetToken, password });
      setIsSuccess(true);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Something went wrong. The link may have expired.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthScaffold
        illustration="reset-password"
        eyebrow="Reset password"
        title={
          <>
            Link <span className="editorial-italic">expired.</span>
          </>
        }
        description="This password reset link is invalid or has expired. Request a new one."
      >
        <Link href="/forgot-password" className="block">
          <span className="magnet inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white">
            Request a new link
            <ArrowRight className="size-4" strokeWidth={1.6} />
          </span>
        </Link>
      </AuthScaffold>
    );
  }

  if (isSuccess) {
    return (
      <AuthScaffold
        illustration="reset-password"
        eyebrow="Password updated"
        title={
          <>
            Locked <span className="editorial-italic">in.</span>
          </>
        }
        description="Your password has been reset. Sign in with your new credentials."
      >
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
              <Check className="size-4" strokeWidth={2} />
            </span>
            <p className="text-[14px] font-medium text-foreground">
              Password updated
            </p>
          </div>
        </div>
        <Link href="/login" className="mt-4 block">
          <span className="magnet inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white">
            Sign in
            <ArrowRight className="size-4" strokeWidth={1.6} />
          </span>
        </Link>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      illustration="reset-password"
      eyebrow="Set a new password"
      title={
        <>
          Pick something <span className="editorial-italic">good.</span>
        </>
      }
      description="Choose a strong password you'll remember. We'll keep it hashed and never see it in plain text."
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
      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-[13px] text-destructive"
        >
          {serverError}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <label className="block">
            <span className="eyebrow block">New password</span>
            <span className="mt-2 block">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: undefined }));
                }}
                autoComplete="new-password"
                required
                className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </span>
            {errors.password && (
              <span className="mt-1.5 block text-[12px] text-destructive">
                {errors.password}
              </span>
            )}
          </label>
          <ul className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
            {passwordRules.map((r) => {
              const ok = r.test(password);
              return (
                <li
                  key={r.label}
                  className={`flex items-center gap-1.5 ${
                    ok ? "text-foreground" : "text-text-faint"
                  }`}
                >
                  <span
                    className={`grid size-3.5 place-items-center rounded-full ${
                      ok ? "bg-accent text-white" : "border border-border"
                    }`}
                  >
                    {ok && <Check className="size-2" strokeWidth={3} />}
                  </span>
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>

        <label className="block">
          <span className="eyebrow block">Confirm password</span>
          <span className="mt-2 block">
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </span>
          {errors.confirmPassword && (
            <span className="mt-1.5 block text-[12px] text-destructive">
              {errors.confirmPassword}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="magnet mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save new password"}
          {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.6} />}
        </button>
      </form>
    </AuthScaffold>
  );
}
