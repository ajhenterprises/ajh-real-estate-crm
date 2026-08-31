"use client";

import { useActionState } from "react";
import type { TransactionFormState } from "@/lib/transactions/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/labels";

export interface TransactionFormValues {
  type?: string;
  status?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  mlsNumber?: string;
  listingPrice?: string;
  purchasePrice?: string;
  contractEffectiveDate?: string;
  expectedClosingDate?: string;
  actualClosingDate?: string;
  notes?: string;
}

export function TransactionForm({
  action,
  hiddenField,
  defaultValues,
  submitLabel,
  pendingLabel,
}: {
  action: (state: TransactionFormState | undefined, formData: FormData) => Promise<TransactionFormState>;
  hiddenField: { name: string; value: string };
  defaultValues?: TransactionFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name={hiddenField.name} value={hiddenField.value} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Transaction type" htmlFor="type">
          <Select id="type" name="type" defaultValue={defaultValues?.type ?? "BUYER"} required>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "ACTIVE"} required>
            {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Property address" htmlFor="propertyAddress" hint="Optional">
        <TextInput
          id="propertyAddress"
          name="propertyAddress"
          defaultValue={defaultValues?.propertyAddress}
        />
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

      <Field label="MLS number" htmlFor="mlsNumber" hint="Optional">
        <TextInput id="mlsNumber" name="mlsNumber" defaultValue={defaultValues?.mlsNumber} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Listing price" htmlFor="listingPrice" hint="Optional">
          <TextInput
            id="listingPrice"
            name="listingPrice"
            inputMode="decimal"
            placeholder="450000"
            defaultValue={defaultValues?.listingPrice}
          />
        </Field>
        <Field label="Purchase price" htmlFor="purchasePrice" hint="Optional">
          <TextInput
            id="purchasePrice"
            name="purchasePrice"
            inputMode="decimal"
            placeholder="450000"
            defaultValue={defaultValues?.purchasePrice}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Contract effective" htmlFor="contractEffectiveDate" hint="Optional">
          <TextInput
            id="contractEffectiveDate"
            name="contractEffectiveDate"
            type="date"
            defaultValue={defaultValues?.contractEffectiveDate}
          />
        </Field>
        <Field label="Expected closing" htmlFor="expectedClosingDate" hint="Optional">
          <TextInput
            id="expectedClosingDate"
            name="expectedClosingDate"
            type="date"
            defaultValue={defaultValues?.expectedClosingDate}
          />
        </Field>
        <Field label="Actual closing" htmlFor="actualClosingDate" hint="Optional">
          <TextInput
            id="actualClosingDate"
            name="actualClosingDate"
            type="date"
            defaultValue={defaultValues?.actualClosingDate}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
