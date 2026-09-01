"use client";

import { useActionState } from "react";
import type { TaskFormState } from "@/lib/tasks/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { contactDisplayName } from "@/lib/format";

export interface TaskFormOptions {
  clients: { id: string; contact: { firstName: string; lastName: string } }[];
  transactions: { id: string; propertyAddress: string | null; client: { contact: { firstName: string; lastName: string } } }[];
}

export interface TaskFormValues {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  clientId?: string;
  transactionId?: string;
}

export function TaskForm({
  action,
  hiddenField,
  options,
  defaultValues,
  submitLabel,
  pendingLabel,
  linkedEventTitle,
}: {
  action: (state: TaskFormState | undefined, formData: FormData) => Promise<TaskFormState>;
  hiddenField?: { name: string; value: string };
  options: TaskFormOptions;
  defaultValues?: TaskFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** When set, this task's due date is generated from a contract deadline — changing it here overrides that link. */
  linkedEventTitle?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {hiddenField ? <input type="hidden" name={hiddenField.name} value={hiddenField.value} /> : null}

      <Field label="Title" htmlFor="title">
        <TextInput id="title" name="title" required autoFocus defaultValue={defaultValues?.title} />
      </Field>

      <Field label="Description" htmlFor="description" hint="Optional">
        <TextArea id="description" name="description" rows={3} defaultValue={defaultValues?.description} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Due date"
          htmlFor="dueDate"
          hint={
            linkedEventTitle
              ? `Generated from ${linkedEventTitle} — changing it overrides that link`
              : "Optional"
          }
        >
          <TextInput id="dueDate" name="dueDate" type="date" defaultValue={defaultValues?.dueDate} />
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={defaultValues?.priority ?? "NORMAL"} required>
            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={defaultValues?.status ?? "PENDING"} required>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="clientId" hint="Optional">
          <Select id="clientId" name="clientId" defaultValue={defaultValues?.clientId ?? ""}>
            <option value="">None</option>
            {options.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {contactDisplayName(client.contact)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transaction" htmlFor="transactionId" hint="Optional">
          <Select id="transactionId" name="transactionId" defaultValue={defaultValues?.transactionId ?? ""}>
            <option value="">None</option>
            {options.transactions.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {transaction.propertyAddress ?? contactDisplayName(transaction.client.contact)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
