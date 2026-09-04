import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getAvailableTaxYears, getMileageYearTotal, listMileageRecords, type MileageSort } from "@/lib/repos/tax-expenses";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { formatDateWithYear } from "@/lib/format";
import { deleteMileageAction } from "@/lib/tax-expenses/actions";

const SORT_OPTIONS: { value: MileageSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "miles_desc", label: "Miles high–low" },
  { value: "miles_asc", label: "Miles low–high" },
];

export default async function MileagePage(props: PageProps<"/tax-expenses/mileage">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const availableYears = await getAvailableTaxYears(session.user.id);
  const currentYear = new Date().getUTCFullYear();
  const yearParam = typeof searchParams.year === "string" ? Number(searchParams.year) : undefined;
  const year = yearParam && availableYears.includes(yearParam) ? yearParam : (availableYears[0] ?? currentYear);

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as MileageSort) : undefined;

  const [total, records] = await Promise.all([
    getMileageYearTotal(session.user.id, year),
    listMileageRecords(session.user.id, { taxYear: year, search, sort }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mileage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Business mileage — actual miles driven, tracked independently of any tax rate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tax-expenses" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted">
            Expenses
          </Link>
          <Link
            href="/tax-expenses/mileage/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            New Mileage
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
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted">
          View year
        </button>
        <a
          href={`/api/tax-expenses/export?type=mileage&taxYear=${year}`}
          className="ml-auto rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Export (CSV)
        </a>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label={`Total miles — ${year}`} value={Number(total).toLocaleString()} />
        <StatTile label="Trip count" value={records.length} />
      </div>

      <Card>
        <CardHeader title="Mileage log" />
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
          <input type="hidden" name="year" value={year} />
          <div className="min-w-[200px] flex-1">
            <TextInput type="search" name="q" placeholder="Search start, destination, purpose" defaultValue={search} />
          </div>
          <Select name="sort" defaultValue={sort ?? "date_desc"}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Apply
          </button>
        </form>

        {records.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No mileage recorded" description={`No mileage recorded for ${year} yet.`} />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {records.map((record) => {
              const associationLabel = record.transaction
                ? record.transaction.propertyAddress ?? "Transaction"
                : record.contact
                  ? `${record.contact.firstName} ${record.contact.lastName}`
                  : null;
              return (
                <div key={record.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/tax-expenses/mileage/${record.id}/edit`} className="min-w-0 flex-1 hover:opacity-80">
                    <p className="truncate text-sm font-medium text-foreground">
                      {record.startLocation} → {record.destination}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDateWithYear(record.date)} · {record.businessPurpose} · {record.miles.toString()} mi
                      {associationLabel ? ` · ${associationLabel}` : ""}
                    </p>
                  </Link>
                  <form action={deleteMileageAction} className="shrink-0">
                    <input type="hidden" name="mileageRecordId" value={record.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-status-attention hover:bg-surface-muted"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
