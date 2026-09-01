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

/**
 * Start of "today," UTC — the boundary every overdue/due-today/upcoming
 * computation in this app must use, to agree with how date-only values are
 * stored (see the module comment above) and displayed (toDateInputValue/
 * formatDate). Using local server time here instead (`setHours(0,0,0,0)`)
 * was Phase 8's fix target: it silently agreed with UTC only because this
 * app has so far only run on UTC-configured hosts.
 *
 * `now` defaults to the real current instant; tests pass a fixed value so
 * boundary behavior is deterministic regardless of when/where the suite runs.
 */
export function startOfTodayUTC(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** Start of "tomorrow," UTC — the exclusive upper bound for "today." */
export function endOfTodayUTC(now: Date = new Date()): Date {
  const end = startOfTodayUTC(now);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}
