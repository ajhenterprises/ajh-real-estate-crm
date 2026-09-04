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
});

const updateShowingSchema = z.object({
  showingId: z.string().min(1),
  status: z.enum(SHOWING_STATUSES),
  contactId: optionalString,
  ...showingFieldsSchema,
});

export interface ShowingFormState {
  error?: string;
}

/**
 * Verifies contactId (if provided) belongs to this user. `requireContact`
 * is true for creation — a showing always has to answer "who is this for"
 * when the agent is the one adding it (same rule stated in the schema
 * comment on the Showing model itself) — but false for editing an existing
 * showing, since the one legitimate way to reach a null contact is a
 * ShowingTime import that couldn't confidently match a name, and the edit
 * form is exactly how the agent links it afterward; the record already
 * exists, so nothing is lost by letting them save other changes (address,
 * time) before they've picked who it's for.
 */
async function resolveShowingSubject(
  userId: string,
  contactId: string | undefined,
  requireContact: boolean,
): Promise<{ contactId: string | null } | { error: string }> {
  if (requireContact && !contactId) {
    return { error: "A showing needs a contact." };
  }
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, ownerId: userId } });
    if (!contact) return { error: "That contact could not be found." };
  }
  return { contactId: contactId ?? null };
}

/** Embedded quick-add, used on a Contact's profile page — stays on the same page rather than redirecting, same convention as logContactActivityAction/setContactFollowUpDateAction. */
export async function createShowingAction(
  _prevState: ShowingFormState | undefined,
  formData: FormData,
): Promise<ShowingFormState> {
  const session = await requireSession();

  const parsed = createShowingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { contactId, propertyAddress, scheduledAt, notes } = parsed.data;
  const subject = await resolveShowingSubject(session.user.id, contactId, true);
  if ("error" in subject) return subject;

  await prisma.showing.create({
    data: {
      propertyAddress,
      scheduledAt: parseDateTimeInputValue(scheduledAt)!,
      notes,
      contactId: subject.contactId,
      ownerId: session.user.id,
    },
  });

  revalidatePath("/showings");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (subject.contactId) revalidatePath(`/contacts/${subject.contactId}`);
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

  const { showingId, status, contactId, propertyAddress, scheduledAt, notes } = parsed.data;

  const existing = await prisma.showing.findFirst({ where: { id: showingId, ownerId: session.user.id } });
  if (!existing) {
    return { error: "That showing could not be found." };
  }

  const subject = await resolveShowingSubject(session.user.id, contactId, false);
  if ("error" in subject) return subject;

  await prisma.showing.update({
    where: { id: existing.id },
    data: {
      propertyAddress,
      scheduledAt: parseDateTimeInputValue(scheduledAt)!,
      notes,
      status,
      contactId: subject.contactId,
    },
  });

  revalidatePath("/showings");
  revalidatePath(`/showings/${existing.id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  if (existing.contactId) revalidatePath(`/contacts/${existing.contactId}`);
  if (subject.contactId) revalidatePath(`/contacts/${subject.contactId}`);
  redirect(`/showings/${existing.id}`);
}

/**
 * Sets status and, for COMPLETED, logs it as a SHOWING touchpoint on the
 * linked contact. This is what actually creates ContactActivityType.SHOWING
 * entries from a real scheduled showing, rather than only the manual "log
 * activity" form.
 */
async function setShowingStatus(showingId: string, status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
  const session = await requireSession();

  const existing = await prisma.showing.findFirst({
    where: { id: showingId, ownerId: session.user.id },
  });
  if (!existing) return;

  await prisma.showing.update({ where: { id: existing.id }, data: { status } });

  if (status === "COMPLETED" && existing.contactId) {
    await createContactActivity(session.user.id, existing.contactId, "SHOWING", `Showing at ${existing.propertyAddress}`);
  }

  revalidatePath("/showings");
  revalidatePath(`/showings/${existing.id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  if (existing.contactId) revalidatePath(`/contacts/${existing.contactId}`);
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
