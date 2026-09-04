import { requireSession } from "@/lib/auth/session";
import { getBrandSettings } from "@/lib/settings/brand";
import { BrandingForm } from "@/components/settings/branding-form";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { getOrCreateNotificationPreference } from "@/lib/notifications/scheduling";

export default async function SettingsPage() {
  const session = await requireSession();
  const [settings, preference] = await Promise.all([
    getBrandSettings(),
    getOrCreateNotificationPreference(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branding shown throughout the CRM — your logo and colors, not per-user.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">Branding</h2>
        <div className="mt-4">
          <BrandingForm settings={settings} hasLogo={Boolean(settings.logoStoragePath)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <div className="mt-4">
          <NotificationPreferencesForm
            values={{
              tasksEnabled: preference.tasksEnabled,
              followUpsEnabled: preference.followUpsEnabled,
              transactionDeadlinesEnabled: preference.transactionDeadlinesEnabled,
              taskReminderMinutesBefore: preference.taskReminderMinutesBefore,
              followUpReminderMinutesBefore: preference.followUpReminderMinutesBefore,
              transactionReminderDaysBefore: preference.transactionReminderDaysBefore,
            }}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          />
        </div>
      </div>
    </div>
  );
}
