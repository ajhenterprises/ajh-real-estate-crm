import { requireSession } from "@/lib/auth/session";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Header } from "@/components/shell/header";
import { getBrandSettings } from "@/lib/settings/brand";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const brand = await getBrandSettings();
  const companyName = brand.companyName || "AJH Real Estate CRM";

  return (
    // Overrides globals.css's default token values with whatever's saved in
    // Settings → Branding — inline so it applies without a client round
    // trip, and scoped to this style tag rather than editing globals.css
    // itself, since these two values are the only ones a brokerage owns.
    <div
      className="flex min-h-screen"
      style={
        {
          "--color-primary": brand.primaryColor,
          "--color-accent": brand.accentColor,
        } as React.CSSProperties
      }
    >
      <aside className="flex w-56 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          {brand.logoStoragePath ? (
            <img src="/api/branding/logo" alt={companyName} className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-sm font-semibold text-primary">{companyName}</span>
          )}
        </div>
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <Header userName={session.user.name ?? session.user.email ?? "Agent"} companyName={companyName} />
        <main className="flex-1 bg-background px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
