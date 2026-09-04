import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ContactActivityType } from "@/generated/prisma/enums";
import { isContactTouchpointType, type ContactTouchpointType } from "@/lib/contacts/activity";

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
 * Edits a logged activity's type/description. Only agent touchpoint types
 * (see isContactTouchpointType) are editable — system bookkeeping entries
 * (CREATED, STATUS_CHANGED, SYNCED, OTHER) are a permanent record and this
 * refuses to touch them, returning null exactly like the not-owned/
 * not-found case so the caller can't tell them apart.
 */
export async function updateContactActivity(
  userId: string,
  activityId: string,
  type: ContactTouchpointType,
  description: string,
  db: Prisma.TransactionClient = prisma,
) {
  const activity = await db.contactActivity.findFirst({ where: { id: activityId, contact: { ownerId: userId } } });
  if (!activity || !isContactTouchpointType(activity.type)) return null;

  return db.contactActivity.update({ where: { id: activity.id }, data: { type, description } });
}

/** Same touchpoint-only restriction as updateContactActivity above. Returns the deleted row (its contactId is what callers need to revalidate) or null. */
export async function deleteContactActivity(
  userId: string,
  activityId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const activity = await db.contactActivity.findFirst({ where: { id: activityId, contact: { ownerId: userId } } });
  if (!activity || !isContactTouchpointType(activity.type)) return null;

  return db.contactActivity.delete({ where: { id: activity.id } });
}
