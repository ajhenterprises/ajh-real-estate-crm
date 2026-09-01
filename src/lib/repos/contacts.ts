// Deliberately no `import "server-only"` here (unlike most repo files) —
// this module's DB-backed functions take an optional trailing Prisma-client
// override so they can be exercised directly against the dedicated test
// database in src/test/db.ts (that guard throws when imported outside a
// Next.js server build, which would break `npm test`). Only ever imported
// by server components/actions in application code — see contacts/page.tsx,
// contacts/[id]/page.tsx, and contacts/actions.ts.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ContactType } from "@/generated/prisma/enums";

// Every query here is scoped to `ownerId` for the current session user —
// a contact id alone (however it reaches the server) is never sufficient
// to read it. See getContactById in particular: it returns null rather
// than the row when the id belongs to someone else, so callers can 404.

export type ContactSort = "name_asc" | "name_desc" | "created_desc" | "created_asc" | "updated_desc";
export type ContactFollowUpFilter = "needs" | "none";

export interface ContactListFilters {
  search?: string;
  type?: ContactType;
  followUp?: ContactFollowUpFilter;
  sort?: ContactSort;
}

function contactOrderBy(sort: ContactSort | undefined) {
  switch (sort) {
    case "name_asc":
      return [{ lastName: "asc" as const }, { firstName: "asc" as const }];
    case "name_desc":
      return [{ lastName: "desc" as const }, { firstName: "desc" as const }];
    case "created_asc":
      return [{ createdAt: "asc" as const }];
    case "created_desc":
      return [{ createdAt: "desc" as const }];
    case "updated_desc":
    default:
      return [{ updatedAt: "desc" as const }];
  }
}

// Same local-server-time "today" boundary already used throughout
// dashboard.ts/repos/tasks.ts — see needsFollowUp's own doc comment for why
// this phase deliberately doesn't introduce a UTC-based boundary here.
function endOfTodayLocal(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  return start;
}

// Scoped to `ownerId` for the current session user — every filter is
// additive on top of that, never a substitute for it.
export function listContacts(
  userId: string,
  filters: ContactListFilters = {},
  db: Prisma.TransactionClient = prisma,
) {
  const { search, type, followUp, sort } = filters;

  return db.contact.findMany({
    where: {
      ownerId: userId,
      ...(type ? { contactType: type } : {}),
      ...(followUp === "needs"
        ? { nextFollowUpDate: { lt: endOfTodayLocal() } }
        : followUp === "none"
          ? { nextFollowUpDate: null }
          : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: contactOrderBy(sort),
    include: { client: true },
  });
}

export function getContactById(userId: string, contactId: string, db: Prisma.TransactionClient = prisma) {
  return db.contact.findFirst({
    where: { id: contactId, ownerId: userId },
    include: {
      client: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
      tasks: {
        where: { status: "PENDING" },
        orderBy: { dueDate: "asc" },
        take: 10,
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}
