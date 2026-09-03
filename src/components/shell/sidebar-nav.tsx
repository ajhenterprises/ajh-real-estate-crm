"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavItems, upcomingNavItems } from "@/components/shell/nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      <ul className="flex flex-col gap-0.5">
        {primaryNavItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {upcomingNavItems.length > 0 ? (
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coming later
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {upcomingNavItems.map((item) => (
              <li key={item.label}>
                <span className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
