import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getShowingById } from "@/lib/repos/showings";
import { cancelShowingAction, completeShowingAction, reopenShowingAction } from "@/lib/showings/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { contactDisplayName, formatDateTimeWithYear } from "@/lib/format";
import { SHOWING_STATUS_LABELS } from "@/lib/labels";

export default async function ShowingDetailPage(props: PageProps<"/showings/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const showing = await getShowingById(session.user.id, id);
  if (!showing) notFound();

  const who = showing.contact ? contactDisplayName(showing.contact) : null;
  const whoHref = showing.contact ? `/contacts/${showing.contact.id}` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/showings" className="hover:text-foreground">
              Showings
            </Link>{" "}
            / {showing.propertyAddress}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{showing.propertyAddress}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/showings/${showing.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
          {showing.status === "SCHEDULED" ? (
            <>
              <form action={completeShowingAction}>
                <input type="hidden" name="showingId" value={showing.id} />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Complete
                </button>
              </form>
              <form action={cancelShowingAction}>
                <input type="hidden" name="showingId" value={showing.id} />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
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
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Reopen
              </button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Showing Details" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Status" value={SHOWING_STATUS_LABELS[showing.status]} />
          <InfoField label="Date & time" value={formatDateTimeWithYear(showing.scheduledAt)} />
          <InfoField label="Contact" value={who} href={whoHref} />
        </div>
        {showing.notes ? (
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{showing.notes}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function InfoField({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {value && href ? (
        <Link href={href} className="mt-0.5 block text-sm text-accent hover:underline">
          {value}
        </Link>
      ) : (
        <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}
