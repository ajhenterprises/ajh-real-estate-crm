"use client";

import { useActionState } from "react";
import type { UpdateClientState } from "@/lib/clients/actions";
import { Field, FormError, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from "@/lib/labels";

export function ClientForm({
  action,
  clientId,
  defaultValues,
}: {
  action: (state: UpdateClientState | undefined, formData: FormData) => Promise<UpdateClientState>;
  clientId: string;
  defaultValues: { status: string; type: string; notes?: string };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client type" htmlFor="type">
          <Select id="type" name="type" defaultValue={defaultValues.type}>
            {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={defaultValues.status}>
            {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaultValues.notes} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
