import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getExpenseById } from "@/lib/repos/tax-expenses";
import { deleteExpenseAction } from "@/lib/tax-expenses/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { formatCurrencyPrecise, formatDateWithYear, contactDisplayName } from "@/lib/format";
import { DEDUCTIBILITY_STATUS_LABELS, PAYMENT_METHOD_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/labels";
import { formatFileSize } from "@/lib/documents/validation";

export default async function ExpenseDetailPage(props: PageProps<"/tax-expenses/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const expense = await getExpenseById(session.user.id, id);
  if (!expense) notFound();

  const activeReceipts = expense.documents.filter((doc) => doc.status !== "PENDING_DELETION");
  const associationLabel = expense.transaction
    ? expense.transaction.propertyAddress ?? "Transaction"
    : expense.contact
      ? contactDisplayName(expense.contact)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <Link href="/tax-expenses" className="hover:text-foreground">
              Tax & Expenses
            </Link>{" "}
            / {expense.vendor}
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold text-foreground">{expense.vendor}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateWithYear(expense.expenseDate)} · {expense.category.name} ·{" "}
            {formatCurrencyPrecise(expense.amount.toString())}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/tax-expenses/${expense.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
          <Link
            href={`/tax-expenses/${expense.id}/duplicate`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Duplicate
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader title="Expense details" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Date" value={formatDateWithYear(expense.expenseDate)} />
          <InfoField label="Amount" value={formatCurrencyPrecise(expense.amount.toString())} />
          <InfoField label="Vendor / payee" value={expense.vendor} />
          <InfoField label="Category" value={expense.category.name} />
          <InfoField label="Payment method" value={PAYMENT_METHOD_LABELS[expense.paymentMethod]} />
          <InfoField label="Status" value={DEDUCTIBILITY_STATUS_LABELS[expense.deductibleStatus]} />
          <InfoField
            label="Business use %"
            value={expense.businessUsePercent !== null ? `${expense.businessUsePercent}%` : null}
          />
          <InfoField label="Linked to" value={associationLabel} />
        </div>
        {expense.businessPurpose ? (
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business purpose</p>
            <p className="mt-1 text-sm text-foreground">{expense.businessPurpose}</p>
          </div>
        ) : null}
        {expense.notes ? (
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{expense.notes}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Receipts"
          action={
            <Link href={`/tax-expenses/${expense.id}/edit`} className="text-sm font-medium text-accent">
              Manage
            </Link>
          }
        />
        {activeReceipts.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No receipts attached" description="Attach one from the edit page." />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {activeReceipts.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{document.filename}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatFileSize(document.fileSize)}
                    {document.status !== "UPLOADED" ? ` · ${DOCUMENT_STATUS_LABELS[document.status]}` : ""}
                  </p>
                </div>
                <a
                  href={`/api/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Delete Expense" />
        <div className="p-5">
          <DeleteButton
            action={deleteExpenseAction}
            hiddenField={{ name: "expenseId", value: expense.id }}
            confirmMessage={`Delete this ${formatCurrencyPrecise(expense.amount.toString())} expense from ${expense.vendor}? This can't be undone.`}
            label="Delete expense"
          />
        </div>
      </Card>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
