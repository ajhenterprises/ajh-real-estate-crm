import { requireSession } from "@/lib/auth/session";
import { listIntegrationsForUser } from "@/lib/repos/integrations";
import { Card, CardHeader } from "@/components/ui/card";
import { EXTERNAL_PROVIDER_LABELS } from "@/lib/integrations/providers";
import { formatDateWithYear } from "@/lib/format";
import { disconnectIntegrationAction } from "@/lib/integrations/actions";

/**
 * Integration settings — foundation only. No "Connect" button exists
 * here on purpose: a real connect flow needs actual provider credentials
 * (an API key, an OAuth exchange), which this phase explicitly does not
 * collect or fake. Every row below is a placeholder — "Not Connected" for
 * every provider, always, until a future phase builds a real connect flow
 * using src/lib/integrations/provider-adapter.ts. "Connected" is only
 * ever shown if a real Integration row with that status genuinely exists
 * (never claimed by this page itself).
 */
export default async function IntegrationsPage() {
  const session = await requireSession();
  const integrations = await listIntegrationsForUser(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect AJH Real Estate CRM to the platforms you already use. Nothing is connected yet — these are
          settings placeholders for integrations that haven&apos;t been built.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {integrations.map((integration) => {
          const isConnected = integration.status === "CONNECTED";
          const isError = integration.status === "ERROR";
          return (
            <Card key={integration.provider}>
              <CardHeader
                title={integration.displayName ?? EXTERNAL_PROVIDER_LABELS[integration.provider]}
                action={
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isConnected
                        ? "bg-status-ontrack-bg text-status-ontrack"
                        : isError
                          ? "bg-status-attention-bg text-status-attention"
                          : "bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    {isConnected ? "Connected" : isError ? "Connection error" : "Not Connected"}
                  </span>
                }
              />
              <div className="flex flex-col gap-3 p-5">
                {integration.lastSyncedAt ? (
                  <p className="text-sm text-muted-foreground">Last synced {formatDateWithYear(integration.lastSyncedAt)}</p>
                ) : null}
                {integration.lastSyncError ? (
                  <p className="text-sm text-status-attention">{integration.lastSyncError}</p>
                ) : null}

                {isConnected && integration.id ? (
                  <form action={disconnectIntegrationAction}>
                    <input type="hidden" name="integrationId" value={integration.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-status-attention hover:bg-surface-muted"
                    >
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet available.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
