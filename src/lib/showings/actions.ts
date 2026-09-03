"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { createContactActivity } from "@/lib/contacts/mutations";
import { parseDateTimeInputValue } from "@/lib/format";

const SHOWING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const showingDateTime = z.string().refine((value) => parseDateTimeInputValue(value) !== null, "Enter a valid date and time");

const showingFieldsSchema = {
  propertyAddress: z.string().trim().min(1, "Property address is required"),
  scheduledAt: showingDateTime,
  notes: optionalString,
};

const createShowingSchema = z.object({
  ...showingFieldsSchema,
  contactId: optionalString,
  clientId: optionalString,
});

const updateShowingSchema = z.object({
  showingId: z.string().min(1),
  status: z.enum(SHOWING_STATUSES),
  ...showingFieldsSchema,
});

export interface ShowingFormState {
  error?: string;
}

/**
 * Verifies contactId/clientId (if provided) belong to this user and that at
 * least one is present — a showing always has to answer "who is this for,"
 * same rule stated in the schema comment on the Showing model itself.
 */
async function resolveShowingSubject(
  userId: string,
  contactId: string | undefined,
  clientId: string | undefined,
): Promise<{ contactId: string | null; clientId: string | null } | { error: string }> {
  if (!contactId && !clientId) {
    return { error: "A showing needs a contact or client." };
  }
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, ownerId: userId } });
    if (!contact) return { error: "That contact could not be found." };
  }
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, ownerId: userId } });
    if (!client) return { error: "That client could not be found." };
  }
  return { contactId: contactId ?? null, clientId: clientId ?? null };
}

/** Embedded quick-add, used on the Contact and Client profile pages — stays on the same page rather than redirecting, same convention as logContactActivityAction/setContactFollowUpDateAction. */
export async function createShowingAction(
  _prevState: ShowingFormState | undefined,
  formData: FormData,
): Promise<ShowingFormState> {
  const session = await requireSession();

  const parsed = createShowingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { contactId, clientId, propertyAddress, scheduledAt, notes } = parsed.data;
  const subject = await resolveShowingSubject(session.user.id, contactId, clientId);
  if ("error" in subject) return subject;

  await prisma.showing.create({
    data: {
      propertyAddress,
      scheduledAt: parseDateTimeInputValue(scheduledAt)!,
      notes,
      contactId: subject.contactId,
      clientId: subject.clientId,
      ownerId: session.user.id,
    },
  });

  revalidatePath("/showings");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (subject.contactId) revalidatePath(`/contacts/${subject.contactId}`);
  if (subject.clientId) revalidatePath(`/clients/${subject.clientId}`);
  return {};
}

export async function updateShowingAction(
  _prevState: ShowingFormState | undefined,
  formData: FormData,
): Promise<ShowingFormState> {
  const session = await requireSession();

  const parsed = updateShowingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { showingId, status, propertyAddress, scheduledAt, notes } = parsed.data;

  const existing = await prisma.showing.findFirst({ where: { id: showingId, ownerId: session.user.id } });
  if (!existing) {
    return { error: "That showing could not be found." };
  }

  await prisma.showing.update({
    where: { id: existing.id },
    data: { propertyAddress, scheduledAt: parseDateTimeInputValue(scheduledAt)!, notes, status },
  });

  revalidatePath("/showings");
  revalidatePath(`/showings/${existing.id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  if (existing.contactId) revalidatePath(`/contacts/${existing.contactId}`);
  if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`);
  redirect(`/showings/${existing.id}`);
}

/**
 * Sets status and, for COMPLETED, logs it as a SHOWING touchpoint on the
 * linked contact — resolving through the linked client when the showing was
 * only ever tied to a client, since every Client has exactly one Contact.
 * This is what actually creates ContactActivityType.SHOWING entries from a
 * real scheduled showing, rather than only the manual "log activity" form.
 */
async function setShowingStatus(showingId: string, status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
  const session = await requireSession();

  const existing = await prisma.showing.findFirst({
    where: { id: showingId, ownerId: session.user.id },
    include: { client: { select: { contactId: true } } },
  });
  if (!existing) return;

  await prisma.showing.update({ where: { id: existing.id }, data: { status } });

  if (status === "COMPLETED") {
    const contactId = existing.contactId ?? existing.client?.contactId ?? null;
    if (contactId) {
      await createContactActivity(
        session.user.id,
        contactId,
        "SHOWING",
        `Showing at ${existing.propertyAddress}`,
      );
    }
  }

  revalidatePath("/showings");
  revalidatePath(`/showings/${existing.id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  if (existing.contactId) revalidatePath(`/contacts/${existing.contactId}`);
  if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`);
}

export async function completeShowingAction(formData: FormData) {
  const showingId = formData.get("showingId");
  if (typeof showingId !== "string") return;
  await setShowingStatus(showingId, "COMPLETED");
}

export async function cancelShowingAction(formData: FormData) {
  const showingId = formData.get("showingId");
  if (typeof showingId !== "string") return;
  await setShowingStatus(showingId, "CANCELLED");
}

export async function reopenShowingAction(formData: FormData) {
  const showingId = formData.get("showingId");
  if (typeof showingId !== "string") return;
  await setShowingStatus(showingId, "SCHEDULED");
}
