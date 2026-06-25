"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { z } from "zod";

import { useAuth } from "@/providers/AuthProvider";

const registerSchema = z.object({
  companyName: z.string().min(2, "Business name is required"),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .regex(/[A-Z]/, "One uppercase letter")
    .regex(/[0-9]/, "One number"),
});

type RegisterFields = z.infer<typeof registerSchema>;
type FormErrors = Partial<Record<keyof RegisterFields, string>>;

const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
];

export function SignupForm() {
  const { register } = useAuth();
  const searchParams = useSearchParams();

  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextEmail = searchParams.get("email");
    if (nextEmail) setEmail(nextEmail);
  }, [searchParams]);

  const clearError = (field: keyof FormErrors) =>
    setErrors((p) => ({ ...p, [field]: undefined }));

  const validate = (): boolean => {
    const result = registerSchema.safeParse({
      companyName,
      name,
      email,
      password,
    });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof RegisterFields;
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
      await register({ companyName, name, email, password });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong.",
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
        label="Business name"
        error={errors.companyName}
        input={
          <input
            type="text"
            placeholder="Acme Marketplace, Inc."
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              if (errors.companyName) clearError("companyName");
            }}
            required
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        }
      />

      <Field
        label="Your name"
        error={errors.name}
        input={
          <input
            type="text"
            placeholder="Jane Carter"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) clearError("name");
            }}
            autoComplete="name"
            required
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        }
      />

      <Field
        label="Work email"
        error={errors.email}
        input={
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) clearError("email");
            }}
            autoComplete="email"
            required
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        }
      />

      <div>
        <Field
          label="Password"
          error={errors.password}
          input={
            <input
              type="password"
              placeholder="Pick something good"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) clearError("password");
              }}
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          }
        />
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="magnet mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-semibold text-foreground transition-colors hover:bg-accent-ink hover:text-white disabled:opacity-60"
      >
        {isSubmitting ? "Creating your workspace…" : "Open an account"}
        {!isSubmitting && <ArrowRight className="size-4" strokeWidth={1.6} />}
      </button>

      <p className="text-center text-[11px] text-muted-foreground">
        By creating an account you agree to the{" "}
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

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow block">{label}</span>
      <span className="mt-2 block">{input}</span>
      {error && (
        <span className="mt-1.5 block text-[12px] text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
