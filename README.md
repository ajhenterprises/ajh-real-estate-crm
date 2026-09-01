# AJH Real Estate CRM

A private, internal-first real estate transaction management CRM. This is
**not** a lead-gen or marketing CRM — BoldTrail and Follow Up Boss remain the
lead-management systems of record. AJH Real Estate CRM is the transaction and
closing command center: Lead → Contact → Client → Transaction → Contract →
Key Dates → Tasks → Closing.

This application intentionally contains **no AI/LLM integration**. Every
workflow — including the future contract-intelligence phase — is built on
deterministic application code, database logic, and user confirmation.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, TypeScript) | Single deployable for UI + API/server actions; no separate backend service |
| Database | PostgreSQL via Prisma ORM 7 | Relational fit for the Contact→Client→Transaction→Deadline graph; type-safe queries and migrations |
| Auth | Auth.js (next-auth) v5, Credentials provider, JWT sessions | Self-hosted, no third-party auth vendor cost; multi-user-ready |
| Styling | Tailwind CSS v4 with CSS custom-property design tokens | Fast, no runtime CSS-in-JS cost, easy to keep the palette consistent |
| Document storage | Local-filesystem adapter behind a `StorageAdapter` interface | Zero extra infra for now; swap in an S3-compatible adapter later without touching feature code |
| Testing | Vitest | Fast, no separate config for TS/ESM |
| Deployment | Any Node host (Vercel, a VPS, etc.) | No vendor lock-in beyond a Postgres instance |

No AI SDKs, chatbots, or LLM APIs are installed or referenced anywhere in
this codebase.

## Architecture notes

- **Authorization boundary**: every domain table (`Contact`, `Client`,
  `Transaction`, `Task`, `Document`) carries an owner/assignee foreign key to
  `User`. Every query in `src/lib/repos/**` and every mutation in
  `src/lib/**/actions.ts` filters by the current session's user id — a
  record id alone is never sufficient to read or write it. Middleware
  (`src/proxy.ts`, Next 16's renamed "middleware" convention) additionally
  redirects unauthenticated requests before they reach a page.
- **Auth config split**: `src/lib/auth/edge-config.ts` holds the
  Edge-runtime-safe session/JWT config (no providers). `src/lib/auth/config.ts`
  extends it with the Credentials provider, which needs Prisma/`pg` — a
  Node-only dependency. `src/proxy.ts` uses the edge config directly;
  everything else uses the full config via `src/lib/auth/index.ts`. This
  keeps Prisma out of the Edge middleware bundle.
- **Flexible deadlines, not fixed columns**: `TransactionEvent` is a
  generic (transaction, eventType, title, date, status) row rather than
  dozens of hard-coded date columns, so different contract templates can
  introduce new deadline types without a schema migration.
- **Integration-ready, not integrated**: nothing in the Contacts/Leads
  system assumes manual entry is the only way a record gets created.
  `Contact.source` / `ContactSource` covers every lead source the CRM
  expects to support (BoldTrail, Follow Up Boss, Bullseye, website/IDX,
  Facebook, referral, manual, other) and `Contact.sourceContactId` holds
  that source's id for the contact, so a future sync job can match instead
  of duplicating records. `Integration` (one row per provider per owner:
  connected/disconnected, last sync time/error) and `ExternalSyncLink`
  (per-record provider + externalId + sync status, optionally tied to the
  `Integration` that produced it) are the connection-level vs. record-level
  halves of the same concept. `ContactActivity` is a single timeline shape
  for both manual actions (a note, a status change) and integration-
  generated events, carrying an optional `externalEventId` so a future
  webhook consumer can dedupe/replay deliveries safely. No provider-specific
  client code, credential storage, or sync job exists anywhere yet — this
  phase only makes sure adding one later is additive, not a redesign.
- **Documents foundation only**: the `Document` model and
  `src/lib/storage` abstraction exist; there is no upload UI yet
  (that's a later phase per the roadmap below), and there is no AI
  parsing anywhere in the plan for it.
- **Date-only fields use UTC calendar days, consistently**: every date-only
  value (deadlines, follow-up dates, due dates) is stored as UTC midnight
  and every "is this today / overdue / upcoming" comparison buckets by UTC
  calendar day (`startOfTodayUTC` / `endOfTodayUTC` in `src/lib/format.ts`)
  rather than the server process's local time zone. This keeps behavior
  identical regardless of what time zone the app happens to be deployed in,
  and is deliberately scoped to date-only semantics — timestamp fields like
  `createdAt`/`updatedAt`/`completedDate`/`confirmedAt` are unaffected.
- **Document deletion is file-first, DB-row-second**: `deleteDocument`
  (`src/lib/documents/mutations.ts`) removes the physical file before the
  database row, treating "already missing" (`ENOENT`) as success and
  aborting before touching the row on any other storage error. This means a
  failure can only ever leave a stale-but-harmless DB row, never an orphaned
  file with no trace of it — see Backup & Recovery below for the one
  exception (direct database administration bypassing this path) and its
  manual cleanup tool.

## Roadmap

This section previously listed a fixed phase numbering drawn up before
development started; it fell out of sync with what was actually built (most
notably, it still called task templates an unbuilt "Phase 6" after they had
already shipped). What's below reflects the phases actually delivered, in
order:

- **Phase 1** — Application foundation: stack, schema, auth, design system,
  navigation shell.
- **Phase 2** — Made the Contacts/Leads model integration-ready (source
  tracking, sync-link foundation) without implementing any integration.
- **Phase 3** — Contact → Client → Transaction workflow.
- **Phase 4** — Task management: global task list, transaction checklists,
  configurable task templates, default buyer/seller checklists.
- **Phase 5** — Document upload/storage and Contract Information: a
  deterministic (**not AI**) contract date-calculation engine with full
  calculation transparency and user override.
- **Phase 6** — Contract-derived tasks: confirming a contract automatically
  generates and reconciles tasks tied to its calculated deadlines.
- **Phase 7** — Contact relationship & follow-up layer: explicit follow-up
  dates, manual activity logging (calls/emails/texts/showings/notes), a
  dashboard "Needs Follow-Up" view, and Contacts list search/filter/sort.
- **Phase 8** — Date/lifecycle correctness (a single UTC-calendar-day
  convention for all "is this today/overdue/upcoming" comparisons), a real
  document-delete action (closing the gap where no explicit deletion path
  existed), and a documented backup/recovery strategy with an operator-run
  orphaned-file reconciliation script.

Future phases are decided and scoped one at a time rather than fixed in
advance here.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)

npm run db:migrate     # create the database schema
SEED_USER_EMAIL=you@example.com SEED_USER_PASSWORD=changeme npm run db:seed

npm run dev             # http://localhost:3000
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:migrate:deploy` | Apply Prisma migrations (prod) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Create/update the bootstrap user (`SEED_USER_EMAIL`/`SEED_USER_PASSWORD`/`SEED_USER_NAME` env vars) |
| `npm run db:backup` | Dump the database at `DATABASE_URL` to a timestamped `.sql` file — see Backup & Recovery |
| `npm run db:restore -- <file.sql>` | Restore a dump produced by `db:backup` — see Backup & Recovery |
| `npm run db:find-orphaned-documents` | Report (or, with `-- --delete`, remove) storage files with no matching `Document` row — see Backup & Recovery |

## Backup & Recovery

**Database.** `npm run db:backup` runs `pg_dump` against `DATABASE_URL` and
writes a plain-SQL, human-inspectable dump to `backups/` (git-ignored) as
`ajh-crm-db-<timestamp>.sql`. It reads its connection string only from the
environment — no credentials are hard-coded anywhere in the script. To
restore, run `npm run db:restore -- backups/<file>.sql`: it prints the
(password-masked) target connection string and requires you to type `yes`
before doing anything, so it's difficult to trigger against the wrong
database by accident; pass `-- <file> --yes` only for scripted use against a
non-production target (e.g. this project's own isolated test database, as
its own integration test does).

Neither script is invoked automatically by the application, a migration, or
a deployment hook — they're operator tools, run by hand or wired into
whatever scheduling mechanism the actual deployment environment provides.
This repo is deliberately provider-agnostic (see Stack above: "any Node
host"), so backup **scheduling**, retention, off-site copies, and encryption
at rest are the deploying environment's own responsibility, using whatever
mechanism it already has for scheduled jobs and secure storage.

**Document storage.** The `DOCUMENT_STORAGE_PATH` directory (uploaded
files) is not covered by `db:backup` — it needs its own, separate backup
using the deployment environment's standard file-backup mechanism (e.g. a
volume snapshot, rsync to off-site storage). A full recovery restores both:
the database dump and the document-storage directory from around the same
point in time, then run `npx prisma migrate status` to confirm the restored
schema matches the deployed code before serving traffic.

**Orphaned files.** Document deletion (`deleteDocument`,
`src/lib/documents/mutations.ts`) always removes the physical file before
the database row, so the normal delete path can never leave an orphaned
file. The one way an orphan can still occur is a `Document` row disappearing
through a cascading deletion of its parent (`User`/`Contact`/`Client`/
`Transaction`) via direct database administration — no in-app action
deletes those today. `npm run db:find-orphaned-documents` reports (default)
or removes (`-- --delete`) files under storage with no matching `Document`
row; it is read-only unless `--delete` is passed explicitly, and — like the
backup/restore scripts — is never invoked automatically. Run it by hand,
read what it reports, then decide.

## Key files

- `prisma/schema.prisma` — the full data model
- `src/lib/db.ts` — Prisma client singleton (driver-adapter pattern required by Prisma 7)
- `src/lib/auth/*` — Auth.js config (edge/node split), session helper, server actions
- `src/proxy.ts` — route-level auth boundary
- `src/lib/repos/*` — owner-scoped read queries
- `src/lib/storage/*` — document storage abstraction
- `src/app/(app)/*` — authenticated app shell and pages
- `src/app/login` — public sign-in page
