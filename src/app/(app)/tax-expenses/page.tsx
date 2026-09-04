import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  getAvailableTaxYears,
  getExpenseYearSummary,
  getMileageYearTotal,
  listExpenses,
  type ExpenseSort,
} from "@/lib/repos/tax-expenses";
import { listCategoriesForUser } from "@/lib/tax-expenses/categories";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { formatCurrencyPrecise, formatDateWithYear } from "@/lib/format";
import { DEDUCTIBILITY_STATUS_LABELS } from "@/lib/labels";
import type { DeductibilityStatus } from "@/generated/prisma/enums";

const SORT_OPTIONS: { value: ExpenseSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount high–low" },
  { value: "amount_asc", label: "Amount low–high" },
];

export default async function TaxExpensesPage(props: PageProps<"/tax-expenses">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const availableYears = await getAvailableTaxYears(session.user.id);
  const currentYear = new Date().getUTCFullYear();
  const yearParam = typeof searchParams.year === "string" ? Number(searchParams.year) : undefined;
  const year = yearParam && availableYears.includes(yearParam) ? yearParam : (availableYears[0] ?? currentYear);

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const categoryId = typeof searchParams.category === "string" ? searchParams.category : undefined;
  const status = typeof searchParams.status === "string" ? (searchParams.status as DeductibilityStatus) : undefined;
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as ExpenseSort) : undefined;

  const [summary, mileageTotal, categories, expenses] = await Promise.all([
    getExpenseYearSummary(session.user.id, year),
    getMileageYearTotal(session.user.id, year),
    listCategoriesForUser(session.user.id),
    listExpenses(session.user.id, { taxYear: year, search, categoryId, status, sort }),
  ]);

  const hasFilters = Boolean(search || categoryId || status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tax & Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Business expenses, receipts, and mileage — for your records, not tax advice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tax-expenses/mileage"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Mileage
          </Link>
          <Link
            href="/tax-expenses/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            New Expense
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="year" className="mb-1.5 block text-sm font-medium text-foreground">
            Tax year
          </label>
          <Select id="year" name="year" defaultValue={String(year)}>
            {availableYears.map((availableYear) => (
              <option key={availableYear} value={availableYear}>
                {availableYear}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          View year
        </button>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <a
            href={`/api/tax-expenses/export?type=expenses&taxYear=${year}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Export expenses (CSV)
          </a>
          <a
            href={`/api/tax-expenses/export?type=mileage&taxYear=${year}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Export mileage (CSV)
          </a>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total expenses" value={formatCurrencyPrecise(summary.totalAmount) ?? "$0.00"} />
        <StatTile label="Deductible" value={formatCurrencyPrecise(summary.totalByStatus.DEDUCTIBLE) ?? "$0.00"} />
        <StatTile label="Needs review" value={formatCurrencyPrecise(summary.totalByStatus.NEEDS_REVIEW) ?? "$0.00"} />
        <StatTile label="Not deductible" value={formatCurrencyPrecise(summary.totalByStatus.NOT_DEDUCTIBLE) ?? "$0.00"} />
        <StatTile label="Business miles" value={Number(mileageTotal).toLocaleString()} />
        <StatTile label="Expense count" value={summary.expenseCount} />
      </div>

      <Card>
        <CardHeader
          title={`Category breakdown — ${year}`}
          action={
            <Link href="/reports" className="text-sm font-medium text-accent">
              Full report
            </Link>
          }
        />
        {summary.categoryBreakdown.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No categories yet" description="Add an expense to see your category breakdown." />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {summary.categoryBreakdown.map((row) => (
              <div key={row.categoryId} className="flex items-center justify-between gap-4 px-5 py-3">
                <p className={`min-w-0 truncate text-sm ${row.count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {row.categoryName}
                </p>
                <div className="flex shrink-0 items-baseline gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {row.count} {row.count === 1 ? "expense" : "expenses"}
                  </span>
                  <span className={`w-24 text-right font-medium ${row.count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {formatCurrencyPrecise(row.totalAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Expenses" />
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
          <input type="hidden" name="year" value={year} />
          <div className="min-w-[200px] flex-1">
            <TextInput type="search" name="q" placeholder="Search vendor, purpose, notes" defaultValue={search} />
          </div>
          <Select name="category" defaultValue={categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {Object.entries(DEDUCTIBILITY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="sort" defaultValue={sort ?? "date_desc"}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Apply
          </button>
          {hasFilters ? (
            <Link href={`/tax-expenses?year=${year}`} className="text-sm text-muted-foreground hover:text-foreground">
              Clear filters
            </Link>
          ) : null}
        </form>

        {expenses.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No expenses found"
              description={hasFilters ? "No expenses match those filters." : `No expenses recorded for ${year} yet.`}
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {expenses.map((expense) => {
              const associationLabel = expense.transaction
                ? expense.transaction.propertyAddress ?? "Transaction"
                : expense.contact
                  ? `${expense.contact.firstName} ${expense.contact.lastName}`
                  : null;
              const activeReceipts = expense.documents.filter((doc) => doc.status !== "PENDING_DELETION");

              return (
                <Link
                  key={expense.id}
                  href={`/tax-expenses/${expense.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{expense.vendor}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDateWithYear(expense.expenseDate)} · {expense.category.name} ·{" "}
                      {DEDUCTIBILITY_STATUS_LABELS[expense.deductibleStatus]}
                      {associationLabel ? ` · ${associationLabel}` : ""}
                      {activeReceipts.length > 0 ? ` · ${activeReceipts.length} receipt(s)` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {formatCurrencyPrecise(expense.amount.toString())}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
