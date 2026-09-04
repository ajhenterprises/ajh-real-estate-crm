import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getOwnedContact } from "@/lib/repos/transactions";
import { createTransactionAction } from "@/lib/transactions/actions";
import { Card } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { contactDisplayName } from "@/lib/format";

export default async function NewTransactionPage(props: PageProps<"/contacts/[id]/transactions/new">) {
  const session = await requireSession();
  const { id } = await props.params;

  const contact = await getOwnedContact(session.user.id, id);
  if (!contact) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/contacts/${contact.id}`} className="hover:text-foreground">
            {contactDisplayName(contact)}
          </Link>{" "}
          / New Transaction
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">New Transaction</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <TransactionForm
          action={createTransactionAction}
          hiddenField={{ name: "contactId", value: contact.id }}
          submitLabel="Save transaction"
          pendingLabel="Saving…"
        />
      </Card>
    </div>
  );
}
