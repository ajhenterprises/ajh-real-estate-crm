"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavItems } from "@/components/shell/nav-items";

/**
 * Off-canvas nav drawer for narrow screens — the sidebar (AppLayout) is
 * `hidden lg:flex`, so below that breakpoint this hamburger button is the
 * only way to reach anything besides the current page. Self-contained
 * (doesn't reuse SidebarNav) since it needs its own close-on-navigate/
 * close-on-backdrop/close-on-Escape behavior that the always-visible
 * desktop sidebar doesn't.
 */
export function MobileNav({ unreadNotificationCount = 0 }: { unreadNotificationCount?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Closing on every route change covers both a nav-link tap (the normal
  // case) and any other navigation while the drawer happens to be open.
  // Adjusting state during render (rather than in an effect) when
  // `pathname` changes identity is the documented pattern for "reset on
  // prop change" — see https://react.dev/learn/you-might-not-need-an-effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (isOpen) setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-surface-muted lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface pb-6 shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="flex flex-col gap-0.5 px-3 py-4">
              {primaryNavItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center justify-between rounded-md px-3 py-3 text-base font-medium transition-colors ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      {item.label}
                      {item.href === "/notifications" && unreadNotificationCount > 0 ? (
                        <span className="rounded-full bg-status-attention px-1.5 py-0.5 text-xs font-semibold text-white">
                          {unreadNotificationCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
