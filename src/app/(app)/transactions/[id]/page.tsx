import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTransactionById } from "@/lib/repos/transactions";
import { setTransactionEventStatusAction } from "@/lib/transactions/actions";
import { completeTaskAction, reopenTaskAction } from "@/lib/tasks/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { AddEventForm } from "@/components/transactions/add-event-form";
import { contactDisplayName, formatCurrency, formatDate, formatDateWithYear } from "@/lib/format";
import {
  TRANSACTION_EVENT_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/labels";
import { deriveDeadlineStatus } from "@/lib/status";

export default async function TransactionDetailPage(props: PageProps<"/transactions/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const transaction = await getTransactionById(session.user.id, id);
  if (!transaction) notFound();

  const nextPendingEvent = transaction.events.find((event) => event.status === "PENDING") ?? null;

  const timeline = [
    { date: transaction.createdAt, label: "Transaction created" },
    ...transaction.events.map((event) => ({
      date: event.createdAt,
      label: `${TRANSACTION_EVENT_TYPE_LABELS[event.eventType]} added — ${event.title}`,
    })),
    ...transaction.tasks
      .filter((task) => task.completedDate)
      .map((task) => ({ date: task.completedDate as Date, label: `Task completed — ${task.title}` })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/transactions" className="hover:text-foreground">
              Transactions
            </Link>{" "}
            / {transaction.propertyAddress ?? contactDisplayName(transaction.client.contact)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {transaction.propertyAddress ?? "No address on file"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/clients/${transaction.clientId}`} className="hover:text-foreground">
              {contactDisplayName(transaction.client.contact)}
            </Link>{" "}
            · {TRANSACTION_TYPE_LABELS[transaction.type]} · {TRANSACTION_STATUS_LABELS[transaction.status]}
            {transaction.expectedClosingDate && ` · Closing ${formatDate(transaction.expectedClosingDate)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {nextPendingEvent ? (
            <StatusBadge variant={deriveDeadlineStatus(nextPendingEvent.date)} />
          ) : null}
          <Link
            href={`/transactions/${transaction.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Overview" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <InfoField
                label="Property"
                value={
                  [
                    transaction.propertyAddress,
                    [transaction.propertyCity, transaction.propertyState].filter(Boolean).join(", "),
                    transaction.propertyZip,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
              <InfoField label="MLS number" value={transaction.mlsNumber} />
              <InfoField label="Listing price" value={formatCurrency(transaction.listingPrice?.toString())} />
              <InfoField label="Purchase price" value={formatCurrency(transaction.purchasePrice?.toString())} />
              <InfoField
                label="Contract effective"
                value={transaction.contractEffectiveDate ? formatDateWithYear(transaction.contractEffectiveDate) : null}
              />
              <InfoField
                label="Expected closing"
                value={transaction.expectedClosingDate ? formatDateWithYear(transaction.expectedClosingDate) : null}
              />
              <InfoField
                label="Actual closing"
                value={transaction.actualClosingDate ? formatDateWithYear(transaction.actualClosingDate) : null}
              />
            </div>
            {transaction.notes ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{transaction.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Important Dates" />
            {transaction.events.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No dates yet"
                  description="Add contract, inspection, financing, and closing dates as they're set."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {transaction.events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {TRANSACTION_EVENT_TYPE_LABELS[event.eventType]} · {formatDateWithYear(event.date)}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </p>
                    </div>
                    {event.status === "PENDING" ? (
                      <form action={setTransactionEventStatusAction} className="shrink-0">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="status" value="COMPLETED" />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Mark done
                        </button>
                      </form>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {event.status === "COMPLETED"
                          ? "Done"
                          : event.status === "MISSED"
                            ? "Missed"
                            : "Waived"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border">
              <AddEventForm transactionId={transaction.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Documents" />
            {transaction.documents.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No documents yet"
                  description="Transaction documents you upload will appear here. Document upload is coming in a future update."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {transaction.documents.map((document) => (
                  <div key={document.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatDateWithYear(document.uploadedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <div className="flex flex-col divide-y divide-border">
              {timeline.map((entry, index) => (
                <div key={index} className="px-5 py-3">
                  <p className="text-sm text-foreground">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateWithYear(entry.date)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Tasks" />
            {transaction.tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tasks yet"
                  description="Tasks tied to this transaction will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {transaction.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${
                          task.status === "COMPLETED"
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
                      </p>
                    </div>
                    {task.status === "PENDING" ? (
                      <form action={completeTaskAction} className="shrink-0">
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Complete
                        </button>
                      </form>
                    ) : task.status === "COMPLETED" ? (
                      <form action={reopenTaskAction} className="shrink-0">
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Reopen
                        </button>
                      </form>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Cancelled</span>
                    )}
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
