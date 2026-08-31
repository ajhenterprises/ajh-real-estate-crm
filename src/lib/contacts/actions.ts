"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";

const CONTACT_TYPES = ["LEAD", "CLIENT", "PAST_CLIENT", "VENDOR", "OTHER"] as const;
const CONTACT_SOURCES = [
  "MANUAL",
  "BOLDTRAIL",
  "FOLLOW_UP_BOSS",
  "BULLSEYE",
  "WEBSITE",
  "FACEBOOK",
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
