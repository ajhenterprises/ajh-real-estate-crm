import { requireSession } from "@/lib/auth/session";
import { listTransactions } from "@/lib/repos/transactions";
import { listContacts } from "@/lib/repos/contacts";
import { listCategoriesForUser } from "@/lib/tax-expenses/categories";
import { Card, CardHeader } from "@/components/ui/card";
import { ExpenseForm } from "@/components/tax-expenses/expense-form";

export default async function NewExpensePage() {
  const session = await requireSession();
  const [categories, transactions, contacts] = await Promise.all([
    listCategoriesForUser(session.user.id),
    listTransactions(session.user.id),
    listContacts(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Expense</h1>
        <p className="mt-1 text-sm text-muted-foreground">Record a business expense for your files.</p>
      </div>

      <Card>
        <CardHeader title="Expense details" />
        <div className="p-5">
          <ExpenseForm categories={categories} transactions={transactions} contacts={contacts} />
        </div>
      </Card>
    </div>
  );
}
