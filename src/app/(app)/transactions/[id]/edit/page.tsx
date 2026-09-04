import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTransactionById } from "@/lib/repos/transactions";
import { updateTransactionAction } from "@/lib/transactions/actions";
import { Card } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { toDateInputValue } from "@/lib/format";

export default async function EditTransactionPage(props: PageProps<"/transactions/[id]/edit">) {
  const session = await requireSession();
  const { id } = await props.params;

  const transaction = await getTransactionById(session.user.id, id);
  if (!transaction) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/transactions/${transaction.id}`} className="hover:text-foreground">
            {transaction.propertyAddress ?? "Transaction"}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Edit Transaction</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <TransactionForm
          action={updateTransactionAction}
          hiddenField={{ name: "transactionId", value: transaction.id }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          defaultValues={{
            type: transaction.type,
            status: transaction.status,
            propertyAddress: transaction.propertyAddress ?? undefined,
            propertyCity: transaction.propertyCity ?? undefined,
            propertyState: transaction.propertyState ?? undefined,
            propertyZip: transaction.propertyZip ?? undefined,
            mlsNumber: transaction.mlsNumber ?? undefined,
            listingPrice: transaction.listingPrice?.toString(),
            purchasePrice: transaction.purchasePrice?.toString(),
            commissionAmount: transaction.commissionAmount?.toString(),
            contractEffectiveDate: toDateInputValue(transaction.contractEffectiveDate),
            expectedClosingDate: toDateInputValue(transaction.expectedClosingDate),
            actualClosingDate: toDateInputValue(transaction.actualClosingDate),
            notes: transaction.notes ?? undefined,
          }}
        />
      </Card>
    </div>
  );
}
