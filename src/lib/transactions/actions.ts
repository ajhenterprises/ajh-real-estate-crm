"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { TRANSACTION_EVENT_TYPE_LABELS } from "@/lib/labels";

const TRANSACTION_TYPES = ["BUYER", "SELLER", "OTHER"] as const;
const TRANSACTION_STATUSES = [
  "PROSPECT",
  "ACTIVE",
  "UNDER_CONTRACT",
  "PENDING",
  "CLOSED",
  "CANCELLED",
] as const;
const TRANSACTION_EVENT_TYPES = Object.keys(TRANSACTION_EVENT_TYPE_LABELS) as [
  keyof typeof TRANSACTION_EVENT_TYPE_LABELS,
  ...(keyof typeof TRANSACTION_EVENT_TYPE_LABELS)[],
];

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .transform((value) => new Date(value))
    .optional(),
);
const optionalMoney = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid dollar amount")
    .optional(),
);

const transactionFieldsSchema = {
  type: z.enum(TRANSACTION_TYPES),
  status: z.enum(TRANSACTION_STATUSES),
  propertyAddress: optionalString,
  propertyCity: optionalString,
  propertyState: optionalString,
  propertyZip: optionalString,
  mlsNumber: optionalString,
  listingPrice: optionalMoney,
  purchasePrice: optionalMoney,
  contractEffectiveDate: optionalDate,
  expectedClosingDate: optionalDate,
  actualClosingDate: optionalDate,
  notes: optionalString,
};

const createTransactionSchema = z.object({
  clientId: z.string().min(1),
  ...transactionFieldsSchema,
});

const updateTransactionSchema = z.object({
  transactionId: z.string().min(1),
  ...transactionFieldsSchema,
});

export interface TransactionFormState {
  error?: string;
}

export async function createTransactionAction(
  _prevState: TransactionFormState | undefined,
  formData: FormData,
): Promise<TransactionFormState> {
  const session = await requireSession();

  const parsed = createTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { clientId, ...fields } = parsed.data;

  // Never trust a client id from the browser: it must belong to the
  // signed-in user, or the transaction is not created.
  const client = await prisma.client.findFirst({ where: { id: clientId, ownerId: session.user.id } });
  if (!client) {
    return { error: "That client could not be found." };
  }

  const transaction = await prisma.transaction.create({
    data: { ...fields, clientId: client.id, ownerId: session.user.id },
  });

  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/transactions");
  redirect(`/transactions/${transaction.id}`);
}

export async function updateTransactionAction(
  _prevState: TransactionFormState | undefined,
  formData: FormData,
): Promise<TransactionFormState> {
  const session = await requireSession();

  const parsed = updateTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { transactionId, ...fields } = parsed.data;

  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: session.user.id },
  });
  if (!existing) {
    return { error: "That transaction could not be found." };
  }

  await prisma.transaction.update({ where: { id: existing.id }, data: fields });

  revalidatePath(`/transactions/${existing.id}`);
  revalidatePath(`/clients/${existing.clientId}`);
  revalidatePath("/transactions");
  redirect(`/transactions/${existing.id}`);
}

const addEventSchema = z.object({
  transactionId: z.string().min(1),
  eventType: z.enum(TRANSACTION_EVENT_TYPES),
  title: optionalString,
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .transform((value) => new Date(value)),
  notes: optionalString,
});

export interface AddEventState {
  error?: string;
}

export async function addTransactionEventAction(
  _prevState: AddEventState | undefined,
  formData: FormData,
): Promise<AddEventState> {
  const session = await requireSession();

  const parsed = addEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { transactionId, eventType, title, date, notes } = parsed.data;

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: session.user.id },
  });
  if (!transaction) {
    return { error: "That transaction could not be found." };
  }

  await prisma.transactionEvent.create({
    data: {
      transactionId: transaction.id,
      eventType,
      title: title ?? TRANSACTION_EVENT_TYPE_LABELS[eventType],
      date,
      notes,
    },
  });

  revalidatePath(`/transactions/${transaction.id}`);
  return {};
}

export async function setTransactionEventStatusAction(formData: FormData) {
  const session = await requireSession();

  const eventId = formData.get("eventId");
  const status = formData.get("status");
  if (typeof eventId !== "string" || typeof status !== "string") return;
  if (!["PENDING", "COMPLETED", "MISSED", "WAIVED"].includes(status)) return;

  const event = await prisma.transactionEvent.findFirst({
    where: { id: eventId, transaction: { ownerId: session.user.id } },
  });
  if (!event) return;

  await prisma.transactionEvent.update({
    where: { id: event.id },
    data: { status: status as "PENDING" | "COMPLETED" | "MISSED" | "WAIVED" },
  });

  revalidatePath("/");
  revalidatePath(`/transactions/${event.transactionId}`);
}
