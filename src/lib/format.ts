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
// Showings are the one thing in this app with a meaningful time-of-day —
// stored the same UTC-anchored-wall-clock way as every other date here (see
// parseDateTimeInputValue below), so this must format with timeZone: "UTC"
// too, for the same reason as every formatter above.
const dateTimeWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
// Whole-dollar rounding above is fine for transaction/listing prices, but
// itemized business expenses routinely have real cents (a $4.99/month
// subscription) — used only in the Tax & Expenses section.
const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateWithYear(date: Date): string {
  return dateWithYearFormatter.format(date);
}

export function formatDateTimeWithYear(date: Date): string {
  return dateTimeWithYearFormatter.format(date);
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatCurrency(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return null;
  return currencyFormatter.format(numeric);
}

/** Same as formatCurrency but always shows cents — see currencyFormatterPrecise above. */
export function formatCurrencyPrecise(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return null;
  return currencyFormatterPrecise.format(numeric);
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

/** Formats a Date as the value a `<input type="datetime-local">` expects (YYYY-MM-DDTHH:mm), reading UTC — the datetime counterpart of toDateInputValue. */
export function toDateTimeInputValue(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Parses a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") into
 * a Date, treating the entered wall-clock time as UTC — same convention as
 * every other date in this app (see the module comment above), extended to
 * include time-of-day. Deliberately NOT `new Date(value)`: that string form
 * has no timezone offset, so JS parses it in the *server's* local timezone,
 * which would silently shift a showing's time depending on where the app
 * happens to run. Returns null for anything that doesn't match the shape.
 */
export function parseDateTimeInputValue(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
}
