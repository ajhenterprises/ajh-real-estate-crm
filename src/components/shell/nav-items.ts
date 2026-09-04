export const primaryNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/contacts", label: "Contacts" },
  { href: "/showings", label: "Showings" },
  { href: "/transactions", label: "Transactions" },
  { href: "/tasks", label: "Tasks" },
  { href: "/documents", label: "Documents" },
  { href: "/tax-expenses", label: "Tax & Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
] as const;

// Named on the roadmap but not yet built — shown de-emphasized rather than
// silently omitted, so the shape of the product stays visible. Empty for
// now: Calendar/Reports/Settings (the original roadmap items) are all
// built. sidebar-nav.tsx hides the "Coming later" heading entirely when
// this is empty, so this array is safe to leave empty rather than deleted
// — the next roadmap item just gets added back here.
export const upcomingNavItems: readonly { label: string }[] = [];
