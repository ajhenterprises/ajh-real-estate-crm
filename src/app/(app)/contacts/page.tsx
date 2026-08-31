import { requireSession } from "@/lib/auth/session";
import { listContacts } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  BOLDTRAIL: "BoldTrail",
  FOLLOW_UP_BOSS: "Follow Up Boss",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export default async function ContactsPage() {
  const session = await requireSession();
  const contacts = await listContacts(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone in your CRM, regardless of where they came from.
        </p>
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
              <div key={contact.id} className="flex items-center justify-between px-5 py-3">
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
                  {SOURCE_LABELS[contact.source] ?? contact.source}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
