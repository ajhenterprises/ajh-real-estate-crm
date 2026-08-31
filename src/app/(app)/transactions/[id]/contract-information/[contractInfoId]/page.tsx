import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getContractInformationById } from "@/lib/repos/contract-information";
import { confirmContractInformationAction } from "@/lib/contracts/actions";
import { calculateContractEvents } from "@/lib/contracts/dates";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import { CONTRACT_PERIOD_DAY_TYPE_LABELS } from "@/lib/labels";

export default async function ContractInformationPage(
  props: PageProps<"/transactions/[id]/contract-information/[contractInfoId]">,
) {
  const session = await requireSession();
  const { id, contractInfoId } = await props.params;

  const info = await getContractInformationById(session.user.id, contractInfoId);
  if (!info || info.transactionId !== id) notFound();

  const isConfirmed = info.confirmedAt !== null;
  const previewEvents = calculateContractEvents(info);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/transactions/${id}`} className="hover:text-foreground">
              {info.document.filename}
            </Link>{" "}
            / Contract Information
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Contract Information</h1>
          {isConfirmed ? (
            <p className="mt-1 text-sm font-medium text-status-ontrack">
              Confirmed {formatDateWithYear(info.confirmedAt as Date)}
              {info.confirmedByUser ? ` by ${info.confirmedByUser.name}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-status-upcoming">Not confirmed</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/transactions/${id}/contract-information/${info.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
          <form action={confirmContractInformationAction}>
            <input type="hidden" name="contractInformationId" value={info.id} />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {isConfirmed ? "Re-confirm Contract Information" : "Confirm Contract Information"}
            </button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader title="Contract" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Contract document" value={info.document.filename} />
          <InfoField
            label="Contract effective date"
            value={info.contractEffectiveDate ? formatDateWithYear(info.contractEffectiveDate) : null}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Parties" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Buyer name(s)" value={info.buyerNames} />
          <InfoField label="Seller name(s)" value={info.sellerNames} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Property" />
        <div className="p-5">
          <InfoField
            label="Address"
            value={
              [info.propertyAddress, [info.propertyCity, info.propertyState].filter(Boolean).join(", "), info.propertyZip]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Blank means the contract&rsquo;s address matches the transaction&rsquo;s property address.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Financial" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Purchase price" value={formatCurrency(info.purchasePrice?.toString())} />
          <InfoField label="Earnest money amount" value={formatCurrency(info.earnestMoneyAmount?.toString())} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Contract Periods" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <PeriodField label="Inspection period" days={info.inspectionPeriodDays} dayType={info.inspectionPeriodDayType} />
          <PeriodField label="Financing period" days={info.financingPeriodDays} dayType={info.financingPeriodDayType} />
          <PeriodField label="Appraisal period" days={info.appraisalPeriodDays} dayType={info.appraisalPeriodDayType} />
          <PeriodField label="Title period" days={info.titlePeriodDays} dayType={info.titlePeriodDayType} />
        </div>
      </Card>

      {info.notes ? (
        <Card>
          <CardHeader title="Notes" />
          <p className="whitespace-pre-wrap p-5 text-sm text-foreground">{info.notes}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={isConfirmed ? "Transaction Events From This Contract" : "Preview — Dates This Will Create"}
        />
        {previewEvents.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Enter contract dates and periods above to see which transaction events confirming this record
            will create.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {previewEvents.map((event) => (
              <div key={event.eventType} className="px-5 py-3">
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-sm text-muted-foreground">{formatDateWithYear(event.date)}</p>
                {event.isCalculated ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Calculated from: {event.calculationBasis}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!isConfirmed && previewEvents.length > 0 ? (
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            These dates are a preview only. Confirm this contract information to create them as active
            transaction events.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function PeriodField({
  label,
  days,
  dayType,
}: {
  label: string;
  days: number | null;
  dayType: keyof typeof CONTRACT_PERIOD_DAY_TYPE_LABELS | null;
}) {
  const value = days !== null ? `${days} day${days === 1 ? "" : "s"}${dayType ? ` · ${CONTRACT_PERIOD_DAY_TYPE_LABELS[dayType]}` : " · day type not specified"}` : null;
  return <InfoField label={label} value={value} />;
}
