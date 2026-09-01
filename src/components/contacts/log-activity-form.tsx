"use client";

import { useActionState } from "react";
import { logContactActivityAction } from "@/lib/contacts/actions";
import { Field, FormError, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { CONTACT_ACTIVITY_TYPE_LABELS } from "@/lib/labels";

const LOGGABLE_TYPES = ["CALL", "EMAIL", "TEXT", "SHOWING", "NOTE_ADDED"] as const;

export function LogActivityForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState(logContactActivityAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-5">
      <input type="hidden" name="contactId" value={contactId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="activityType">
          <Select id="activityType" name="type" defaultValue="CALL" required>
            {LOGGABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTACT_ACTIVITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="activityNotes" hint="Optional — e.g. “discussed listing timeline”">
        <TextArea id="activityNotes" name="notes" rows={2} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Logging…">
        Log activity
      </SubmitButton>
    </form>
  );
}
