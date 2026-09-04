import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listTransactions } from "@/lib/repos/transactions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { contactDisplayName, formatCurrency, formatDate } from "@/lib/format";
import { TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { deriveDeadlineStatus } from "@/lib/status";
import type { TransactionStatus, TransactionType } from "@/generated/prisma/enums";

export default async function TransactionsPage(props: PageProps<"/transactions">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const status =
    typeof searchParams.status === "string" ? (searchParams.status as TransactionStatus) : undefined;
  const type = typeof searchParams.type === "string" ? (searchParams.type as TransactionType) : undefined;

  const transactions = await listTransactions(session.user.id, { search, status, type });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every deal you&rsquo;re tracking, from prospect through closed.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <TextInput
            type="search"
            name="q"
            placeholder="Search client, address, MLS #"
            defaultValue={search}
          />
        </div>
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ""}>
          <option value="">All types</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
        {transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={search || status || type ? "No transactions match" : "No transactions yet"}
              description={
                search || status || type
                  ? "Try a different search or clear the filters."
                  : "Once a client is ready to move forward, start a transaction here to track it through to closing."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {transactions.map((transaction) => {
              const nextDeadline = transaction.events[0] ?? null;
              return (
                <Link
                  key={transaction.id}
                  href={`/transactions/${transaction.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contactDisplayName(transaction.contact)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {transaction.propertyAddress ?? "No address on file"} ·{" "}
                      {TRANSACTION_TYPE_LABELS[transaction.type]}
                      {formatCurrency(transaction.purchasePrice?.toString() ?? transaction.listingPrice?.toString())
                        ? ` · ${formatCurrency(transaction.purchasePrice?.toString() ?? transaction.listingPrice?.toString())}`
                        : ""}
                      {transaction.expectedClosingDate &&
                        ` · Closing ${formatDate(transaction.expectedClosingDate)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {TRANSACTION_STATUS_LABELS[transaction.status]}
                    </span>
                    {nextDeadline ? (
                      <StatusBadge
                        variant={deriveDeadlineStatus(nextDeadline.date)}
                        label={`${nextDeadline.title} · ${formatDate(nextDeadline.date)}`}
                      />
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
