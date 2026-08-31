"use client";

import { useActionState } from "react";
import { addTransactionTaskAction } from "@/lib/tasks/actions";
import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/ui/form";
import { TASK_PRIORITY_LABELS } from "@/lib/labels";

export function AddTaskForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(addTransactionTaskAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-5">
      <input type="hidden" name="transactionId" value={transactionId} />

      <Field label="Title" htmlFor="taskTitle">
        <TextInput id="taskTitle" name="title" required />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Due date" htmlFor="taskDueDate" hint="Optional">
          <TextInput id="taskDueDate" name="dueDate" type="date" />
        </Field>
        <Field label="Priority" htmlFor="taskPriority">
          <Select id="taskPriority" name="priority" defaultValue="NORMAL" required>
            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Adding…">
        Add task
      </SubmitButton>
    </form>
  );
}
