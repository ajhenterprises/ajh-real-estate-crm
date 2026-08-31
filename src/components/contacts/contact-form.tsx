"use client";

import { useActionState } from "react";
import { createContactAction } from "@/lib/contacts/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { CONTACT_SOURCE_LABELS } from "@/lib/integrations/providers";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(createContactAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <TextInput id="firstName" name="firstName" required autoFocus />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <TextInput id="lastName" name="lastName" required />
        </Field>
      </div>

      <Field label="Preferred name" htmlFor="preferredName" hint="Optional">
        <TextInput id="preferredName" name="preferredName" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <TextInput id="email" name="email" type="email" />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput id="phone" name="phone" type="tel" />
        </Field>
      </div>

      <Field label="Secondary phone" htmlFor="secondaryPhone" hint="Optional">
        <TextInput id="secondaryPhone" name="secondaryPhone" type="tel" />
      </Field>

      <Field label="Address" htmlFor="address" hint="Optional">
        <TextInput id="address" name="address" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city">
          <TextInput id="city" name="city" />
        </Field>
        <Field label="State" htmlFor="state">
          <TextInput id="state" name="state" />
        </Field>
        <Field label="ZIP" htmlFor="zip">
          <TextInput id="zip" name="zip" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact type" htmlFor="contactType">
          <Select id="contactType" name="contactType" defaultValue="LEAD">
            {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="source">
          <Select id="source" name="source" defaultValue="MANUAL">
            {Object.entries(CONTACT_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save contact
      </SubmitButton>
    </form>
  );
}
