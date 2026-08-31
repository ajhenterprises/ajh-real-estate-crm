import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  BUYER_AND_SELLER: "Buyer & Seller",
};

export default async function ClientsPage() {
  const session = await requireSession();
  const clients = await listClients(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacts you have an active or past business relationship with.
        </p>
      </div>

      <Card>
        {clients.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No clients yet"
              description="Turn a contact into a client once they're ready to buy or sell, and they'll show up here."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {contactDisplayName(client.contact)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {TYPE_LABELS[client.type]} · {client.transactions.length} transaction
                    {client.transactions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    client.status === "ACTIVE" ? "text-status-ontrack" : "text-muted-foreground"
                  }`}
                >
                  {client.status === "ACTIVE" ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
