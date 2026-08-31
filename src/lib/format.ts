// All formatters use UTC explicitly: every DateTime this app stores for a
// "date" concept (closing date, deadline, task due date) is a calendar day
// with no meaningful time-of-day, written as UTC midnight (see
// toDateInputValue's counterpart — the "YYYY-MM-DD" -> Date parse in every
// form action). Formatting in the server's local timezone instead of UTC
// would risk shifting that day by one depending on where the app runs.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
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

/** Formats a Date as the value a `<input type="date">` expects (YYYY-MM-DD), reading the UTC calendar date. */
export function toDateInputValue(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
