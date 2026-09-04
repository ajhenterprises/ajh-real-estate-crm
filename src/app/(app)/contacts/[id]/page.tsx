import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getClosedTransactionsForContact, getContactById } from "@/lib/repos/contacts";
import { deleteContactAction } from "@/lib/contacts/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FollowUpForm } from "@/components/contacts/follow-up-form";
import { LogActivityForm } from "@/components/contacts/log-activity-form";
import { AddShowingForm } from "@/components/showings/add-showing-form";
import { cancelShowingAction, completeShowingAction } from "@/lib/showings/actions";
import {
  contactDisplayName,
  formatDate,
  formatDateTimeWithYear,
  formatDateWithYear,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/format";
import {
  CLIENT_CONTACT_TYPES,
  CLIENT_TYPE_LABELS,
  CONTACT_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
  CONTACT_ACTIVITY_TYPE_LABELS,
} from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";
import { deriveFollowUpStatus } from "@/lib/status";
import { getLastContactedActivity } from "@/lib/contacts/activity";

export default async function ContactDetailPage(props: PageProps<"/contacts/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const contact = await getContactById(session.user.id, id);
  if (!contact) notFound();

  const closedTransactions = await getClosedTransactionsForContact(session.user.id, contact.id);

  const followUpStatus = deriveFollowUpStatus(contact.nextFollowUpDate);
  const lastContacted = getLastContactedActivity(contact.activities);
  const isClient = CLIENT_CONTACT_TYPES.includes(contact.contactType);
  const canDelete = contact.transactions.length === 0 && closedTransactions.length === 0;
  const nextShowing = contact.showings[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/contacts" className="hover:text-foreground">
              Contacts
            </Link>{" "}
            / {contactDisplayName(contact)}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{contactDisplayName(contact)}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                contact.contactType === "ACTIVE_CLIENT"
                  ? "bg-status-ontrack-bg text-status-ontrack"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {CONTACT_TYPE_LABELS[contact.contactType]}
              {isClient && contact.clientType ? ` · ${CLIENT_TYPE_LABELS[contact.clientType]}` : ""}
            </span>
            {followUpStatus === "overdue" || followUpStatus === "due-today" ? (
              <StatusBadge
                variant="attention"
                label={followUpStatus === "overdue" ? "Follow-up overdue" : "Follow up today"}
              />
            ) : null}
            {nextShowing ? (
              <StatusBadge variant="upcoming" label={`Showing ${formatDateTimeWithYear(nextShowing.scheduledAt)}`} />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Source: {CONTACT_SOURCE_LABELS[contact.source]}
            {lastContacted
              ? ` · Last contacted ${formatDateWithYear(lastContacted.createdAt)} (${CONTACT_ACTIVITY_TYPE_LABELS[lastContacted.type]})`
              : " · Not contacted yet"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/contacts/${contact.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
          <Link
            href={`/contacts/${contact.id}/transactions/new`}
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
              <InfoField label="Email" value={contact.email} />
              <InfoField label="Phone" value={contact.phone} />
              <InfoField label="Secondary phone" value={contact.secondaryPhone} />
              <InfoField
                label="Address"
                value={
                  [contact.address, [contact.city, contact.state].filter(Boolean).join(", "), contact.zip]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
            </div>
            {contact.notes ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{contact.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Showings" action={<Link href="/showings" className="text-sm font-medium text-accent">View all</Link>} />
            {contact.showings.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No showings scheduled" description="Schedule one below." />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.showings.map((showing) => (
                  <div key={showing.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <Link href={`/showings/${showing.id}`} className="min-w-0 flex-1 hover:opacity-80">
                      <p className="truncate text-sm font-medium text-foreground">{showing.propertyAddress}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTimeWithYear(showing.scheduledAt)}</p>
                    </Link>
                    <div className="flex shrink-0 gap-2">
                      <form action={completeShowingAction}>
                        <input type="hidden" name="showingId" value={showing.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Complete
                        </button>
                      </form>
                      <form action={cancelShowingAction}>
                        <input type="hidden" name="showingId" value={showing.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border">
              <AddShowingForm contactId={contact.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Active Transactions" />
            {contact.transactions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No active transactions"
                  description="Start a transaction for this contact and it will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.transactions.map((transaction) => (
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
            {closedTransactions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No closed transactions yet"
                  description="Closed and cancelled transactions for this contact will appear here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {closedTransactions.map((transaction) => (
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
            {contact.activities.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No activity yet"
                  description="Calls, emails, texts, showings, and notes you log will show up here, alongside system events like status changes."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.activities.map((activity) => (
                  <div key={activity.id} className="px-5 py-3">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{CONTACT_ACTIVITY_TYPE_LABELS[activity.type]}</span>
                      {activity.description && activity.description !== CONTACT_ACTIVITY_TYPE_LABELS[activity.type]
                        ? ` — ${activity.description}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateWithYear(activity.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border">
              <LogActivityForm contactId={contact.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Follow-Up" />
            <div className="p-5">
              <FollowUpForm
                contactId={contact.id}
                defaultDate={toDateInputValue(contact.nextFollowUpDate)}
                defaultTime={toTimeInputValue(contact.nextFollowUpDate)}
                hasFollowUpDate={contact.nextFollowUpDate !== null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Tasks" />
            {contact.tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No open tasks" description="Tasks tied to this contact will show up here." />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block px-5 py-3 hover:bg-surface-muted"
                  >
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.dueDate ? `Due ${formatDateWithYear(task.dueDate)}` : "No due date"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {canDelete ? (
            <Card>
              <CardHeader title="Delete Contact" />
              <div className="p-5">
                <DeleteButton
                  action={deleteContactAction}
                  hiddenField={{ name: "contactId", value: contact.id }}
                  confirmMessage={`Delete ${contactDisplayName(contact)}? This can't be undone.`}
                  label="Delete contact"
                />
              </div>
            </Card>
          ) : null}
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
