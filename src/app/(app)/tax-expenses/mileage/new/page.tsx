import { requireSession } from "@/lib/auth/session";
import { listTransactions } from "@/lib/repos/transactions";
import { listContacts } from "@/lib/repos/contacts";
import { Card, CardHeader } from "@/components/ui/card";
import { MileageForm } from "@/components/tax-expenses/mileage-form";

export default async function NewMileagePage() {
  const session = await requireSession();
  const [transactions, contacts] = await Promise.all([
    listTransactions(session.user.id),
    listContacts(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Mileage</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log a business trip.</p>
      </div>

      <Card>
        <CardHeader title="Trip details" />
        <div className="p-5">
          <MileageForm transactions={transactions} contacts={contacts} />
        </div>
      </Card>
    </div>
  );
}
