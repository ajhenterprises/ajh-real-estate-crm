"use client";

import { useActionState } from "react";
import type { ShowingFormState } from "@/lib/showings/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { SHOWING_STATUS_LABELS } from "@/lib/labels";

export interface ShowingFormValues {
  propertyAddress?: string;
  scheduledAt?: string;
  status?: string;
  notes?: string;
}

export function ShowingForm({
  action,
  showingId,
  defaultValues,
}: {
  action: (state: ShowingFormState | undefined, formData: FormData) => Promise<ShowingFormState>;
  showingId: string;
  defaultValues?: ShowingFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="showingId" value={showingId} />

      <Field label="Property address" htmlFor="propertyAddress">
        <TextInput id="propertyAddress" name="propertyAddress" required defaultValue={defaultValues?.propertyAddress} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date & time" htmlFor="scheduledAt">
          <TextInput
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={defaultValues?.scheduledAt}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "SCHEDULED"} required>
            {Object.entries(SHOWING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
