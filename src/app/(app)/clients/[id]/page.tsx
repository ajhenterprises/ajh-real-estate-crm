import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getClientById, getPreviousTransactionsForClient } from "@/lib/repos/clients";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName, formatDate, formatDateWithYear } from "@/lib/format";
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS, TRANSACTION_STATUS_LABELS } from "@/lib/labels";

export default async function ClientDetailPage(props: PageProps<"/clients/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const client = await getClientById(session.user.id, id);
  if (!client) notFound();

  const previousTransactions = await getPreviousTransactionsForClient(session.user.id, client.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/clients" className="hover:text-foreground">
              Clients
            </Link>{" "}
            / {contactDisplayName(client.contact)}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {contactDisplayName(client.contact)}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                client.status === "ACTIVE"
                  ? "bg-status-ontrack-bg text-status-ontrack"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {CLIENT_STATUS_LABELS[client.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{CLIENT_TYPE_LABELS[client.type]}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/contacts/${client.contactId}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            View Contact
          </Link>
          <Link
            href={`/clients/${client.id}/transactions/new`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            New Transaction
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Contact Information" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <InfoField label="Email" value={client.contact.email} />
              <InfoField label="Phone" value={client.contact.phone} />
              <InfoField
                label="Address"
                value={
                  [
                    client.contact.address,
                    [client.contact.city, client.contact.state].filter(Boolean).join(", "),
                    client.contact.zip,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Client Information" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <InfoField label="Client type" value={CLIENT_TYPE_LABELS[client.type]} />
              <InfoField label="Status" value={CLIENT_STATUS_LABELS[client.status]} />
            </div>
            {client.notes ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Active Transactions" />
            {client.transactions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No active transactions"
                  description="Start a transaction for this client and it will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {client.transactions.map((transaction) => (
                  <Link
                    key={transaction.id}
                    href={`/transactions/${transaction.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {transaction.propertyAddress ?? "No address on file"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.expectedClosingDate
                          ? `Closing ${formatDate(transaction.expectedClosingDate)}`
                          : "No closing date set"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {TRANSACTION_STATUS_LABELS[transaction.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Previous Transactions" />
            {previousTransactions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No closed transactions yet"
                  description="Closed and cancelled transactions for this client will appear here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {previousTransactions.map((transaction) => (
                  <Link
                    key={transaction.id}
                    href={`/transactions/${transaction.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {transaction.propertyAddress ?? "No address on file"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.actualClosingDate
                          ? `Closed ${formatDateWithYear(transaction.actualClosingDate)}`
                          : "No closing date recorded"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {TRANSACTION_STATUS_LABELS[transaction.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {client.contact.activities.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No activity yet"
                  description="Actions on this client's contact record will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {client.contact.activities.map((activity) => (
                  <div key={activity.id} className="px-5 py-3">
                    <p className="text-sm text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDateWithYear(activity.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Tasks" />
            {client.tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No open tasks" description="Open tasks for this client will show up here." />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {client.tasks.map((task) => (
                  <div key={task.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
