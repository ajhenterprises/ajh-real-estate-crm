"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "PAST"] as const;
const CLIENT_TYPES = ["BUYER", "SELLER", "BUYER_AND_SELLER", "OTHER"] as const;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const updateClientSchema = z.object({
  status: z.enum(CLIENT_STATUSES),
  type: z.enum(CLIENT_TYPES),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export interface UpdateClientState {
  error?: string;
}

export async function updateClientAction(
  _prevState: UpdateClientState | undefined,
  formData: FormData,
): Promise<UpdateClientState> {
  const session = await requireSession();

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) {
    return { error: "Missing client." };
  }

  const parsed = updateClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await prisma.client.updateMany({
    where: { id: clientId, ownerId: session.user.id },
    data: {
      status: parsed.data.status,
      type: parsed.data.type,
      notes: parsed.data.notes ?? null,
    },
  });
  if (result.count === 0) {
    return { error: "That client could not be found." };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export interface DeleteClientState {
  error?: string;
}

/**
 * Deleting a Client cascades (schema.prisma: Transaction.client is
 * onDelete: Cascade) into every transaction ever recorded for them —
 * active or long since closed. That's exactly the kind of financial/legal
 * history this CRM exists to keep, so a client with any transaction on
 * file at all, regardless of status, can never be deleted this way. The
 * contact underneath is untouched either way — this only ever removes the
 * Client relationship, never the person.
 */
export async function deleteClientAction(
  _prevState: DeleteClientState | undefined,
  formData: FormData,
): Promise<DeleteClientState> {
  const session = await requireSession();

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) {
    return { error: "Missing client." };
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, ownerId: session.user.id },
    select: { id: true, _count: { select: { transactions: true } } },
  });
  if (!client) {
    return { error: "That client could not be found." };
  }
  if (client._count.transactions > 0) {
    return { error: "This client has transactions on file and can't be deleted. Set status to Inactive instead." };
  }

  await prisma.client.delete({ where: { id: client.id } });

  revalidatePath("/clients");
  redirect("/clients");
}
