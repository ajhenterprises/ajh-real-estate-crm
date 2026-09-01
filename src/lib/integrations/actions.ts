"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { disconnectIntegration } from "@/lib/integrations/mutations";

/**
 * Fire-and-forget, matching archiveDocumentAction's shape. Real and fully
 * functional (unlike a "Connect" button, which this phase deliberately
 * does not build — see src/app/(app)/integrations/page.tsx's comment):
 * disconnecting an already-DISCONNECTED integration, or one that doesn't
 * exist for this user, is a safe no-op either way.
 */
export async function disconnectIntegrationAction(formData: FormData) {
  const session = await requireSession();

  const integrationId = formData.get("integrationId");
  if (typeof integrationId !== "string") return;

  await disconnectIntegration(session.user.id, integrationId);

  revalidatePath("/integrations");
}
