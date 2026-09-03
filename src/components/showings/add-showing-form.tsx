"use client";

import { useActionState } from "react";
import { createShowingAction } from "@/lib/showings/actions";
import { Field, FormError, SubmitButton, TextArea, TextInput } from "@/components/ui/form";

/** Embedded on the Contact and Client profile pages — pass exactly one of contactId/clientId, matching whichever profile this is rendered on. */
export function AddShowingForm({ contactId, clientId }: { contactId?: string; clientId?: string }) {
  const [state, formAction, pending] = useActionState(createShowingAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-5">
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
      {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}

      <Field label="Property address" htmlFor="showingPropertyAddress">
        <TextInput id="showingPropertyAddress" name="propertyAddress" required />
      </Field>

      <Field label="Date & time" htmlFor="showingScheduledAt">
        <TextInput id="showingScheduledAt" name="scheduledAt" type="datetime-local" required />
      </Field>

      <Field label="Notes" htmlFor="showingNotes" hint="Optional">
        <TextArea id="showingNotes" name="notes" rows={2} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Scheduling…">
        Schedule showing
      </SubmitButton>
    </form>
  );
}
