"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import {
  createContactActivity,
  deleteContactActivity,
  setContactFollowUpDate,
  updateContactActivity,
} from "@/lib/contacts/mutations";
import {
  blankStringToUndefined,
  CONTACT_ACTIVITY_DEFAULT_DESCRIPTIONS,
  CONTACT_TOUCHPOINT_ACTIVITY_TYPES,
} from "@/lib/contacts/activity";
import { cancelFollowUpReminder, cancelTaskReminder, scheduleFollowUpReminder } from "@/lib/notifications/scheduling";
import { combineDateAndTimeUTC } from "@/lib/format";
import { CLIENT_CONTACT_TYPES } from "@/lib/labels";

const CONTACT_TYPES = ["LEAD", "ACTIVE_CLIENT", "INACTIVE_CLIENT", "PAST_CLIENT", "VENDOR", "OTHER"] as const;
const CLIENT_TYPES = ["BUYER", "SELLER", "BUYER_AND_SELLER", "OTHER"] as const;
const CONTACT_SOURCES = [
  "MANUAL",
  "BOLDTRAIL",
  "FOLLOW_UP_BOSS",
  "BULLSEYE",
  "WEBSITE",
  "FACEBOOK",
  "ZILLOW",
  "REALTOR_COM",
  "REFERRAL",
  "OTHER",
] as const;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const createContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  preferredName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  secondaryPhone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  state: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  zip: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  contactType: z.enum(CONTACT_TYPES),
  // Buyer/seller/both — only meaningful once contactType is one of the
  // client statuses, but not validated against that here: an agent can set
  // it in advance, or leave a past client's type in place after their
  // status changes. The select simply submits "" (-> null) when N/A.
  clientType: z.preprocess(emptyToUndefined, z.enum(CLIENT_TYPES).optional()),
  source: z.enum(CONTACT_SOURCES),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export interface CreateContactState {
  error?: string;
}

export async function createContactAction(
  _prevState: CreateContactState | undefined,
  formData: FormData,
): Promise<CreateContactState> {
  const session = await requireSession();

  const parsed = createContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const contact = await prisma.contact.create({
    data: {
      ...parsed.data,
      clientType: parsed.data.clientType ?? null,
      ownerId: session.user.id,
      activities: {
        create: {
          type: "CREATED",
          description: "Contact created",
          source: parsed.data.source,
        },
      },
    },
  });

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export interface UpdateContactState {
  error?: string;
}

export async function updateContactAction(
  _prevState: UpdateContactState | undefined,
  formData: FormData,
): Promise<UpdateContactState> {
  const session = await requireSession();

  const contactId = formData.get("contactId");
  if (typeof contactId !== "string" || !contactId) {
    return { error: "Missing contact." };
  }

  const parsed = createContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, ownerId: session.user.id },
    select: { contactType: true },
  });
  if (!existing) {
    return { error: "That contact could not be found." };
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: { ...parsed.data, clientType: parsed.data.clientType ?? null },
  });

  // A status change worth remembering in the timeline — same trigger the
  // old "Convert to Client" button used to log, now just a side effect of
  // editing the one status field instead of a separate action.
  if (parsed.data.contactType !== existing.contactType) {
    const becameClient =
      CLIENT_CONTACT_TYPES.includes(parsed.data.contactType) && !CLIENT_CONTACT_TYPES.includes(existing.contactType);
    await createContactActivity(
      session.user.id,
      contactId,
      "STATUS_CHANGED",
      becameClient ? "Converted to client" : "Status changed",
    );
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}`);
}

/**
 * Deleting a Contact cascades (at the database level — see onDelete:
 * Cascade in schema.prisma) into every Transaction they're the contact
 * for, and everything hanging off those (events, tasks, documents,
 * contract information). That's real, often irreplaceable business data,
 * so a contact with any transactions on file can never be deleted through
 * this action — set their status to Past Client instead of losing
 * transaction history to an accidental click.
 */
export interface DeleteContactState {
  error?: string;
}

export async function deleteContactAction(
  _prevState: DeleteContactState | undefined,
  formData: FormData,
): Promise<DeleteContactState> {
  const session = await requireSession();

  const contactId = formData.get("contactId");
  if (typeof contactId !== "string" || !contactId) {
    return { error: "Missing contact." };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, ownerId: session.user.id },
    select: { id: true, _count: { select: { transactions: true } } },
  });
  if (!contact) {
    return { error: "That contact could not be found." };
  }
  if (contact._count.transactions > 0) {
    return { error: "This contact has transactions on file and can't be deleted. Set their status to Past Client instead." };
  }

  // Cascading the delete removes this contact's tasks at the database
  // level, but ScheduledNotification rows aren't a foreign-key relation
  // to Task/Contact (see its schema comment) — cancel every pending
  // reminder that would otherwise point at a page that's about to 404.
  const tasks = await prisma.task.findMany({ where: { contactId: contact.id }, select: { id: true } });
  await Promise.all([cancelFollowUpReminder(contact.id), ...tasks.map((task) => cancelTaskReminder(task.id))]);

  await prisma.contact.delete({ where: { id: contact.id } });

  revalidatePath("/contacts");
  redirect("/contacts");
}

const optionalDateOnly = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").optional(),
);
const optionalTimeOnly = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time").optional(),
);

const setFollowUpSchema = z.object({
  contactId: z.string().min(1),
  nextFollowUpDate: optionalDateOnly,
  nextFollowUpTime: optionalTimeOnly,
});

export interface ContactFollowUpState {
  error?: string;
}

/**
 * Sets, changes, or clears (submit with the date field blank) a contact's
 * follow-up date. Stays on the contact page rather than redirecting — this
 * is a quick inline action, not a full form flow. The actual owner-scoped
 * mutation lives in src/lib/contacts/mutations.ts so it's independently
 * testable against the dedicated test database.
 */
export async function setContactFollowUpDateAction(
  _prevState: ContactFollowUpState | undefined,
  formData: FormData,
): Promise<ContactFollowUpState> {
  const session = await requireSession();

  const parsed = setFollowUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid date." };
  }

  const { contactId, nextFollowUpDate, nextFollowUpTime } = parsed.data;
  const combinedDate = nextFollowUpDate ? combineDateAndTimeUTC(nextFollowUpDate, nextFollowUpTime) : null;

  const updated = await setContactFollowUpDate(session.user.id, contactId, combinedDate);
  if (!updated) {
    return { error: "That contact could not be found." };
  }
  await scheduleFollowUpReminder(updated);

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return {};
}

const CONTACT_ACTIVITY_LOG_TYPES = CONTACT_TOUCHPOINT_ACTIVITY_TYPES;

const logActivitySchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(CONTACT_ACTIVITY_LOG_TYPES),
  notes: z.preprocess(blankStringToUndefined, z.string().trim().optional()),
});

export interface LogContactActivityState {
  error?: string;
}

/**
 * Logs a manual, agent-entered interaction (call/email/text/showing/note).
 * Blank notes fall back to a type-specific default phrase rather than
 * requiring text — description stays a required, meaningful string without
 * a separate nullable "notes" column. Only these five types are loggable
 * here; CREATED/STATUS_CHANGED/SYNCED/OTHER remain system-only.
 */
export async function logContactActivityAction(
  _prevState: LogContactActivityState | undefined,
  formData: FormData,
): Promise<LogContactActivityState> {
  const session = await requireSession();

  const parsed = logActivitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { contactId, type, notes } = parsed.data;
  const description = notes ?? CONTACT_ACTIVITY_DEFAULT_DESCRIPTIONS[type];

  const activity = await createContactActivity(session.user.id, contactId, type, description);
  if (!activity) {
    return { error: "That contact could not be found." };
  }

  revalidatePath(`/contacts/${contactId}`);
  return {};
}

const updateActivitySchema = z.object({
  activityId: z.string().min(1),
  type: z.enum(CONTACT_ACTIVITY_LOG_TYPES),
  notes: z.preprocess(blankStringToUndefined, z.string().trim().optional()),
});

export interface UpdateContactActivityState {
  error?: string;
}

/** Edits a logged activity in place — same loggable-types restriction as logContactActivityAction; system entries (CREATED/STATUS_CHANGED/SYNCED/OTHER) are never editable. */
export async function updateContactActivityAction(
  _prevState: UpdateContactActivityState | undefined,
  formData: FormData,
): Promise<UpdateContactActivityState> {
  const session = await requireSession();

  const parsed = updateActivitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { activityId, type, notes } = parsed.data;
  const description = notes ?? CONTACT_ACTIVITY_DEFAULT_DESCRIPTIONS[type];

  const activity = await updateContactActivity(session.user.id, activityId, type, description);
  if (!activity) {
    return { error: "That activity could not be found." };
  }

  revalidatePath(`/contacts/${activity.contactId}`);
  return {};
}

/** Deletes a logged activity — same loggable-types restriction as above. Fire-and-forget, same convention as completeTaskAction/cancelShowingAction. */
export async function deleteContactActivityAction(formData: FormData) {
  const session = await requireSession();

  const activityId = formData.get("activityId");
  if (typeof activityId !== "string") return;

  const deleted = await deleteContactActivity(session.user.id, activityId);
  if (!deleted) return;

  revalidatePath(`/contacts/${deleted.contactId}`);
}
