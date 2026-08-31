import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-primary">AJH Real Estate CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your transaction command center.
        </p>
        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </div>
  );
}
