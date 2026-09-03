import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isZillowLeadEmail, parseZillowLeadEmail } from "@/lib/leads/zillow-email";
import { isShowingTimeEmail, parseShowingTimeEmail } from "@/lib/leads/showingtime-email";
import { matchPersonByName } from "@/lib/leads/match-person";

/**
 * Single inbound webhook for every forwarded email source this app knows
 * how to turn into CRM data — currently Zillow lead notifications (->
 * Contact) and ShowingTime confirmations (-> Showing). One shared Postmark
 * Inbound Stream (https://postmarkapp.com/inbound-webhook) forwards
 * everything here; which parser runs is decided by sender domain, so
 * setup is a single webhook URL/credential pair no matter how many sources
 * get added later. Configured with HTTP Basic Auth credentials embedded in
 * the webhook URL (`https://user:pass@host/api/leads/inbound-email`),
 * which Postmark sends as a standard Authorization header. This route is
 * listed as a public path in src/proxy.ts (an external mail service has no
 * session cookie) and enforces its own auth here instead.
 *
 * Always returns 200 for anything that isn't an auth/config failure — an
 * unrecognized email, an unparseable one, or a duplicate delivery are all
 * legitimate non-error outcomes, and a non-200 response makes Postmark
 * retry the same delivery repeatedly.
 */

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedUser = process.env.INBOUND_EMAIL_INBOX_USER;
  const expectedPassword = process.env.INBOUND_EMAIL_INBOX_PASSWORD;
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

async function handleZillowLead(owner: { id: string }, messageId: string, textBody: string) {
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

async function handleShowingTimeShowing(owner: { id: string }, messageId: string, textBody: string) {
  const existing = await prisma.showing.findUnique({ where: { externalId: messageId }, select: { id: true } });
  if (existing) {
    return Response.json({ created: false, reason: "duplicate", showingId: existing.id });
  }

  const parsed = parseShowingTimeEmail(textBody);
  if (!parsed) {
    return Response.json({ created: false, reason: "unparseable" });
  }

  const { contactId, clientId } = await matchPersonByName(owner.id, parsed.name);

  const showing = await prisma.showing.create({
    data: {
      propertyAddress: parsed.propertyAddress,
      scheduledAt: parsed.scheduledAt,
      notes: parsed.notes,
      source: "showingtime_email",
      externalId: messageId,
      contactId,
      clientId,
      ownerId: owner.id,
    },
  });

  return Response.json({ created: true, showingId: showing.id, matched: contactId !== null || clientId !== null });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ownerEmail = process.env.INBOUND_EMAIL_OWNER_EMAIL;
  if (!ownerEmail) {
    return new Response("Inbound email ingestion is not configured", { status: 503 });
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

  const isLead = isZillowLeadEmail({ fromEmail, subject, textBody });
  const isShowing = !isLead && isShowingTimeEmail({ fromEmail, subject, textBody });
  if (!isLead && !isShowing) {
    return Response.json({ created: false, reason: "unrecognized_sender" });
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    return new Response("Configured inbound email owner not found", { status: 503 });
  }

  return isLead
    ? handleZillowLead(owner, messageId, textBody)
    : handleShowingTimeShowing(owner, messageId, textBody);
}
