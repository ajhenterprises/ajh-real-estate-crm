"use client";

import { useActionState } from "react";
import { attachExpenseReceiptAction } from "@/lib/tax-expenses/actions";
import { Field, FormError, SubmitButton, TextInput } from "@/components/ui/form";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/documents/validation";

export function AttachReceiptForm({ expenseId }: { expenseId: string }) {
  const [state, formAction, pending] = useActionState(attachExpenseReceiptAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="expenseId" value={expenseId} />
      <Field label="Attach another receipt" htmlFor="receipt" hint="PDF, Word document, or image — up to 15 MB">
        <TextInput id="receipt" name="receipt" type="file" accept={ALLOWED_DOCUMENT_EXTENSIONS} required />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton pending={pending} pendingLabel="Uploading…">
        Attach receipt
      </SubmitButton>
    </form>
  );
}
