"use client";

import { useActionState } from "react";
import { createMileageAction, updateMileageAction } from "@/lib/tax-expenses/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { toDateInputValue, contactDisplayName } from "@/lib/format";

interface MileageFormProps {
  transactions: { id: string; propertyAddress: string | null }[];
  contacts: { id: string; firstName: string; lastName: string }[];
  mileageRecord?: {
    id: string;
    date: Date;
    startLocation: string;
    destination: string;
    businessPurpose: string;
    miles: string;
    notes: string | null;
    transactionId: string | null;
    contactId: string | null;
  };
}

export function MileageForm({ transactions, contacts, mileageRecord }: MileageFormProps) {
  const isEdit = Boolean(mileageRecord);
  const [state, formAction, pending] = useActionState(isEdit ? updateMileageAction : createMileageAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="mileageRecordId" value={mileageRecord!.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="date">
          <TextInput id="date" name="date" type="date" required defaultValue={toDateInputValue(mileageRecord?.date)} autoFocus />
        </Field>
        <Field label="Miles" htmlFor="miles">
          <TextInput id="miles" name="miles" type="text" inputMode="decimal" placeholder="0.0" required defaultValue={mileageRecord?.miles} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Starting location" htmlFor="startLocation">
          <TextInput id="startLocation" name="startLocation" required defaultValue={mileageRecord?.startLocation} />
        </Field>
        <Field label="Destination" htmlFor="destination">
          <TextInput id="destination" name="destination" required defaultValue={mileageRecord?.destination} />
        </Field>
      </div>

      <Field label="Business purpose" htmlFor="businessPurpose">
        <TextInput id="businessPurpose" name="businessPurpose" required defaultValue={mileageRecord?.businessPurpose} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Transaction" htmlFor="transactionId" hint="Optional">
          <Select id="transactionId" name="transactionId" defaultValue={mileageRecord?.transactionId ?? ""}>
            <option value="">None</option>
            {transactions.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {transaction.propertyAddress ?? "Untitled transaction"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client / contact" htmlFor="contactId" hint="Optional">
          <Select id="contactId" name="contactId" defaultValue={mileageRecord?.contactId ?? ""}>
            <option value="">None</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contactDisplayName(contact)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} defaultValue={mileageRecord?.notes ?? ""} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        {isEdit ? "Save changes" : "Add mileage"}
      </SubmitButton>
    </form>
  );
}
