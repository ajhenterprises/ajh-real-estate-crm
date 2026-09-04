"use client";

import { useActionState } from "react";
import type { ShowingFormState } from "@/lib/showings/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { SHOWING_STATUS_LABELS } from "@/lib/labels";
import { contactDisplayName } from "@/lib/format";

export interface ShowingFormOptions {
  contacts: { id: string; firstName: string; lastName: string }[];
}

export interface ShowingFormValues {
  propertyAddress?: string;
  scheduledAt?: string;
  status?: string;
  notes?: string;
  contactId?: string;
}

export function ShowingForm({
  action,
  showingId,
  options,
  defaultValues,
}: {
  action: (state: ShowingFormState | undefined, formData: FormData) => Promise<ShowingFormState>;
  showingId: string;
  options: ShowingFormOptions;
  defaultValues?: ShowingFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isUnassigned = !defaultValues?.contactId;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="showingId" value={showingId} />

      {isUnassigned ? (
        <p className="rounded-md bg-status-upcoming-bg px-3 py-2 text-sm text-status-upcoming">
          This showing isn&rsquo;t linked to a contact yet — pick one below.
        </p>
      ) : null}

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

      <Field label="Contact" htmlFor="contactId" hint="Optional">
        <Select id="contactId" name="contactId" defaultValue={defaultValues?.contactId ?? ""}>
          <option value="">None</option>
          {options.contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contactDisplayName(contact)}
            </option>
          ))}
        </Select>
      </Field>

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
