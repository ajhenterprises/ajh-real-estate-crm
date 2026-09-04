import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getExpenseById } from "@/lib/repos/tax-expenses";
import { Card, CardHeader } from "@/components/ui/card";
import { DuplicateExpenseForm } from "@/components/tax-expenses/duplicate-expense-form";
import { formatCurrencyPrecise } from "@/lib/format";

export default async function DuplicateExpensePage(props: PageProps<"/tax-expenses/[id]/duplicate">) {
  const session = await requireSession();
  const { id } = await props.params;

  const expense = await getExpenseById(session.user.id, id);
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/tax-expenses/${expense.id}`} className="hover:text-foreground">
            {expense.vendor}
          </Link>{" "}
          / Duplicate
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Duplicate Expense</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a new, separate expense with the same details — the original is never changed.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader title="What's being copied" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <SummaryField label="Vendor / payee" value={expense.vendor} />
          <SummaryField label="Category" value={expense.category.name} />
          <SummaryField label="Amount" value={formatCurrencyPrecise(expense.amount.toString()) ?? "—"} />
          <SummaryField label="Notes" value={expense.notes || "—"} />
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Receipts are not copied — attach a new one on the duplicate after it&rsquo;s created, if needed.
        </p>
      </Card>

      <Card className="max-w-xl p-6">
        <DuplicateExpenseForm expenseId={expense.id} />
      </Card>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}
