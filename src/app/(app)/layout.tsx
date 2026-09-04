import { requireSession } from "@/lib/auth/session";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Header } from "@/components/shell/header";
import { getBrandSettings } from "@/lib/settings/brand";
import { countUnreadNotifications } from "@/lib/repos/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [brand, unreadNotificationCount] = await Promise.all([
    getBrandSettings(),
    countUnreadNotifications(session.user.id),
  ]);
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
      <aside className="hidden w-56 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-24 items-center gap-2 border-b border-border px-4">
          {brand.logoStoragePath ? (
            <img
              src="/api/branding/logo"
              alt={companyName}
              className="h-20 w-full object-contain object-left"
            />
          ) : (
            <span className="text-sm font-semibold text-primary">{companyName}</span>
          )}
        </div>
        <SidebarNav unreadNotificationCount={unreadNotificationCount} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          userName={session.user.name ?? session.user.email ?? "Agent"}
          companyName={companyName}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main className="flex-1 overflow-x-hidden bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
