import "server-only";
import { prisma } from "@/lib/db";

export function getContractInformationById(userId: string, id: string) {
  return prisma.contractInformation.findFirst({
    where: { id, ownerId: userId },
    include: {
      document: true,
      confirmedByUser: { select: { name: true } },
      events: true,
    },
  });
}

export function getContractInformationByDocumentId(userId: string, documentId: string) {
  return prisma.contractInformation.findFirst({
    where: { documentId, ownerId: userId },
  });
}
