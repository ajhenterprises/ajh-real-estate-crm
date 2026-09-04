"use client";

import { useActionState } from "react";
import { updateNotificationPreferencesAction } from "@/lib/notifications/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/ui/form";
import { PushSubscribeButton } from "@/components/notifications/push-subscribe-button";

const MINUTE_OPTIONS = [
  { value: 0, label: "At the scheduled time" },
  { value: 15, label: "15 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

const DAY_OPTIONS = [1, 2, 3, 5, 7];

export interface NotificationPreferencesValues {
  tasksEnabled: boolean;
  followUpsEnabled: boolean;
  transactionDeadlinesEnabled: boolean;
  taskReminderMinutesBefore: number;
  followUpReminderMinutesBefore: number;
  transactionReminderDaysBefore: number[];
}

export function NotificationPreferencesForm({
  values,
  vapidPublicKey,
}: {
  values: NotificationPreferencesValues;
  vapidPublicKey: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferencesAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">This device</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Push notifications only reach devices where you&rsquo;ve turned them on — enable them separately on your
          phone and any other device you use.
        </p>
        <div className="mt-3">
          <PushSubscribeButton vapidPublicKey={vapidPublicKey} />
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-5 border-t border-border pt-6">
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" name="tasksEnabled" defaultChecked={values.tasksEnabled} className="h-4 w-4 rounded border-border" />
            Task due-date reminders
          </label>
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              name="followUpsEnabled"
              defaultChecked={values.followUpsEnabled}
              className="h-4 w-4 rounded border-border"
            />
            Contact follow-up reminders
          </label>
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              name="transactionDeadlinesEnabled"
              defaultChecked={values.transactionDeadlinesEnabled}
              className="h-4 w-4 rounded border-border"
            />
            Transaction &amp; contract key-date reminders (inspection, financing, appraisal, title, closing, and more)
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Task reminder timing" htmlFor="taskReminderMinutesBefore">
            <Select id="taskReminderMinutesBefore" name="taskReminderMinutesBefore" defaultValue={values.taskReminderMinutesBefore}>
              {MINUTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Follow-up reminder timing" htmlFor="followUpReminderMinutesBefore">
            <Select
              id="followUpReminderMinutesBefore"
              name="followUpReminderMinutesBefore"
              defaultValue={values.followUpReminderMinutesBefore}
            >
              {MINUTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Transaction deadline reminders — days before, plus always the day of</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {DAY_OPTIONS.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="transactionReminderDaysBefore"
                  value={day}
                  defaultChecked={values.transactionReminderDaysBefore.includes(day)}
                  className="h-4 w-4 rounded border-border"
                />
                {day} day{day === 1 ? "" : "s"} before
              </label>
            ))}
          </div>
        </div>

        <FormError message={state?.error} />

        <div>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Save notification preferences
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
