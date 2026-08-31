import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTransactionEventById } from "@/lib/repos/transactions";
import { resetTransactionEventOverrideAction } from "@/lib/transactions/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EditEventForm } from "@/components/transactions/edit-event-form";
import { formatDateWithYear, toDateInputValue } from "@/lib/format";

export default async function EditTransactionEventPage(
  props: PageProps<"/transactions/[id]/events/[eventId]/edit">,
) {
  const session = await requireSession();
  const { id, eventId } = await props.params;

  const event = await getTransactionEventById(session.user.id, eventId);
  if (!event || event.transactionId !== id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/transactions/${id}`} className="hover:text-foreground">
            {event.title}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{event.title}</h1>
      </div>

      {event.isCalculated ? (
        <Card>
          <CardHeader title="Calculated from contract information" />
          <div className="flex flex-col gap-2 p-5">
            <p className="text-sm text-foreground">{event.calculationBasis}</p>
            {event.calculatedDate ? (
              <p className="text-sm text-muted-foreground">
                Current calculation: {formatDateWithYear(event.calculatedDate)}
              </p>
            ) : null}
            {event.isOverridden ? (
              <div className="mt-2 flex items-center justify-between rounded-md bg-status-upcoming-bg px-3 py-2">
                <p className="text-sm text-status-upcoming">
                  This date has been manually overridden from the calculated value.
                </p>
                <form action={resetTransactionEventOverrideAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    Reset to calculated date
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Changing the date below will mark this event as manually overridden.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      <Card className="max-w-xl p-6">
        <EditEventForm
          eventId={event.id}
          defaultDate={toDateInputValue(event.date)}
          defaultNotes={event.notes ?? undefined}
          defaultOverrideNote={event.overrideNote ?? undefined}
          isCalculated={event.isCalculated}
        />
      </Card>
    </div>
  );
}
