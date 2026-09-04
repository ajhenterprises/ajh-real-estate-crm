import { signOutAction } from "@/lib/auth/actions";
import { MobileNav } from "@/components/shell/mobile-nav";

export function Header({
  userName,
  companyName,
  unreadNotificationCount = 0,
}: {
  userName: string;
  companyName: string;
  unreadNotificationCount?: number;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-surface px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav unreadNotificationCount={unreadNotificationCount} />
        <div className="truncate text-sm font-semibold tracking-tight text-foreground">{companyName}</div>
      </div>
      <form action={signOutAction} className="flex shrink-0 items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
