"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/form";

/**
 * A destructive-action form: confirms with the browser before submitting,
 * and surfaces whatever error the action returns (e.g. a business-rule
 * block like "this contact is a client") instead of failing silently.
 */
export function DeleteButton({
  action,
  hiddenField,
  confirmMessage,
  label,
}: {
  action: (state: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }>;
  hiddenField: { name: string; value: string };
  confirmMessage: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name={hiddenField.name} value={hiddenField.value} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-status-attention/30 px-3 py-2 text-sm font-medium text-status-attention transition-colors hover:bg-status-attention-bg disabled:opacity-60"
      >
        {pending ? "Deleting…" : label}
      </button>
      <FormError message={state?.error} />
    </form>
  );
}
