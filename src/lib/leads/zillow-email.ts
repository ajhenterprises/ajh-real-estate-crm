/**
 * Deterministic parsing of a Zillow lead-notification email into Contact
 * fields — no AI, plain pattern matching against the label-style layout
 * Zillow's "You have a new lead" emails use (same approach as the contract
 * date extractor in src/lib/contracts/parse-fields.ts). Pure functions, no
 * I/O, so they're directly unit-testable against sample email text without
 * a real Postmark delivery.
 *
 * These patterns are based on Zillow's publicly known lead-email format as
 * of this writing. Zillow can and does change its templates without
 * notice — if real leads stop parsing, the fix is almost always widening
 * the label list below, not a redesign. See ZillowLeadEmail's ingestion
 * route (src/app/api/leads/zillow-email/route.ts) for what happens to an
 * email that fails to parse: it's never silently turned into a garbage
 * Contact.
 */

export interface ZillowEmailInput {
  fromEmail: string;
  subject: string;
  textBody: string;
}

export interface ParsedZillowLead {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
}

/**
 * Sender domain must be zillow.com (or a subdomain of it — Zillow sends
 * lead notifications from addresses like leads-noreply@zillow.com), AND
 * the subject or body has to actually read as a lead notification, not
 * some other Zillow email (a newsletter, a billing receipt, a saved-search
 * digest). Both conditions are required — this is the "only leads" filter.
 */
export function isZillowLeadEmail({ fromEmail, subject, textBody }: ZillowEmailInput): boolean {
  const domainMatch = fromEmail.toLowerCase().match(/@([a-z0-9.-]+\.)?zillow\.com$/);
  if (!domainMatch) return false;

  const haystack = `${subject}\n${textBody}`.toLowerCase();
  const leadPhrases = ["new lead", "new zillow lead", "premier agent lead", "you have a new lead", "new contact"];
  return leadPhrases.some((phrase) => haystack.includes(phrase));
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

/** Falls back to the first line that just looks like a US phone number, for emails that state it without a "Phone:" label. */
function findPhone(lines: string[], flatText: string): string | null {
  const labeled = findLineValue(lines, ["Phone(?: Number)?", "Mobile", "Cell"]);
  if (labeled) return labeled;
  const match = flatText.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  return match ? match[1] : null;
}

/** Falls back to the first bare email address in the body, for emails that state it without an "Email:" label. */
function findEmail(lines: string[], flatText: string): string | null {
  const labeled = findLineValue(lines, ["Email(?: Address)?"]);
  if (labeled) return labeled;
  const match = flatText.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  return match ? match[0] : null;
}

/** Everything after a "Message"/"Comments" label to the end of the body — Zillow puts the buyer's actual inquiry text there. */
function findMessage(textBody: string): string | null {
  const match = textBody.match(/(?:Message|Comments?|Inquiry)\s*:?\s*\n?([\s\S]+)/i);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "(Zillow lead)" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Returns null when no name could be confidently found — the caller must
 * never fall back to a placeholder name; a Contact with no real name is
 * worse than no Contact at all, since it's silent and hard to notice.
 */
export function parseZillowLeadEmail(textBody: string): ParsedZillowLead | null {
  const lines = textBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const flatText = textBody.replace(/\s+/g, " ").trim();

  const name = findLineValue(lines, ["Name", "Lead Name", "Contact Name", "From"]);
  if (!name) return null;

  const { firstName, lastName } = splitName(name);

  return {
    firstName,
    lastName,
    email: findEmail(lines, flatText),
    phone: findPhone(lines, flatText),
    message: findMessage(textBody),
  };
}
