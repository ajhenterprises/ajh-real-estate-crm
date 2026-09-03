import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getClientById } from "@/lib/repos/clients";
import { updateClientAction } from "@/lib/clients/actions";
import { Card } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";
import { contactDisplayName } from "@/lib/format";

export default async function EditClientPage(props: PageProps<"/clients/[id]/edit">) {
  const session = await requireSession();
  const { id } = await props.params;

  const client = await getClientById(session.user.id, id);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clients/${client.id}`} className="hover:text-foreground">
            {contactDisplayName(client.contact)}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Edit Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact info (name, email, phone, address) is edited from the contact record itself.
        </p>
      </div>

      <Card className="max-w-2xl p-6">
        <ClientForm
          action={updateClientAction}
          clientId={client.id}
          defaultValues={{ status: client.status, type: client.type, notes: client.notes ?? undefined }}
        />
      </Card>
    </div>
  );
}
