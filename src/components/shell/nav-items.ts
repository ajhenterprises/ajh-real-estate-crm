export const primaryNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/clients", label: "Clients" },
  { href: "/transactions", label: "Transactions" },
  { href: "/tasks", label: "Tasks" },
  { href: "/documents", label: "Documents" },
  { href: "/tax-expenses", label: "Tax & Expenses" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
] as const;

// Named on the roadmap but not yet built — shown de-emphasized rather than
// silently omitted, so the shape of the product stays visible.
export const upcomingNavItems = [{ label: "Calendar" }, { label: "Reports" }] as const;
