"use client";

import { useActionState, useState } from "react";
import { deleteContactActivityAction, updateContactActivityAction } from "@/lib/contacts/actions";
import { Field, FormError, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { CONTACT_ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { CONTACT_TOUCHPOINT_ACTIVITY_TYPES, isContactTouchpointType } from "@/lib/contacts/activity";
import { formatDateWithYear } from "@/lib/format";
import type { ContactActivityType } from "@/generated/prisma/enums";

/**
 * One row in a Contact's Activity feed. System bookkeeping entries
 * (CREATED, STATUS_CHANGED, SYNCED, OTHER) render read-only, same as
 * before — only agent-logged touchpoints (see isContactTouchpointType) get
 * Edit/Delete, matching the same restriction the log-activity form and the
 * server actions themselves enforce.
 */
export function ActivityRow({
  activity,
}: {
  activity: { id: string; type: ContactActivityType; description: string; createdAt: Date };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateContactActivityAction, undefined);
  const editable = isContactTouchpointType(activity.type);

  // Closes the inline edit form once the save actually succeeds (state is
  // truthy with no error) — stays open on failure so the error and the
  // agent's in-progress edit aren't lost. Adjusting state during render
  // (rather than in an effect) when `state` changes identity is the
  // documented pattern for "reset on prop/state change" — see
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && !state.error) setIsEditing(false);
  }

  if (isEditing) {
    return (
      <form action={formAction} className="flex flex-col gap-3 px-5 py-3">
        <input type="hidden" name="activityId" value={activity.id} />
        <Field label="Type" htmlFor={`activityType-${activity.id}`}>
          <Select id={`activityType-${activity.id}`} name="type" defaultValue={activity.type}>
            {CONTACT_TOUCHPOINT_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTACT_ACTIVITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor={`activityNotes-${activity.id}`}>
          <TextArea id={`activityNotes-${activity.id}`} name="notes" rows={2} defaultValue={activity.description} />
        </Field>
        <FormError message={state?.error} />
        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Save
          </SubmitButton>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-medium">{CONTACT_ACTIVITY_TYPE_LABELS[activity.type]}</span>
          {activity.description && activity.description !== CONTACT_ACTIVITY_TYPE_LABELS[activity.type]
            ? ` — ${activity.description}`
            : ""}
        </p>
        <p className="text-xs text-muted-foreground">{formatDateWithYear(activity.createdAt)}</p>
      </div>
      {editable ? (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </button>
          <form
            action={deleteContactActivityAction}
            onSubmit={(event) => {
              if (!window.confirm("Delete this activity log entry? This can't be undone.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="activityId" value={activity.id} />
            <button
              type="submit"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-status-attention hover:bg-surface-muted"
            >
              Delete
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
