import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getContactById } from "@/lib/repos/contacts";
import { updateContactAction } from "@/lib/contacts/actions";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/contacts/contact-form";
import { contactDisplayName } from "@/lib/format";

export default async function EditContactPage(props: PageProps<"/contacts/[id]/edit">) {
  const session = await requireSession();
  const { id } = await props.params;

  const contact = await getContactById(session.user.id, id);
  if (!contact) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/contacts/${contact.id}`} className="hover:text-foreground">
            {contactDisplayName(contact)}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Edit Contact</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <ContactForm
          action={updateContactAction}
          hiddenField={{ name: "contactId", value: contact.id }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          defaultValues={{
            firstName: contact.firstName,
            lastName: contact.lastName,
            preferredName: contact.preferredName ?? undefined,
            email: contact.email ?? undefined,
            phone: contact.phone ?? undefined,
            secondaryPhone: contact.secondaryPhone ?? undefined,
            address: contact.address ?? undefined,
            city: contact.city ?? undefined,
            state: contact.state ?? undefined,
            zip: contact.zip ?? undefined,
            contactType: contact.contactType,
            clientType: contact.clientType ?? undefined,
            source: contact.source,
            notes: contact.notes ?? undefined,
          }}
        />
      </Card>
    </div>
  );
}
