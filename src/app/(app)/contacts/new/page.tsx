import { requireSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/contacts/contact-form";
import { createContactAction } from "@/lib/contacts/actions";

export default async function NewContactPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add someone to your CRM manually.
        </p>
      </div>

      <Card className="max-w-2xl p-6">
        <ContactForm action={createContactAction} submitLabel="Save contact" pendingLabel="Saving…" />
      </Card>
    </div>
  );
}
