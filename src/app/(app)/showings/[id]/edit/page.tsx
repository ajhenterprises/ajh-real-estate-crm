import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getShowingById, listShowingFormOptions } from "@/lib/repos/showings";
import { updateShowingAction } from "@/lib/showings/actions";
import { Card } from "@/components/ui/card";
import { ShowingForm } from "@/components/showings/showing-form";
import { toDateTimeInputValue } from "@/lib/format";

export default async function EditShowingPage(props: PageProps<"/showings/[id]/edit">) {
  const session = await requireSession();
  const { id } = await props.params;

  const [showing, options] = await Promise.all([
    getShowingById(session.user.id, id),
    listShowingFormOptions(session.user.id),
  ]);
  if (!showing) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/showings/${showing.id}`} className="hover:text-foreground">
            {showing.propertyAddress}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Edit Showing</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <ShowingForm
          action={updateShowingAction}
          showingId={showing.id}
          options={options}
          defaultValues={{
            propertyAddress: showing.propertyAddress,
            scheduledAt: toDateTimeInputValue(showing.scheduledAt),
            status: showing.status,
            notes: showing.notes ?? undefined,
            contactId: showing.contactId ?? undefined,
            clientId: showing.clientId ?? undefined,
          }}
        />
      </Card>
    </div>
  );
}
