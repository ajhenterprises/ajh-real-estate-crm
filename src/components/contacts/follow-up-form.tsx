"use client";

import { useActionState } from "react";
import { setContactFollowUpDateAction } from "@/lib/contacts/actions";
import { Field, FormError, SubmitButton, TextInput } from "@/components/ui/form";

export function FollowUpForm({
  contactId,
  defaultDate,
  defaultTime,
  hasFollowUpDate,
}: {
  contactId: string;
  defaultDate?: string;
  defaultTime?: string;
  hasFollowUpDate: boolean;
}) {
  const [state, formAction, pending] = useActionState(setContactFollowUpDateAction, undefined);
  const [clearState, clearAction, clearPending] = useActionState(setContactFollowUpDateAction, undefined);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex items-end gap-3">
        <input type="hidden" name="contactId" value={contactId} />
        <div className="flex-1">
          <Field label="Next follow-up" htmlFor="nextFollowUpDate">
            <TextInput id="nextFollowUpDate" name="nextFollowUpDate" type="date" defaultValue={defaultDate} />
          </Field>
        </div>
        <div className="w-32">
          <Field label="Time" htmlFor="nextFollowUpTime">
            <TextInput id="nextFollowUpTime" name="nextFollowUpTime" type="time" defaultValue={defaultTime} />
          </Field>
        </div>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>

      {hasFollowUpDate ? (
        <form action={clearAction}>
          <input type="hidden" name="contactId" value={contactId} />
          <button
            type="submit"
            disabled={clearPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
          >
            {clearPending ? "Clearing…" : "Clear follow-up date"}
          </button>
        </form>
      ) : null}

      <FormError message={state?.error ?? clearState?.error} />
    </div>
  );
}
