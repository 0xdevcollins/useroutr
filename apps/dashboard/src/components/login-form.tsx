"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { z } from "zod";

import { useAuth } from "@/providers/AuthProvider";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFields = z.infer<typeof loginSchema>;
type FormErrors = Partial<Record<keyof LoginFields, string>>;

export function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextEmail = searchParams.get("email");
    if (nextEmail) setEmail(nextEmail);
  }, [searchParams]);

  const validate = (): boolean => {
    const result = loginSchema.safeParse({ email, password });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof LoginFields;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-[13px] text-destructive"
        >
          {serverError}
        </div>
      )}

      <Field
        label="Work email"
        error={errors.email}
        input={
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="email"
            required
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        }
      />

      <Field
        label="Password"
        labelRight={
          <Link
            href="/forgot-password"
            className="link-underline text-[12px] text-muted-foreground"
          >
            Forgot password?
          </Link>
        }
        error={errors.password}
        input={
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password)
                setErrors((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="current-password"
            required
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        }
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="magnet mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
        {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.6} />}
      </button>

      <p className="text-center text-[11px] text-muted-foreground">
        By signing in you agree to our{" "}
        <Link
          href="https://useroutr.com/terms"
          target="_blank"
          rel="noreferrer"
          className="link-underline text-foreground"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="https://useroutr.com/privacy"
          target="_blank"
          rel="noreferrer"
          className="link-underline text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

/**
 * Inline label/field wrapper. Lightweight — keeps the auth forms editorial
 * (mono uppercase label, soft input, accent focus ring).
 */
function Field({
  label,
  labelRight,
  error,
  input,
}: {
  label: string;
  labelRight?: React.ReactNode;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        {labelRight}
      </span>
      <span className="mt-2 block">{input}</span>
      {error && (
        <span className="mt-1.5 block text-[12px] text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
