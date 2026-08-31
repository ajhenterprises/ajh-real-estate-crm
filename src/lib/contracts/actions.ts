"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { calculateContractEvents } from "@/lib/contracts/dates";

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
const optionalPeriodDays = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(0).max(3650).optional(),
);
const optionalDayType = z.preprocess(emptyToUndefined, z.enum(["CALENDAR", "BUSINESS"]).optional());

const contractInformationFieldsSchema = {
  buyerNames: optionalString,
  sellerNames: optionalString,
  propertyAddress: optionalString,
  propertyCity: optionalString,
  propertyState: optionalString,
  propertyZip: optionalString,
  purchasePrice: optionalMoney,
  earnestMoneyAmount: optionalMoney,
  contractEffectiveDate: optionalDate,
  expectedClosingDate: optionalDate,
  earnestMoneyDueDate: optionalDate,
  inspectionPeriodDays: optionalPeriodDays,
  inspectionPeriodDayType: optionalDayType,
  financingPeriodDays: optionalPeriodDays,
  financingPeriodDayType: optionalDayType,
  appraisalPeriodDays: optionalPeriodDays,
  appraisalPeriodDayType: optionalDayType,
  titlePeriodDays: optionalPeriodDays,
  titlePeriodDayType: optionalDayType,
  notes: optionalString,
};

const updateSchema = z.object({
  contractInformationId: z.string().min(1),
  ...contractInformationFieldsSchema,
});

export interface ContractInformationFormState {
  error?: string;
}

/**
 * Creates the blank draft record for a contract document and immediately
 * routes to its edit form. There is nothing to validate beyond ownership —
 * every field starts empty, matching "the user must enter/confirm them,"
 * never a guess.
 */
export async function createContractInformationAction(formData: FormData) {
  const session = await requireSession();

  const transactionId = formData.get("transactionId");
  const documentId = formData.get("documentId");
  if (typeof transactionId !== "string" || typeof documentId !== "string") return;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      transactionId,
      documentType: "CONTRACT",
      transaction: { ownerId: session.user.id },
    },
  });
  if (!document) return;

  const existing = await prisma.contractInformation.findUnique({ where: { documentId } });
  if (existing) {
    redirect(`/transactions/${transactionId}/contract-information/${existing.id}/edit`);
  }

  const created = await prisma.contractInformation.create({
    data: { transactionId, documentId, ownerId: session.user.id },
  });

  revalidatePath(`/transactions/${transactionId}`);
  redirect(`/transactions/${transactionId}/contract-information/${created.id}/edit`);
}

export async function updateContractInformationAction(
  _prevState: ContractInformationFormState | undefined,
  formData: FormData,
): Promise<ContractInformationFormState> {
  const session = await requireSession();

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { contractInformationId, ...fields } = parsed.data;

  const existing = await prisma.contractInformation.findFirst({
    where: { id: contractInformationId, ownerId: session.user.id },
  });
  if (!existing) {
    return { error: "That contract information record could not be found." };
  }

  await prisma.contractInformation.update({ where: { id: existing.id }, data: fields });

  revalidatePath(`/transactions/${existing.transactionId}`);
  revalidatePath(`/transactions/${existing.transactionId}/contract-information/${existing.id}`);
  redirect(`/transactions/${existing.transactionId}/contract-information/${existing.id}`);
}

/**
 * Confirmation: computes what the current draft supports and reconciles it
 * with any existing events from a previous confirmation of this same
 * record. Idempotent by construction — the unique constraint on
 * (contractInformationId, eventType) means "update in place" is the only
 * possible outcome for a repeat confirmation, never a duplicate row. A
 * user's override (isOverridden) is preserved: re-confirming refreshes
 * calculatedDate/calculationBasis so the record always reflects what the
 * rule currently says, but never silently discards a deliberate override
 * of the actual `date` used for the deadline.
 */
export async function confirmContractInformationAction(formData: FormData) {
  const session = await requireSession();

  const contractInformationId = formData.get("contractInformationId");
  if (typeof contractInformationId !== "string") return;

  const info = await prisma.contractInformation.findFirst({
    where: { id: contractInformationId, ownerId: session.user.id },
  });
  if (!info) return;

  const candidates = calculateContractEvents(info);

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const existingEvent = await tx.transactionEvent.findUnique({
        where: {
          contractInformationId_eventType: {
            contractInformationId: info.id,
            eventType: candidate.eventType,
          },
        },
      });

      if (!existingEvent) {
        await tx.transactionEvent.create({
          data: {
            transactionId: info.transactionId,
            contractInformationId: info.id,
            eventType: candidate.eventType,
            title: candidate.title,
            date: candidate.date,
            source: "contract_information",
            isCalculated: candidate.isCalculated,
            calculationBasis: candidate.calculationBasis,
            calculatedDate: candidate.isCalculated ? candidate.date : null,
          },
        });
        continue;
      }

      await tx.transactionEvent.update({
        where: { id: existingEvent.id },
        data: {
          title: candidate.title,
          isCalculated: candidate.isCalculated,
          calculationBasis: candidate.calculationBasis,
          calculatedDate: candidate.isCalculated ? candidate.date : null,
          // Only move the actual deadline date if the agent hasn't
          // deliberately overridden it — an override survives re-confirmation.
          ...(existingEvent.isOverridden ? {} : { date: candidate.date }),
        },
      });
    }

    await tx.contractInformation.update({
      where: { id: info.id },
      data: { confirmedAt: new Date(), confirmedByUserId: session.user.id },
    });
  });

  revalidatePath(`/transactions/${info.transactionId}`);
  revalidatePath(`/transactions/${info.transactionId}/contract-information/${info.id}`);
  revalidatePath("/");
}
