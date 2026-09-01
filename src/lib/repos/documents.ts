import "server-only";
import { prisma } from "@/lib/db";
import { documentOwnershipFilter } from "@/lib/documents/mutations";

/**
 * A document is owned transitively through whichever of transaction /
 * client / contact / expense it's attached to — Document itself has no
 * ownerId column (adding one would duplicate what's already derivable).
 * documentOwnershipFilter (src/lib/documents/mutations.ts) covers all four
 * attachment points so a document can never be read by anyone but the
 * owner of the record it's attached to, regardless of which relation is
 * populated.
 */
export function getDocumentById(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, ...documentOwnershipFilter(userId) },
  });
}
