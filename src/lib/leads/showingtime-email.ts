/**
 * Deterministic parsing of a ShowingTime confirmation email into Showing
 * fields — no AI, plain pattern matching, same approach as
 * src/lib/leads/zillow-email.ts (leads) and src/lib/contracts/parse-fields.ts
 * (contract dates). Pure functions, no I/O.
 *
 * Unlike a Zillow lead, a ShowingTime showing doesn't always name someone
 * already in this CRM — when Aaron is the listing agent, the email names
 * the *other* agent and possibly nothing about the buyer at all. So this
 * module only extracts what's reliably present (property, date/time, and a
 * best-effort name for matching) and leaves matching that name to an
 * existing Contact/Client to the caller (src/app/api/leads/inbound-email/
 * route.ts) — a showing with no confident match still gets created, just
 * unassigned, rather than silently dropped.
 *
 * Based on ShowingTime's publicly known confirmation-email format as of
 * this writing. Real-world templates vary by MLS/region and change without
 * notice — if a real confirmation doesn't parse, the fix is almost always
 * widening the label lists below.
 */

export interface ShowingTimeEmailInput {
  fromEmail: string;
  subject: string;
  textBody: string;
}

export interface ParsedShowingTimeEmail {
  propertyAddress: string;
  /** UTC-anchored wall-clock, same convention as every other date in this app (see src/lib/format.ts's module comment). */
  scheduledAt: Date;
  /** Best-effort name to match against an existing Contact/Client — may be the buyer, or may be nobody in this CRM (e.g. a cooperating agent showing Aaron's own listing). */
  name: string | null;
  notes: string | null;
}

const domainPattern = /@([a-z0-9.-]+\.)?showingtime\.com$/i;

/** Sender domain must be showingtime.com (or a subdomain), AND the subject/body has to actually read as a showing notification. Both required — same "only the real thing" filter as isZillowLeadEmail. */
export function isShowingTimeEmail({ fromEmail, subject, textBody }: ShowingTimeEmailInput): boolean {
  if (!domainPattern.test(fromEmail.toLowerCase())) return false;

  const haystack = `${subject}\n${textBody}`.toLowerCase();
  const phrases = ["showing confirmed", "showing scheduled", "showing request", "confirmed showing", "showingtime"];
  return phrases.some((phrase) => haystack.includes(phrase));
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};
const MONTH_NAME_PATTERN =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const DATE_PATTERN = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:${MONTH_NAME_PATTERN})\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})`;
const TIME_PATTERN = String.raw`(\d{1,2}):(\d{2})\s*([AaPp]\.?[Mm]\.?)`;

function parseDateOnly(raw: string): { year: number; month: number; day: number } | null {
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };

  match = raw.match(/^([A-Za-z.]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (match) {
    const month = MONTH_NAMES[match[1].toLowerCase().replace(/\.$/, "")];
    if (month === undefined) return null;
    return { year: Number(match[3]), month: month + 1, day: Number(match[2]) };
  }

  return null;
}

function parseTimeOfDay(raw: string): { hour: number; minute: number } | null {
  const match = raw.match(new RegExp(`^${TIME_PATTERN}$`));
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const isPm = match[3].toLowerCase().startsWith("p");
  if (hour === 12) hour = isPm ? 12 : 0;
  else if (isPm) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function findLineValue(lines: string[], labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`^\\s*${label}\\s*[:\\-]\\s*(.+)$`, "i");
    for (const line of lines) {
      const match = line.match(re);
      const value = match?.[1]?.trim();
      if (value) return value;
    }
  }
  return null;
}

function findScheduledAt(flatText: string, lines: string[]): Date | null {
  const labeledDateTime = findLineValue(lines, ["Date\\s*/\\s*Time", "Showing Date\\s*/\\s*Time", "Appointment"]);
  const dateSources = [labeledDateTime, findLineValue(lines, ["Date", "Showing Date"]), flatText].filter(
    (value): value is string => value !== null,
  );

  for (const source of dateSources) {
    const dateMatch = source.match(new RegExp(DATE_PATTERN));
    if (!dateMatch) continue;
    const date = parseDateOnly(dateMatch[1]);
    if (!date) continue;

    const timeSources = [labeledDateTime, findLineValue(lines, ["Time", "Showing Time"]), flatText].filter(
      (value): value is string => value !== null,
    );
    for (const timeSource of timeSources) {
      const timeMatch = timeSource.match(new RegExp(TIME_PATTERN, "i"));
      if (!timeMatch) continue;
      const time = parseTimeOfDay(timeMatch[0]);
      if (!time) continue;
      return new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute));
    }

    // A date with no parseable time still anchors the showing to a day —
    // matches how every other date-only value in this app defaults to UTC
    // midnight (see src/lib/format.ts's combineDateAndTimeUTC).
    return new Date(Date.UTC(date.year, date.month - 1, date.day));
  }

  return null;
}

/** A line that reads like a street address — leading house number, no trailing colon (so it doesn't grab a "Date:" style label line). */
function findAddressLine(lines: string[]): string | null {
  const labeled = findLineValue(lines, ["Property(?: Address)?", "Listing Address", "Address"]);
  if (labeled) return labeled;

  const addressLine = lines.find((line) => /^\d+\s+\S/.test(line) && !line.includes(":"));
  return addressLine ?? null;
}

/**
 * Returns null when the two essentials — where and when — can't both be
 * found. A name is best-effort only: the caller matches it against
 * existing Contacts/Clients and proceeds either way (see this file's
 * module comment).
 */
export function parseShowingTimeEmail(textBody: string): ParsedShowingTimeEmail | null {
  const lines = textBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const flatText = textBody.replace(/\s+/g, " ").trim();

  const propertyAddress = findAddressLine(lines);
  const scheduledAt = findScheduledAt(flatText, lines);
  if (!propertyAddress || !scheduledAt) return null;

  const name = findLineValue(lines, [
    "Buyer(?:'s)?\\s*Name",
    "Buyer",
    "Agent(?:'s)?\\s*Name",
    "Showing Agent",
    "Requested By",
    "Contact",
  ]);

  const notesMatch = textBody.match(/(?:Notes?|Comments?|Instructions?)\s*:?\s*\n?([\s\S]+)/i);
  const notes = notesMatch?.[1]?.trim() || null;

  return { propertyAddress, scheduledAt, name, notes };
}
