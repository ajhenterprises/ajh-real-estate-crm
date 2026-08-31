"use client";

import { useActionState } from "react";
import { updateContractInformationAction } from "@/lib/contracts/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { CONTRACT_PERIOD_DAY_TYPE_LABELS } from "@/lib/labels";

export interface ContractInformationFormValues {
  buyerNames?: string;
  sellerNames?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  purchasePrice?: string;
  earnestMoneyAmount?: string;
  contractEffectiveDate?: string;
  expectedClosingDate?: string;
  earnestMoneyDueDate?: string;
  inspectionPeriodDays?: string;
  inspectionPeriodDayType?: string;
  financingPeriodDays?: string;
  financingPeriodDayType?: string;
  appraisalPeriodDays?: string;
  appraisalPeriodDayType?: string;
  titlePeriodDays?: string;
  titlePeriodDayType?: string;
  notes?: string;
}

function PeriodField({
  label,
  daysName,
  dayTypeName,
  defaultDays,
  defaultDayType,
}: {
  label: string;
  daysName: string;
  dayTypeName: string;
  defaultDays?: string;
  defaultDayType?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={label} htmlFor={daysName} hint="Number of days — leave blank if unknown">
        <TextInput id={daysName} name={daysName} type="number" min={0} max={3650} defaultValue={defaultDays} />
      </Field>
      <Field label="Day type" htmlFor={dayTypeName}>
        <Select id={dayTypeName} name={dayTypeName} defaultValue={defaultDayType ?? ""}>
          <option value="">Not specified</option>
          {Object.entries(CONTRACT_PERIOD_DAY_TYPE_LABELS).map(([value, dayLabel]) => (
            <option key={value} value={value}>
              {dayLabel}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function ContractInformationForm({
  contractInformationId,
  defaultValues,
}: {
  contractInformationId: string;
  defaultValues?: ContractInformationFormValues;
}) {
  const [state, formAction, pending] = useActionState(updateContractInformationAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="contractInformationId" value={contractInformationId} />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Parties</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Buyer name(s)" htmlFor="buyerNames" hint="Optional">
            <TextInput id="buyerNames" name="buyerNames" defaultValue={defaultValues?.buyerNames} />
          </Field>
          <Field label="Seller name(s)" htmlFor="sellerNames" hint="Optional">
            <TextInput id="sellerNames" name="sellerNames" defaultValue={defaultValues?.sellerNames} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Property</h3>
        <p className="text-xs text-muted-foreground">
          Only fill these in if the contract&rsquo;s stated address differs from the transaction&rsquo;s property address.
        </p>
        <Field label="Address" htmlFor="propertyAddress" hint="Optional">
          <TextInput id="propertyAddress" name="propertyAddress" defaultValue={defaultValues?.propertyAddress} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="propertyCity">
            <TextInput id="propertyCity" name="propertyCity" defaultValue={defaultValues?.propertyCity} />
          </Field>
          <Field label="State" htmlFor="propertyState">
            <TextInput id="propertyState" name="propertyState" defaultValue={defaultValues?.propertyState} />
          </Field>
          <Field label="ZIP" htmlFor="propertyZip">
            <TextInput id="propertyZip" name="propertyZip" defaultValue={defaultValues?.propertyZip} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Financial</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase price" htmlFor="purchasePrice" hint="Optional">
            <TextInput
              id="purchasePrice"
              name="purchasePrice"
              inputMode="decimal"
              placeholder="450000"
              defaultValue={defaultValues?.purchasePrice}
            />
          </Field>
          <Field label="Earnest money amount" htmlFor="earnestMoneyAmount" hint="Optional">
            <TextInput
              id="earnestMoneyAmount"
              name="earnestMoneyAmount"
              inputMode="decimal"
              placeholder="5000"
              defaultValue={defaultValues?.earnestMoneyAmount}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Important Dates</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Contract effective date" htmlFor="contractEffectiveDate" hint="Optional">
            <TextInput
              id="contractEffectiveDate"
              name="contractEffectiveDate"
              type="date"
              defaultValue={defaultValues?.contractEffectiveDate}
            />
          </Field>
          <Field label="Closing date" htmlFor="expectedClosingDate" hint="Optional">
            <TextInput
              id="expectedClosingDate"
              name="expectedClosingDate"
              type="date"
              defaultValue={defaultValues?.expectedClosingDate}
            />
          </Field>
          <Field label="Earnest money due" htmlFor="earnestMoneyDueDate" hint="Optional">
            <TextInput
              id="earnestMoneyDueDate"
              name="earnestMoneyDueDate"
              type="date"
              defaultValue={defaultValues?.earnestMoneyDueDate}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Contract Periods</h3>
        <p className="text-xs text-muted-foreground">
          Only periods with both a day count and a day type will produce a calculated deadline when
          confirmed — nothing here assumes a default length. Business days count Monday–Friday only;
          holidays are not excluded.
        </p>
        <PeriodField
          label="Inspection period"
          daysName="inspectionPeriodDays"
          dayTypeName="inspectionPeriodDayType"
          defaultDays={defaultValues?.inspectionPeriodDays}
          defaultDayType={defaultValues?.inspectionPeriodDayType}
        />
        <PeriodField
          label="Financing period"
          daysName="financingPeriodDays"
          dayTypeName="financingPeriodDayType"
          defaultDays={defaultValues?.financingPeriodDays}
          defaultDayType={defaultValues?.financingPeriodDayType}
        />
        <PeriodField
          label="Appraisal period"
          daysName="appraisalPeriodDays"
          dayTypeName="appraisalPeriodDayType"
          defaultDays={defaultValues?.appraisalPeriodDays}
          defaultDayType={defaultValues?.appraisalPeriodDayType}
        />
        <PeriodField
          label="Title period"
          daysName="titlePeriodDays"
          dayTypeName="titlePeriodDayType"
          defaultDays={defaultValues?.titlePeriodDays}
          defaultDayType={defaultValues?.titlePeriodDayType}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Notes</h3>
        <Field label="Notes" htmlFor="notes" hint="Optional">
          <TextArea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
        </Field>
      </section>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save draft
      </SubmitButton>
    </form>
  );
}
