import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getContactById } from "@/lib/repos/contacts";
import { convertToClientAction } from "@/lib/contacts/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import { contactDisplayName, formatDateWithYear } from "@/lib/format";
import { CONTACT_TYPE_LABELS, CLIENT_TYPE_LABELS, TRANSACTION_STATUS_LABELS } from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";

export default async function ContactDetailPage(props: PageProps<"/contacts/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const contact = await getContactById(session.user.id, id);
  if (!contact) notFound();

  return (
    <div className="flex flex-col gap-6">
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
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Source: {CONTACT_SOURCE_LABELS[contact.source]}
        </p>
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
                  description="Actions on this contact — created, notes, status changes, synced updates — will show up here."
                />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {contact.activities.map((activity) => (
                  <div key={activity.id} className="px-5 py-3">
                    <p className="text-sm text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateWithYear(activity.createdAt)} · {CONTACT_SOURCE_LABELS[activity.source]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
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
