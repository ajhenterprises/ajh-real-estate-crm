import { requireSession } from "@/lib/auth/session";
import { getBrandSettings } from "@/lib/settings/brand";
import { BrandingForm } from "@/components/settings/branding-form";

export default async function SettingsPage() {
  await requireSession();
  const settings = await getBrandSettings();

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
    </div>
  );
}
