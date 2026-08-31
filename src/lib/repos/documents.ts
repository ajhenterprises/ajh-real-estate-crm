import "server-only";
import { prisma } from "@/lib/db";

/**
 * A document is owned transitively through whichever of transaction /
 * client / contact it's attached to — Document itself has no ownerId
 * column (adding one would duplicate what's already derivable, and every
 * document created by this phase's upload flow always has a
 * transactionId). This OR covers all three attachment points so a
 * document can never be read by anyone but the owner of the record it's
 * attached to, regardless of which relation is populated.
 */
export function getDocumentById(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [
        { transaction: { ownerId: userId } },
        { client: { ownerId: userId } },
        { contact: { ownerId: userId } },
      ],
    },
  });
}
