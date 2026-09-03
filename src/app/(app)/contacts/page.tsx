import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listContacts, type ContactFollowUpFilter, type ContactSort } from "@/lib/repos/contacts";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { contactDisplayName, formatDateWithYearAndOptionalTime } from "@/lib/format";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";
import { deriveFollowUpStatus } from "@/lib/status";
import type { ContactType } from "@/generated/prisma/enums";

const SORT_OPTIONS: { value: ContactSort; label: string }[] = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

const FOLLOW_UP_OPTIONS: { value: ContactFollowUpFilter | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "needs", label: "Needs Follow-Up" },
  { value: "none", label: "No Follow-Up" },
];

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const type = typeof searchParams.type === "string" ? (searchParams.type as ContactType) : undefined;
  const followUp =
    typeof searchParams.followUp === "string" ? (searchParams.followUp as ContactFollowUpFilter) : undefined;
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as ContactSort) : undefined;

  const contacts = await listContacts(session.user.id, { search, type, followUp, sort });
  const hasFilters = Boolean(search || type || followUp);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone in your CRM, regardless of where they came from.
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          New Contact
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <TextInput type="search" name="q" placeholder="Search name, email, phone" defaultValue={search} />
        </div>
        <Select name="type" defaultValue={type ?? ""}>
          <option value="">All types</option>
          {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="followUp" defaultValue={followUp ?? ""}>
          {FOLLOW_UP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort ?? "updated_desc"}>
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
        {contacts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={hasFilters ? "No contacts match" : "No contacts yet"}
              description={
                hasFilters
                  ? "Try a different search or clear the filters."
                  : "Contacts you add manually, or that sync in from BoldTrail and Follow Up Boss once connected, will appear here."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {contacts.map((contact) => {
              const followUpStatus = deriveFollowUpStatus(contact.nextFollowUpDate);
              return (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contactDisplayName(contact)}
                      {contact.client ? " · Client" : ""}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact info on file"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-xs text-muted-foreground">
                      {CONTACT_SOURCE_LABELS[contact.source]}
                    </span>
                    {contact.nextFollowUpDate ? (
                      <span
                        className={`text-xs font-medium ${
                          followUpStatus === "overdue" || followUpStatus === "due-today"
                            ? "text-status-attention"
                            : "text-muted-foreground"
                        }`}
                      >
                        Follow up {formatDateWithYearAndOptionalTime(contact.nextFollowUpDate)}
                      </span>
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
