import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listDocuments } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName, formatDateWithYear } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { formatFileSize } from "@/lib/documents/validation";

export default async function DocumentsPage() {
  const session = await requireSession();
  const documents = await listDocuments(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contracts, disclosures, and other files attached to your clients and transactions.
        </p>
      </div>

      <Card>
        {documents.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No documents yet"
              description="Documents you upload from a transaction's page will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {documents.map((document) => {
              const owner = document.transaction
                ? { label: document.transaction.propertyAddress ?? "Transaction", href: `/transactions/${document.transaction.id}` }
                : document.client
                  ? { label: contactDisplayName(document.client.contact), href: `/clients/${document.client.id}` }
                  : document.contact
                    ? { label: contactDisplayName(document.contact), href: `/contacts/${document.contact.id}` }
                    : null;

              return (
                <div
                  key={document.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{document.filename}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[document.documentType]} · {formatDateWithYear(document.uploadedAt)} ·{" "}
                      {formatFileSize(document.fileSize)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {owner ? (
                      <Link
                        href={owner.href}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        {owner.label}
                      </Link>
                    ) : null}
                    <a
                      href={`/api/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      View
                    </a>
                    <a
                      href={`/api/documents/${document.id}?download=1`}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Download
                    </a>
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
