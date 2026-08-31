import { requireSession } from "@/lib/auth/session";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Header } from "@/components/shell/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-sm font-semibold text-primary">AJH Real Estate CRM</span>
        </div>
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <Header userName={session.user.name ?? session.user.email ?? "Agent"} />
        <main className="flex-1 bg-background px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
