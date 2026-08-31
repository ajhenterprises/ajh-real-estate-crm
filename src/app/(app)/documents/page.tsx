import { requireSession } from "@/lib/auth/session";
import { listDocuments } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactDisplayName, formatDateWithYear } from "@/lib/format";

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
            {documents.map((document) => (
              <div key={document.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{document.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {document.transaction?.propertyAddress ??
                      (document.client ? contactDisplayName(document.client.contact) : "Unattached")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateWithYear(document.uploadedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
