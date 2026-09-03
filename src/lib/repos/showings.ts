import "server-only";
import { prisma } from "@/lib/db";
import type { ShowingStatus } from "@/generated/prisma/enums";

export type ShowingStatusFilter = ShowingStatus;
export type ShowingSort = "soonest" | "newest" | "oldest";

export interface ShowingListFilters {
  search?: string;
  status?: ShowingStatusFilter;
  sort?: ShowingSort;
}

const showingInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  client: { select: { id: true, contact: { select: { firstName: true, lastName: true } } } },
} as const;

function showingOrderBy(sort: ShowingSort | undefined) {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" as const }];
    case "oldest":
      return [{ createdAt: "asc" as const }];
    case "soonest":
    default:
      return [{ scheduledAt: "asc" as const }];
  }
}

// Scoped to `ownerId` for the current session user, same convention as
// every other repo in this codebase. `status` undefined means no filter
// (every status) — the Showings page decides the default (upcoming-only)
// itself, the same way the Tasks page owns its own default relationship
// filter rather than baking one in here.
export function listShowings(userId: string, filters: ShowingListFilters = {}) {
  const { search, status, sort } = filters;

  return prisma.showing.findMany({
    where: {
      ownerId: userId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { propertyAddress: { contains: search, mode: "insensitive" as const } },
              { contact: { firstName: { contains: search, mode: "insensitive" as const } } },
              { contact: { lastName: { contains: search, mode: "insensitive" as const } } },
              { client: { contact: { firstName: { contains: search, mode: "insensitive" as const } } } },
              { client: { contact: { lastName: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    orderBy: showingOrderBy(sort),
    include: showingInclude,
  });
}

export function getShowingById(userId: string, id: string) {
  return prisma.showing.findFirst({
    where: { id, ownerId: userId },
    include: showingInclude,
  });
}
