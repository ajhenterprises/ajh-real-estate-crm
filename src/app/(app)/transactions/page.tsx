import { requireSession } from "@/lib/auth/session";
import { listTransactions } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName, formatDate } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export default async function TransactionsPage() {
  const session = await requireSession();
  const transactions = await listTransactions(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every deal you&rsquo;re tracking, from prospect through closed.
        </p>
      </div>

      <Card>
        {transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No transactions yet"
              description="Once a client is ready to move forward, start a transaction here to track it through to closing."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {contactDisplayName(transaction.client.contact)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.propertyAddress ?? "No address on file"}
                    {transaction.expectedClosingDate &&
                      ` · Closing ${formatDate(transaction.expectedClosingDate)}`}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {STATUS_LABELS[transaction.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
