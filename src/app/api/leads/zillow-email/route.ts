import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isZillowLeadEmail, parseZillowLeadEmail } from "@/lib/leads/zillow-email";

/**
 * Inbound webhook for Zillow lead-notification emails, forwarded through
 * Postmark's Inbound Stream (https://postmarkapp.com/inbound-webhook) —
 * configured with HTTP Basic Auth credentials embedded in the webhook URL
 * (`https://user:pass@host/api/leads/zillow-email`), which Postmark sends
 * as a standard Authorization header on every delivery. This route is
 * listed as a public path in src/proxy.ts (an external mail service has no
 * session cookie) and enforces its own auth here instead.
 *
 * Always returns 200 for anything that isn't an auth/config failure — a
 * non-lead Zillow email, an unparseable one, or a duplicate delivery are
 * all legitimate non-error outcomes, and a non-200 response makes Postmark
 * retry the same delivery repeatedly.
 */

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedUser = process.env.ZILLOW_LEAD_INBOX_USER;
  const expectedPassword = process.env.ZILLOW_LEAD_INBOX_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf-8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return safeCompare(user, expectedUser) && safeCompare(password, expectedPassword);
}

// Postmark's inbound webhook JSON payload — only the fields this route
// reads. See https://postmarkapp.com/support/article/800 for the full shape.
interface PostmarkInboundPayload {
  MessageID?: string;
  FromFull?: { Email?: string };
  From?: string;
  Subject?: string;
  TextBody?: string;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ownerEmail = process.env.ZILLOW_LEAD_OWNER_EMAIL;
  if (!ownerEmail) {
    return new Response("Zillow lead ingestion is not configured", { status: 503 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const fromEmail = payload.FromFull?.Email ?? payload.From ?? "";
  const subject = payload.Subject ?? "";
  const textBody = payload.TextBody ?? "";
  const messageId = payload.MessageID;

  if (!fromEmail || !messageId) {
    return new Response("Missing required fields", { status: 400 });
  }

  if (!isZillowLeadEmail({ fromEmail, subject, textBody })) {
    return Response.json({ created: false, reason: "not_a_lead_email" });
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    return new Response("Configured lead owner not found", { status: 503 });
  }

  // Dedup on Postmark's MessageID via Contact.sourceContactId — a retried
  // delivery (Postmark retries on any non-2xx, and this route only ever
  // returns 200/503/401/400) must never create a second Contact.
  const existing = await prisma.contact.findFirst({
    where: { ownerId: owner.id, source: "ZILLOW", sourceContactId: messageId },
    select: { id: true },
  });
  if (existing) {
    return Response.json({ created: false, reason: "duplicate", contactId: existing.id });
  }

  const parsed = parseZillowLeadEmail(textBody);
  if (!parsed) {
    return Response.json({ created: false, reason: "unparseable" });
  }

  const contact = await prisma.contact.create({
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
      notes: parsed.message,
      contactType: "LEAD",
      source: "ZILLOW",
      sourceContactId: messageId,
      ownerId: owner.id,
      activities: {
        create: {
          type: "CREATED",
          description: "Contact created from a Zillow lead email",
          source: "ZILLOW",
        },
      },
    },
  });

  return Response.json({ created: true, contactId: contact.id });
}
