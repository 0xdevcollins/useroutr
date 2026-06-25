import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { AuthScaffold } from "@/components/brand/AuthScaffold";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthScaffold
      illustration="login"
      eyebrow="Sign in"
      title={
        <>
          Welcome <span className="editorial-italic">back.</span>
        </>
      }
      description="Sign in to your Useroutr workspace to manage payments, invoices, and payouts."
      footnote={
        <span>
          New here?{" "}
          <Link href="/register" className="link-underline text-foreground">
            Open an account
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthScaffold>
  );
}
