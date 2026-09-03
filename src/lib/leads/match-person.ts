import "server-only";
import { prisma } from "@/lib/db";

export interface MatchedPerson {
  contactId: string | null;
  clientId: string | null;
}

/**
 * Best-effort exact (case-insensitive) first+last name match against this
 * owner's Contacts, preferring the operational Client record when the
 * matched contact has one — attaching to the Client is what makes the
 * showing show up on the more "active" of that person's two profile pages.
 * Returns both null when there's no match, or more than one (ambiguous) —
 * never guesses among several people with a similar name. The caller
 * (src/app/api/leads/inbound-email/route.ts) still creates the Showing
 * either way; an unmatched name just means the agent links it manually.
 */
export async function matchPersonByName(ownerId: string, fullName: string | null): Promise<MatchedPerson> {
  const none: MatchedPerson = { contactId: null, clientId: null };
  if (!fullName) return none;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return none;

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  const matches = await prisma.contact.findMany({
    where: {
      ownerId,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true, client: { select: { id: true } } },
  });

  if (matches.length !== 1) return none;

  const match = matches[0];
  return match.client ? { contactId: null, clientId: match.client.id } : { contactId: match.id, clientId: null };
}
