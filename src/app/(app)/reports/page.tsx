import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getAvailableTaxYears, getExpenseYearSummary, getMileageYearTotal } from "@/lib/repos/tax-expenses";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import { formatCurrencyPrecise } from "@/lib/format";

export default async function ReportsPage(props: PageProps<"/reports">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const availableYears = await getAvailableTaxYears(session.user.id);
  const currentYear = new Date().getUTCFullYear();
  const yearParam = typeof searchParams.year === "string" ? Number(searchParams.year) : undefined;
  const year = yearParam && availableYears.includes(yearParam) ? yearParam : (availableYears[0] ?? currentYear);

  const [summary, mileageTotal] = await Promise.all([
    getExpenseYearSummary(session.user.id, year),
    getMileageYearTotal(session.user.id, year),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tax-year totals, ready to hand to your CPA — record-keeping only, not tax advice.
          </p>
        </div>
        <a
          href={`/api/tax-expenses/export?type=summary&taxYear=${year}`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Download {year} Tax Summary (CSV)
        </a>
      </div>

      <form method="get" className="flex items-end gap-3">
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
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total expenses" value={formatCurrencyPrecise(summary.totalAmount) ?? "$0.00"} />
        <StatTile label="Deductible" value={formatCurrencyPrecise(summary.totalByStatus.DEDUCTIBLE) ?? "$0.00"} />
        <StatTile label="Needs review" value={formatCurrencyPrecise(summary.totalByStatus.NEEDS_REVIEW) ?? "$0.00"} />
        <StatTile label="Not deductible" value={formatCurrencyPrecise(summary.totalByStatus.NOT_DEDUCTIBLE) ?? "$0.00"} />
        <StatTile label="Business miles" value={Number(mileageTotal).toLocaleString()} />
        <StatTile label="Expense count" value={summary.expenseCount} />
      </div>

      <Card>
        <CardHeader title={`Category breakdown — ${year}`} />
        {summary.categoryBreakdown.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No expenses yet" description={`No expenses recorded for ${year} yet.`} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5">Category</th>
                  <th className="px-5 py-2.5">Count</th>
                  <th className="px-5 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.categoryBreakdown.map((row) => (
                  <tr key={row.categoryId}>
                    <td className="px-5 py-2.5 text-foreground">{row.categoryName}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{row.count}</td>
                    <td className="px-5 py-2.5 text-foreground">{formatCurrencyPrecise(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Detail exports" />
        <div className="flex flex-wrap gap-2 p-5">
          <a
            href={`/api/tax-expenses/export?type=expenses&taxYear=${year}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Every expense (CSV)
          </a>
          <a
            href={`/api/tax-expenses/export?type=mileage&taxYear=${year}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Every mileage record (CSV)
          </a>
          <Link
            href={`/tax-expenses?year=${year}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Manage Tax & Expenses
          </Link>
        </div>
      </Card>
    </div>
  );
}
