import "server-only";
import { prisma } from "@/lib/db";

/**
 * Best-effort exact (case-insensitive) first+last name match against this
 * owner's Contacts. Returns null when there's no match, or more than one
 * (ambiguous) — never guesses among several people with a similar name.
 * The caller (src/app/api/leads/inbound-email/route.ts) still creates the
 * Showing either way; an unmatched name just means the agent links it
 * manually.
 */
export async function matchPersonByName(ownerId: string, fullName: string | null): Promise<string | null> {
  if (!fullName) return null;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  const matches = await prisma.contact.findMany({
    where: {
      ownerId,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true },
  });

  return matches.length === 1 ? matches[0].id : null;
}
