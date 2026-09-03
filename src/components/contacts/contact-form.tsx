"use client";

import { useActionState } from "react";
import type { CreateContactState } from "@/lib/contacts/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";

export interface ContactFormValues {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  contactType?: string;
  source?: string;
  notes?: string;
}

export function ContactForm({
  action,
  hiddenField,
  defaultValues,
  submitLabel,
  pendingLabel,
}: {
  action: (state: CreateContactState | undefined, formData: FormData) => Promise<CreateContactState>;
  hiddenField?: { name: string; value: string };
  defaultValues?: ContactFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {hiddenField ? <input type="hidden" name={hiddenField.name} value={hiddenField.value} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <TextInput id="firstName" name="firstName" required autoFocus defaultValue={defaultValues?.firstName} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <TextInput id="lastName" name="lastName" required defaultValue={defaultValues?.lastName} />
        </Field>
      </div>

      <Field label="Preferred name" htmlFor="preferredName" hint="Optional">
        <TextInput id="preferredName" name="preferredName" defaultValue={defaultValues?.preferredName} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <TextInput id="email" name="email" type="email" defaultValue={defaultValues?.email} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput id="phone" name="phone" type="tel" defaultValue={defaultValues?.phone} />
        </Field>
      </div>

      <Field label="Secondary phone" htmlFor="secondaryPhone" hint="Optional">
        <TextInput id="secondaryPhone" name="secondaryPhone" type="tel" defaultValue={defaultValues?.secondaryPhone} />
      </Field>

      <Field label="Address" htmlFor="address" hint="Optional">
        <TextInput id="address" name="address" defaultValue={defaultValues?.address} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city">
          <TextInput id="city" name="city" defaultValue={defaultValues?.city} />
        </Field>
        <Field label="State" htmlFor="state">
          <TextInput id="state" name="state" defaultValue={defaultValues?.state} />
        </Field>
        <Field label="ZIP" htmlFor="zip">
          <TextInput id="zip" name="zip" defaultValue={defaultValues?.zip} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact type" htmlFor="contactType">
          <Select id="contactType" name="contactType" defaultValue={defaultValues?.contactType ?? "LEAD"}>
            {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="source">
          <Select id="source" name="source" defaultValue={defaultValues?.source ?? "MANUAL"}>
            {Object.entries(CONTACT_SOURCE_LABELS).map(([value, label]) => (
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

      <SubmitButton pending={pending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
