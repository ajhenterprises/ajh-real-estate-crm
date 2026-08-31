const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateWithYear(date: Date): string {
  return dateWithYearFormatter.format(date);
}

export function formatCurrency(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return null;
  return currencyFormatter.format(numeric);
}

export function contactDisplayName(contact: { firstName: string; lastName: string }): string {
  return `${contact.firstName} ${contact.lastName}`;
}
