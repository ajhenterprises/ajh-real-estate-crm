import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getOwnedClient } from "@/lib/repos/transactions";
import { createTransactionAction } from "@/lib/transactions/actions";
import { Card } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { contactDisplayName } from "@/lib/format";

export default async function NewTransactionPage(props: PageProps<"/clients/[id]/transactions/new">) {
  const session = await requireSession();
  const { id } = await props.params;

  const client = await getOwnedClient(session.user.id, id);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clients/${client.id}`} className="hover:text-foreground">
            {contactDisplayName(client.contact)}
          </Link>{" "}
          / New Transaction
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">New Transaction</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <TransactionForm
          action={createTransactionAction}
          hiddenField={{ name: "clientId", value: client.id }}
          submitLabel="Save transaction"
          pendingLabel="Saving…"
        />
      </Card>
    </div>
  );
}
