import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTransactionById } from "@/lib/repos/transactions";
import { setTransactionEventStatusAction } from "@/lib/transactions/actions";
import { cancelTaskAction, completeTaskAction, reopenTaskAction } from "@/lib/tasks/actions";
import { archiveDocumentAction, deleteDocumentAction } from "@/lib/documents/actions";
import { createContractInformationAction } from "@/lib/contracts/actions";
import { summarizeTaskProgress } from "@/lib/tasks/progress";
import { deriveContractStatus, CONTRACT_STATUS_LABELS } from "@/lib/contracts/status";
import { formatFileSize } from "@/lib/documents/validation";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AddEventForm } from "@/components/transactions/add-event-form";
import { AddTaskForm } from "@/components/transactions/add-task-form";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { contactDisplayName, formatCurrency, formatDate, formatDateWithYear } from "@/lib/format";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
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
  const progress = summarizeTaskProgress(transaction.tasks);

  const contractDocuments = transaction.documents.filter((doc) => doc.documentType === "CONTRACT");
  const contract = deriveContractStatus(contractDocuments);

  // Preserves generation order within each category (see getTransactionById's
  // tasks orderBy) and orders categories by first appearance, so a checklist
  // generated from templates renders in the same order it was defined.
  const checklistGroups: { category: string; tasks: typeof transaction.tasks }[] = [];
  for (const task of transaction.tasks) {
    const category = task.category ?? "Other";
    let group = checklistGroups.find((g) => g.category === category);
    if (!group) {
      group = { category, tasks: [] };
      checklistGroups.push(group);
    }
    group.tasks.push(task);
  }

  const timeline = [
    { date: transaction.createdAt, label: "Transaction created" },
    ...transaction.events.map((event) => ({
      date: event.createdAt,
      label: `${TRANSACTION_EVENT_TYPE_LABELS[event.eventType]} added — ${event.title}`,
    })),
    ...transaction.documents.map((document) => ({
      date: document.uploadedAt,
      label: `Document uploaded — ${document.filename}`,
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
                    <Link href={`/transactions/${transaction.id}/events/${event.id}/edit`} className="min-w-0 flex-1 hover:opacity-80">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatDateWithYear(event.date)}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </p>
                      {event.isCalculated ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Calculated from: {event.calculationBasis}
                          {event.isOverridden ? " · manually overridden" : ""}
                        </p>
                      ) : event.source === "contract_information" ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">Source: Contract Information</p>
                      ) : null}
                    </Link>
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
            <CardHeader title="Checklist" />
            <div className="flex flex-col gap-3 border-b border-border p-5">
              <ProgressBar complete={progress.complete} total={progress.total} />
              <div className="flex flex-wrap gap-2">
                <StatusBadge variant="attention" label={`${progress.overdue} Overdue`} />
                <StatusBadge variant="upcoming" label={`${progress.upcoming} Upcoming`} />
                <StatusBadge variant="on-track" label={`${progress.complete} Complete`} />
              </div>
            </div>
            {transaction.tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No checklist tasks yet"
                  description="Tasks tied to this transaction — generated from the buyer/seller checklist, or added manually — will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col">
                {checklistGroups.map((group) => (
                  <div key={group.category} className="border-b border-border last:border-b-0">
                    <p className="bg-surface-muted px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </p>
                    <div className="flex flex-col divide-y divide-border">
                      {group.tasks.map((task) => {
                        const isOverdue =
                          task.status === "PENDING" && task.dueDate !== null && task.dueDate < new Date();
                        return (
                          <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                            <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:opacity-80">
                              <p
                                className={`truncate text-sm font-medium ${
                                  task.status === "COMPLETED" || task.status === "CANCELLED"
                                    ? "text-muted-foreground line-through"
                                    : isOverdue
                                      ? "text-status-attention"
                                      : "text-foreground"
                                }`}
                              >
                                {task.title}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"} ·{" "}
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </p>
                              {task.transactionEvent ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  Linked to: {task.transactionEvent.title}
                                  {task.isOverridden ? " · manually overridden" : ""}
                                </p>
                              ) : null}
                            </Link>
                            {task.status === "PENDING" ? (
                              <div className="flex shrink-0 gap-2">
                                <form action={completeTaskAction}>
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <button
                                    type="submit"
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                                  >
                                    Complete
                                  </button>
                                </form>
                                <form action={cancelTaskAction}>
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <button
                                    type="submit"
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                                  >
                                    Cancel
                                  </button>
                                </form>
                              </div>
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
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border">
              <AddTaskForm transactionId={transaction.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Documents" />
            {transaction.documents.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No documents yet"
                  description="Upload the signed contract and other transaction documents below."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {transaction.documents.map((document) => (
                  <div key={document.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{document.filename}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[document.documentType]} · {formatDateWithYear(document.uploadedAt)} by{" "}
                        {document.uploadedByUser.name} · {formatFileSize(document.fileSize)}
                        {document.status !== "UPLOADED" ? ` · ${DOCUMENT_STATUS_LABELS[document.status]}` : ""}
                      </p>
                      {document.description ? (
                        <p className="truncate text-xs text-muted-foreground">{document.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a
                        href={`/api/documents/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        View
                      </a>
                      <a
                        href={`/api/documents/${document.id}?download=1`}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        Download
                      </a>
                      {document.documentType === "CONTRACT" ? (
                        document.contractInformation ? (
                          <Link
                            href={`/transactions/${transaction.id}/contract-information/${document.contractInformation.id}`}
                            className="rounded-md border border-accent px-2.5 py-1 text-xs font-medium text-accent hover:bg-surface-muted"
                          >
                            View Contract Information
                          </Link>
                        ) : (
                          <form action={createContractInformationAction}>
                            <input type="hidden" name="transactionId" value={transaction.id} />
                            <input type="hidden" name="documentId" value={document.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                            >
                              Enter Contract Information
                            </button>
                          </form>
                        )
                      ) : null}
                      {document.status !== "ARCHIVED" ? (
                        <form action={archiveDocumentAction}>
                          <input type="hidden" name="documentId" value={document.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted"
                          >
                            Archive
                          </button>
                        </form>
                      ) : null}
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="documentId" value={document.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-status-attention hover:bg-surface-muted"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border">
              <UploadDocumentForm transactionId={transaction.id} />
            </div>
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
            <CardHeader title="Contract Information" />
            <div className="flex flex-col gap-3 p-5">
              <p
                className={`text-sm font-medium ${
                  contract.status === "CONFIRMED" ? "text-status-ontrack" : "text-muted-foreground"
                }`}
              >
                {CONTRACT_STATUS_LABELS[contract.status]}
              </p>
              {contract.current?.contractInformation ? (
                <Link
                  href={`/transactions/${transaction.id}/contract-information/${contract.current.contractInformation.id}`}
                  className="rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-surface-muted"
                >
                  {contract.status === "CONFIRMED" ? "View Contract Information" : "Review & Confirm"}
                </Link>
              ) : contract.status === "UPLOADED" && contract.current ? (
                <p className="text-xs text-muted-foreground">
                  Use &ldquo;Enter Contract Information&rdquo; on the contract document below to get started.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Upload the signed contract as a Contract-type document below.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Transaction Progress" />
            <div className="flex flex-col gap-3 p-5">
              <ProgressBar complete={progress.complete} total={progress.total} />
              <div className="flex flex-col gap-2">
                <StatusBadge variant="attention" label={`${progress.overdue} Overdue`} />
                <StatusBadge variant="upcoming" label={`${progress.upcoming} Upcoming`} />
                <StatusBadge variant="on-track" label={`${progress.complete} Complete`} />
              </div>
            </div>
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
