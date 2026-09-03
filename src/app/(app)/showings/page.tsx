import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listShowings, type ShowingSort, type ShowingStatusFilter } from "@/lib/repos/showings";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { cancelShowingAction, completeShowingAction, reopenShowingAction } from "@/lib/showings/actions";
import { contactDisplayName, formatDateTimeWithYear } from "@/lib/format";

const STATUS_OPTIONS: { value: ShowingStatusFilter | "ALL"; label: string }[] = [
  { value: "SCHEDULED", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All statuses" },
];

const SORT_OPTIONS: { value: ShowingSort; label: string }[] = [
  { value: "soonest", label: "Soonest first" },
  { value: "newest", label: "Newest scheduled" },
  { value: "oldest", label: "Oldest scheduled" },
];

export default async function ShowingsPage(props: PageProps<"/showings">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const statusParam = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const status = statusParam
    ? statusParam === "ALL"
      ? undefined
      : (statusParam as ShowingStatusFilter)
    : "SCHEDULED";
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as ShowingSort) : undefined;

  const showings = await listShowings(session.user.id, { search, status, sort });
  const hasFilters = Boolean(search || (statusParam && statusParam !== "SCHEDULED"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Showings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every scheduled showing, for a client or contact. Schedule new ones from their profile page.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <TextInput type="search" name="q" placeholder="Search address, client, contact" defaultValue={search} />
        </div>
        <Select name="status" defaultValue={statusParam ?? "SCHEDULED"}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort ?? "soonest"}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Apply
        </button>
      </form>

      <Card>
        {showings.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={hasFilters ? "No showings match" : "No showings scheduled"}
              description={
                hasFilters
                  ? "Try a different search or clear the filters."
                  : "Schedule a showing from a contact or client's profile page and it'll show up here — and on the Calendar."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {showings.map((showing) => {
              const who = showing.client
                ? contactDisplayName(showing.client.contact)
                : showing.contact
                  ? contactDisplayName(showing.contact)
                  : "Unassigned";
              const whoHref = showing.client
                ? `/clients/${showing.client.id}`
                : showing.contact
                  ? `/contacts/${showing.contact.id}`
                  : `/showings/${showing.id}/edit`;

              return (
                <div key={showing.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <Link href={`/showings/${showing.id}`} className="min-w-0 flex-1 hover:opacity-80">
                    <p
                      className={`truncate text-sm font-medium ${
                        showing.status === "CANCELLED" ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {showing.propertyAddress}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDateTimeWithYear(showing.scheduledAt)} · {who}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={whoHref}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      {showing.client ? "View Client" : showing.contact ? "View Contact" : "Assign"}
                    </Link>
                    {showing.status === "SCHEDULED" ? (
                      <>
                        <form action={completeShowingAction}>
                          <input type="hidden" name="showingId" value={showing.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                          >
                            Complete
                          </button>
                        </form>
                        <form action={cancelShowingAction}>
                          <input type="hidden" name="showingId" value={showing.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                          >
                            Cancel
                          </button>
                        </form>
                      </>
                    ) : (
                      <form action={reopenShowingAction}>
                        <input type="hidden" name="showingId" value={showing.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Reopen
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
