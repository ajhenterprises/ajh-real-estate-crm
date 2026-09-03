import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { ContactActivityType, ClientType } from "@/generated/prisma/enums";

/**
 * Owner-scoped Contact mutations, factored out of the "use server" actions
 * file (src/lib/contacts/actions.ts) so this exact logic — not a
 * reimplementation of it — is directly callable from integration tests
 * against the dedicated test database (src/test/db.ts). Same shape as
 * src/lib/contracts/task-sync.ts's reconcileContractDerivedTask: no
 * `import "server-only"`, an optional trailing Prisma-client parameter
 * defaulting to the real app singleton.
 *
 * Both functions re-verify ownership themselves (`findFirst` by id AND
 * ownerId) rather than trusting a caller-supplied contactId — never called
 * with anything other than the session's own user id.
 */

/**
 * Sets, changes, or clears (pass `null`) a Contact's explicit follow-up
 * date. Returns the updated Contact, or `null` if no Contact with that id
 * is owned by `userId` — the caller (setContactFollowUpDateAction) treats
 * that as "not found," never as "found but for someone else."
 */
export async function setContactFollowUpDate(
  userId: string,
  contactId: string,
  nextFollowUpDate: Date | null,
  db: Prisma.TransactionClient = prisma,
) {
  const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } });
  if (!contact) return null;

  return db.contact.update({ where: { id: contact.id }, data: { nextFollowUpDate } });
}

/**
 * Logs a manual ContactActivity — a real interaction the agent had with
 * this contact, distinct from the system-generated CREATED/STATUS_CHANGED/
 * SYNCED entries. `source` is always "MANUAL": this is the agent acting,
 * not a lead-source/integration event (a different axis entirely — see
 * src/lib/contacts/activity.ts). Returns null under the same
 * not-owned/not-found convention as setContactFollowUpDate above.
 */
export async function createContactActivity(
  userId: string,
  contactId: string,
  type: ContactActivityType,
  description: string,
  db: Prisma.TransactionClient = prisma,
) {
  const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } });
  if (!contact) return null;

  return db.contactActivity.create({
    data: { contactId: contact.id, type, description, source: "MANUAL" },
  });
}

/**
 * Idempotently ensures a Client row exists for this contact — the single
 * source of truth the Clients list (src/lib/repos/clients.ts's listClients)
 * reads from. Contact.contactType is only a categorization tag (see its
 * schema comment); setting it to CLIENT does not by itself create this row,
 * so every caller that lets an agent mark a contact CLIENT — the explicit
 * "Convert to Client" action and createContactAction/updateContactAction
 * alike — must call this too, or the contact silently never appears on the
 * Clients page despite showing as a client everywhere else.
 *
 * Same dedupe rule as a plain unique-constraint retry: Client.contactId is
 * unique, so a second call (double submit, race, or a contact already
 * explicitly converted) converges on the Client that already exists rather
 * than erroring or creating a duplicate. `type` defaults to OTHER because a
 * contact-type tag alone carries no buyer/seller signal — the agent can set
 * the real type from the Client edit form afterward.
 */
export async function ensureClientForContact(
  userId: string,
  contactId: string,
  type: ClientType = "OTHER",
  db: Prisma.TransactionClient = prisma,
): Promise<{ client: { id: string }; created: boolean }> {
  const existing = await db.client.findUnique({ where: { contactId }, select: { id: true } });
  if (existing) return { client: existing, created: false };

  try {
    const client = await db.client.create({ data: { contactId, ownerId: userId, type }, select: { id: true } });
    return { client, created: true };
  } catch (error) {
    const isDuplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!isDuplicate) throw error;

    const client = await db.client.findUnique({ where: { contactId }, select: { id: true } });
    if (!client) throw error;
    return { client, created: false };
  }
}
