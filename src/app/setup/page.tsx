import { isSetupAvailable } from "@/lib/auth/setup";
import { SetupForm } from "@/components/auth/setup-form";

// Without this, Next prerenders the page at build time (it calls no
// cookies()/auth() to trigger dynamic rendering on its own) and bakes in
// whatever isSetupAvailable() returned then — stale forever after, in
// either direction. The whole point of this page is a fresh, per-request
// check of "does a user exist yet."
export const dynamic = "force-dynamic";

/**
 * Temporary, browser-accessible first-admin bootstrap. See
 * src/lib/auth/setup.ts for the guard conditions — this page renders the
 * form only when setup is actually usable (a setup secret is configured and
 * no user exists yet); otherwise it shows a plain "not available" message
 * that reveals nothing about why.
 */
export default async function SetupPage() {
  const available = await isSetupAvailable();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-primary">AJH Real Estate CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">First-admin setup</p>
        <div className="mt-6">
          {available ? (
            <SetupForm />
          ) : (
            <p className="rounded-md bg-status-attention-bg px-3 py-2 text-sm text-status-attention">
              Setup is not available. Either an admin account already exists, or this
              deployment doesn&apos;t have setup enabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
