import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { AuthScaffold } from "@/components/brand/AuthScaffold";

export const metadata = {
  title: "Open an account",
};

export default function SignupPage() {
  return (
    <AuthScaffold
      illustration="register"
      eyebrow="Open an account"
      title={
        <>
          Open an <span className="editorial-italic">account.</span>
        </>
      }
      description="Mainnet keys, Slack with the team, and integration help in your first month. Live in Q3 2026."
      footnote={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="link-underline text-foreground">
            Sign in
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthScaffold>
  );
}
