"use client";

import { useActionState } from "react";
import { updateTransactionEventAction } from "@/lib/transactions/actions";
import { Field, FormError, SubmitButton, TextArea, TextInput } from "@/components/ui/form";

export function EditEventForm({
  eventId,
  defaultDate,
  defaultNotes,
  defaultOverrideNote,
  isCalculated,
}: {
  eventId: string;
  defaultDate?: string;
  defaultNotes?: string;
  defaultOverrideNote?: string;
  isCalculated: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTransactionEventAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />

      <Field label="Date" htmlFor="date">
        <TextInput id="date" name="date" type="date" required defaultValue={defaultDate} />
      </Field>

      {isCalculated ? (
        <Field label="Override note" htmlFor="overrideNote" hint="Optional — explain why this date differs from the calculation">
          <TextInput id="overrideNote" name="overrideNote" defaultValue={defaultOverrideNote} />
        </Field>
      ) : null}

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={2} defaultValue={defaultNotes} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
