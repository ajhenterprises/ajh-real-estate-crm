import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getContractInformationById } from "@/lib/repos/contract-information";
import { Card } from "@/components/ui/card";
import { ContractInformationForm } from "@/components/contracts/contract-information-form";
import { toDateInputValue } from "@/lib/format";

export default async function EditContractInformationPage(
  props: PageProps<"/transactions/[id]/contract-information/[contractInfoId]/edit">,
) {
  const session = await requireSession();
  const { id, contractInfoId } = await props.params;

  const info = await getContractInformationById(session.user.id, contractInfoId);
  if (!info || info.transactionId !== id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/transactions/${id}`} className="hover:text-foreground">
            {info.document.filename}
          </Link>{" "}
          / Contract Information / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Contract Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter what the signed contract says. Nothing here becomes an active deadline until you review
          and confirm it.
        </p>
      </div>

      <Card className="max-w-3xl p-6">
        <ContractInformationForm
          contractInformationId={info.id}
          defaultValues={{
            buyerNames: info.buyerNames ?? undefined,
            sellerNames: info.sellerNames ?? undefined,
            propertyAddress: info.propertyAddress ?? undefined,
            propertyCity: info.propertyCity ?? undefined,
            propertyState: info.propertyState ?? undefined,
            propertyZip: info.propertyZip ?? undefined,
            purchasePrice: info.purchasePrice?.toString(),
            earnestMoneyAmount: info.earnestMoneyAmount?.toString(),
            contractEffectiveDate: toDateInputValue(info.contractEffectiveDate),
            expectedClosingDate: toDateInputValue(info.expectedClosingDate),
            earnestMoneyDueDate: toDateInputValue(info.earnestMoneyDueDate),
            inspectionPeriodDays: info.inspectionPeriodDays?.toString(),
            inspectionPeriodDayType: info.inspectionPeriodDayType ?? undefined,
            financingPeriodDays: info.financingPeriodDays?.toString(),
            financingPeriodDayType: info.financingPeriodDayType ?? undefined,
            appraisalPeriodDays: info.appraisalPeriodDays?.toString(),
            appraisalPeriodDayType: info.appraisalPeriodDayType ?? undefined,
            titlePeriodDays: info.titlePeriodDays?.toString(),
            titlePeriodDayType: info.titlePeriodDayType ?? undefined,
            notes: info.notes ?? undefined,
          }}
        />
      </Card>
    </div>
  );
}
