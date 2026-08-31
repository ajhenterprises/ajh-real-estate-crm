import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listContacts } from "@/lib/repos/contacts";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName } from "@/lib/format";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";

export default async function ContactsPage() {
  const session = await requireSession();
  const contacts = await listContacts(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone in your CRM, regardless of where they came from.
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          New Contact
        </Link>
      </div>

      <Card>
        {contacts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No contacts yet"
              description="Contacts you add manually, or that sync in from BoldTrail and Follow Up Boss once connected, will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {contacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {contactDisplayName(contact)}
                    {contact.client ? " · Client" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact info on file"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {CONTACT_SOURCE_LABELS[contact.source]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
