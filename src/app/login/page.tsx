import { LoginForm } from "@/components/login-form";

const LOGIN_ERRORS: Record<string, string> = {
  profile_not_found: "User profile not found. Contact an administrator.",
  account_inactive: "Your account is inactive.",
  invalid_role: "Your account has an invalid role.",
  auth_callback_failed: "Authentication failed. Please sign in again.",
  logout_failed: "Logout failed while updating attendance.",
  audit_failed: "Logout failed while recording audit log.",
};

interface LoginPageProps {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const serverError = searchParams.error
    ? LOGIN_ERRORS[searchParams.error] ?? "An error occurred. Please try again."
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Agency OS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workforce management platform
        </p>
      </div>
      <LoginForm serverError={serverError} />
    </main>
  );
}
