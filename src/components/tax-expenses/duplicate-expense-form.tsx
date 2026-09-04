"use client";

import { useActionState } from "react";
import { duplicateExpenseAction } from "@/lib/tax-expenses/actions";
import { Field, FormError, SubmitButton, TextInput } from "@/components/ui/form";
import { toDateInputValue } from "@/lib/format";

/** Just a date field — everything else about the original expense carries over unchanged (see duplicateExpense, src/lib/tax-expenses/mutations.ts). */
export function DuplicateExpenseForm({ expenseId }: { expenseId: string }) {
  const [state, formAction, pending] = useActionState(duplicateExpenseAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="expenseId" value={expenseId} />

      <Field label="Date for the duplicate" htmlFor="expenseDate">
        <TextInput
          id="expenseDate"
          name="expenseDate"
          type="date"
          required
          defaultValue={toDateInputValue(new Date())}
          autoFocus
        />
      </Field>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Creating…">
        Create duplicate
      </SubmitButton>
    </form>
  );
}
