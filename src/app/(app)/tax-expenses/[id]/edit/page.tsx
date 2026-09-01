import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getExpenseById } from "@/lib/repos/tax-expenses";
import { listTransactions } from "@/lib/repos/transactions";
import { listContacts } from "@/lib/repos/contacts";
import { listCategoriesForUser } from "@/lib/tax-expenses/categories";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseForm } from "@/components/tax-expenses/expense-form";
import { AttachReceiptForm } from "@/components/tax-expenses/attach-receipt-form";
import { deleteExpenseAction, removeExpenseReceiptAction } from "@/lib/tax-expenses/actions";
import { formatFileSize } from "@/lib/documents/validation";
import { DOCUMENT_STATUS_LABELS } from "@/lib/labels";
import { formatDateWithYear } from "@/lib/format";

export default async function EditExpensePage(props: PageProps<"/tax-expenses/[id]/edit">) {
  const { id } = await props.params;
  const session = await requireSession();

  const [expense, categories, transactions, contacts] = await Promise.all([
    getExpenseById(session.user.id, id),
    listCategoriesForUser(session.user.id),
    listTransactions(session.user.id),
    listContacts(session.user.id),
  ]);
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Edit Expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">{expense.vendor}</p>
        </div>
        <form action={deleteExpenseAction}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-status-attention hover:bg-surface-muted"
          >
            Delete expense
          </button>
        </form>
      </div>

      <Card>
        <CardHeader title="Expense details" />
        <div className="p-5">
          <ExpenseForm
            categories={categories}
            transactions={transactions}
            contacts={contacts}
            expense={{
              id: expense.id,
              expenseDate: expense.expenseDate,
              amount: expense.amount.toString(),
              vendor: expense.vendor,
              categoryId: expense.categoryId,
              businessPurpose: expense.businessPurpose,
              paymentMethod: expense.paymentMethod,
              deductibleStatus: expense.deductibleStatus,
              businessUsePercent: expense.businessUsePercent,
              notes: expense.notes,
              transactionId: expense.transactionId,
              contactId: expense.contactId,
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Receipts" />
        {expense.documents.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No receipts attached" description="Attach a receipt or supporting document below." />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {expense.documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{document.filename}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatDateWithYear(document.uploadedAt)} · {formatFileSize(document.fileSize)}
                    {document.status !== "UPLOADED" ? ` · ${DOCUMENT_STATUS_LABELS[document.status]}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={`/api/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    View
                  </a>
                  {document.status !== "PENDING_DELETION" ? (
                    <form action={removeExpenseReceiptAction}>
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-status-attention hover:bg-surface-muted"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-border p-5">
          <AttachReceiptForm expenseId={expense.id} />
        </div>
      </Card>
    </div>
  );
}
