import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getMileageRecordById } from "@/lib/repos/tax-expenses";
import { listTransactions } from "@/lib/repos/transactions";
import { listContacts } from "@/lib/repos/contacts";
import { Card, CardHeader } from "@/components/ui/card";
import { MileageForm } from "@/components/tax-expenses/mileage-form";

export default async function EditMileagePage(props: PageProps<"/tax-expenses/mileage/[id]/edit">) {
  const { id } = await props.params;
  const session = await requireSession();

  const [mileageRecord, transactions, contacts] = await Promise.all([
    getMileageRecordById(session.user.id, id),
    listTransactions(session.user.id),
    listContacts(session.user.id),
  ]);
  if (!mileageRecord) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Edit Mileage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mileageRecord.startLocation} → {mileageRecord.destination}
        </p>
      </div>

      <Card>
        <CardHeader title="Trip details" />
        <div className="p-5">
          <MileageForm
            transactions={transactions}
            contacts={contacts}
            mileageRecord={{
              id: mileageRecord.id,
              date: mileageRecord.date,
              startLocation: mileageRecord.startLocation,
              destination: mileageRecord.destination,
              businessPurpose: mileageRecord.businessPurpose,
              miles: mileageRecord.miles.toString(),
              notes: mileageRecord.notes,
              transactionId: mileageRecord.transactionId,
              contactId: mileageRecord.contactId,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
