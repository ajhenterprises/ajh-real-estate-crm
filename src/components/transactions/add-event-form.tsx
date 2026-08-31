"use client";

import { useActionState } from "react";
import { addTransactionEventAction } from "@/lib/transactions/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { TRANSACTION_EVENT_TYPE_LABELS } from "@/lib/labels";

export function AddEventForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(addTransactionEventAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-5">
      <input type="hidden" name="transactionId" value={transactionId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Event type" htmlFor="eventType">
          <Select id="eventType" name="eventType" defaultValue="OTHER" required>
            {Object.entries(TRANSACTION_EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="date">
          <TextInput id="date" name="date" type="date" required />
        </Field>
      </div>

      <Field label="Title" htmlFor="title" hint="Optional — defaults to the event type">
        <TextInput id="title" name="title" />
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={2} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Adding…">
        Add date
      </SubmitButton>
    </form>
  );
}
