import { signOutAction } from "@/lib/auth/actions";

export function Header({ userName }: { userName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
      <div className="text-sm font-semibold tracking-tight text-foreground">
        AJH Real Estate CRM
      </div>
      <form action={signOutAction} className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{userName}</span>
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
