import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getContactById } from "@/lib/repos/contacts";
import { convertToClientAction, deleteContactAction } from "@/lib/contacts/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import { DeleteButton } from "@/components/ui/delete-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FollowUpForm } from "@/components/contacts/follow-up-form";
import { LogActivityForm } from "@/components/contacts/log-activity-form";
import { contactDisplayName, formatDateWithYear, toDateInputValue } from "@/lib/format";
import { CONTACT_TYPE_LABELS, CLIENT_TYPE_LABELS, TRANSACTION_STATUS_LABELS, CONTACT_ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";
import { deriveFollowUpStatus } from "@/lib/status";
import { getLastContactedActivity } from "@/lib/contacts/activity";

export default async function ContactDetailPage(props: PageProps<"/contacts/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const contact = await getContactById(session.user.id, id);
  if (!contact) notFound();

  const followUpStatus = deriveFollowUpStatus(contact.nextFollowUpDate);
  const lastContacted = getLastContactedActivity(contact.activities);

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
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {CONTACT_TYPE_LABELS[contact.contactType]}
            </span>
            {followUpStatus === "overdue" || followUpStatus === "due-today" ? (
              <StatusBadge
                variant="attention"
                label={followUpStatus === "overdue" ? "Follow-up overdue" : "Follow up today"}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Source: {CONTACT_SOURCE_LABELS[contact.source]}
            {lastContacted
              ? ` · Last contacted ${formatDateWithYear(lastContacted.createdAt)} (${CONTACT_ACTIVITY_TYPE_LABELS[lastContacted.type]})`
              : " · Not contacted yet"}
          </p>
        </div>
        <Link
          href={`/contacts/${contact.id}/edit`}
          className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Edit
        </Link>
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
            <CardHeader title="Tasks" />
            {contact.tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No open tasks"
                  description="Tasks tied to this contact will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.tasks.map((task) => (
                  <div key={task.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.dueDate ? `Due ${formatDateWithYear(task.dueDate)}` : "No due date"}
                    </p>
                  </div>
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
                hasFollowUpDate={contact.nextFollowUpDate !== null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Client Status" />
            <div className="p-5">
              {contact.client ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-foreground">
                    Already a client — {CLIENT_TYPE_LABELS[contact.client.type]}
                  </p>
                  <Link
                    href={`/clients/${contact.client.id}`}
                    className="rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-surface-muted"
                  >
                    View Client
                  </Link>
                  {contact.client.transactions.length > 0 ? (
                    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Recent transactions
                      </p>
                      {contact.client.transactions.map((transaction) => (
                        <Link
                          key={transaction.id}
                          href={`/transactions/${transaction.id}`}
                          className="text-sm text-foreground hover:text-accent"
                        >
                          {transaction.propertyAddress ?? "No address on file"} ·{" "}
                          <span className="text-muted-foreground">
                            {TRANSACTION_STATUS_LABELS[transaction.status]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <form action={convertToClientAction} className="flex flex-col gap-3">
                  <input type="hidden" name="contactId" value={contact.id} />
                  <p className="text-sm text-muted-foreground">
                    Turn this contact into a client to start tracking transactions for them.
                  </p>
                  <Select name="type" defaultValue="BUYER" required aria-label="Client type">
                    {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Convert to Client
                  </button>
                </form>
              )}
            </div>
          </Card>

          {contact.client ? null : (
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
          )}
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
