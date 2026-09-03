"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";
import { createContactActivity, setContactFollowUpDate } from "@/lib/contacts/mutations";
import { blankStringToUndefined, CONTACT_ACTIVITY_DEFAULT_DESCRIPTIONS } from "@/lib/contacts/activity";

const CONTACT_TYPES = ["LEAD", "CLIENT", "PAST_CLIENT", "VENDOR", "OTHER"] as const;
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

  // Ownership check via the where clause itself, not a separate lookup —
  // updateMany matching zero rows (wrong id, or someone else's contact)
  // is indistinguishable from "not found" and handled identically.
  const result = await prisma.contact.updateMany({
    where: { id: contactId, ownerId: session.user.id },
    data: parsed.data,
  });
  if (result.count === 0) {
    return { error: "That contact could not be found." };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}`);
}

/**
 * Deleting a Contact cascades (at the database level — see
 * onDelete: Cascade in schema.prisma) into its Client row if one exists,
 * which itself cascades into that Client's Transactions and everything
 * hanging off them. That's real, often irreplaceable business data, so a
 * contact that has ever been converted to a client can never be deleted
 * through this action — the person has to be reachable some other way
 * (e.g. deactivating the Client) instead of losing transaction history to
 * an accidental click.
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
    select: { id: true, client: { select: { id: true } } },
  });
  if (!contact) {
    return { error: "That contact could not be found." };
  }
  if (contact.client) {
    return { error: "This contact is a client and can't be deleted. Deactivate the client instead." };
  }

  await prisma.contact.delete({ where: { id: contact.id } });

  revalidatePath("/contacts");
  redirect("/contacts");
}

const CLIENT_TYPES = ["BUYER", "SELLER", "BUYER_AND_SELLER", "OTHER"] as const;

/**
 * Idempotent by construction: Client.contactId is unique, so a second
 * conversion attempt (double submit, race, stale tab) either finds the
 * client that already exists or hits the unique constraint and is treated
 * the same way — it never creates a second Client for one Contact.
 */
export async function convertToClientAction(formData: FormData) {
  const session = await requireSession();

  const contactId = formData.get("contactId");
  const typeRaw = formData.get("type");
  if (typeof contactId !== "string") return;

  const typeParsed = z.enum(CLIENT_TYPES).safeParse(typeRaw);
  if (!typeParsed.success) return;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, ownerId: session.user.id },
    include: { client: true },
  });
  if (!contact) return;

  if (contact.client) {
    redirect(`/clients/${contact.client.id}`);
  }

  let clientId: string;
  try {
    const client = await prisma.client.create({
      data: { contactId: contact.id, ownerId: session.user.id, type: typeParsed.data },
    });
    clientId = client.id;
  } catch (error) {
    // Unique constraint on Client.contactId — someone else converted this
    // contact between our check and our create. Not an error: converge on
    // the client that now exists rather than surfacing a failure.
    const isDuplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!isDuplicate) throw error;

    const existing = await prisma.client.findUnique({ where: { contactId: contact.id } });
    if (!existing) throw error;
    clientId = existing.id;
  }

  await prisma.contactActivity.create({
    data: {
      contactId: contact.id,
      type: "STATUS_CHANGED",
      description: "Converted to client",
      source: "MANUAL",
    },
  });

  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .transform((value) => new Date(value))
    .optional(),
);

const setFollowUpSchema = z.object({
  contactId: z.string().min(1),
  nextFollowUpDate: optionalDate,
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

  const { contactId, nextFollowUpDate } = parsed.data;

  const updated = await setContactFollowUpDate(session.user.id, contactId, nextFollowUpDate ?? null);
  if (!updated) {
    return { error: "That contact could not be found." };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return {};
}

const CONTACT_ACTIVITY_LOG_TYPES = ["CALL", "EMAIL", "TEXT", "SHOWING", "NOTE_ADDED"] as const;

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
