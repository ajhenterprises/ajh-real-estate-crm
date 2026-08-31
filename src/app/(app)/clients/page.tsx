import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listClients, type ClientSort } from "@/lib/repos/clients";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { contactDisplayName, formatDateWithYear } from "@/lib/format";
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from "@/lib/labels";
import type { ClientStatus, ClientType } from "@/generated/prisma/enums";

const ACTIVE_TRANSACTION_STATUSES = new Set(["PROSPECT", "ACTIVE", "UNDER_CONTRACT", "PENDING"]);

const SORT_OPTIONS: { value: ClientSort; label: string }[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

export default async function ClientsPage(props: PageProps<"/clients">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const status = typeof searchParams.status === "string" ? (searchParams.status as ClientStatus) : undefined;
  const type = typeof searchParams.type === "string" ? (searchParams.type as ClientType) : undefined;
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as ClientSort) : undefined;

  const clients = await listClients(session.user.id, { search, status, type, sort });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacts you have an active or past business relationship with.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <TextInput type="search" name="q" placeholder="Search name, email, phone" defaultValue={search} />
        </div>
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ""}>
          <option value="">All types</option>
          {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort ?? "created_desc"}>
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
        {clients.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={search || status || type ? "No clients match" : "No clients yet"}
              description={
                search || status || type
                  ? "Try a different search or clear the filters."
                  : "Turn a contact into a client once they're ready to buy or sell, and they'll show up here."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {clients.map((client) => {
              const activeCount = client.transactions.filter((t) =>
                ACTIVE_TRANSACTION_STATUSES.has(t.status),
              ).length;
              const recent = client.transactions[0];
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contactDisplayName(client.contact)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[client.contact.email, client.contact.phone].filter(Boolean).join(" · ") ||
                        "No contact info on file"}
                    </p>
                    {recent ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Most recent: {recent.propertyAddress ?? "Transaction"} ·{" "}
                        {formatDateWithYear(recent.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-xs font-medium text-muted-foreground">
                      {CLIENT_TYPE_LABELS[client.type]}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        client.status === "ACTIVE" ? "text-status-ontrack" : "text-muted-foreground"
                      }`}
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {activeCount} active transaction{activeCount === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Added {formatDateWithYear(client.createdAt)}
                    </span>
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
