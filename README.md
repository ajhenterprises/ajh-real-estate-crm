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
| Document storage | `StorageAdapter` interface: local filesystem (dev/test) or any S3-compatible bucket (production), selected by `DOCUMENT_STORAGE_DRIVER` | Zero extra infra for local dev; production storage is a config change, not a code change — see Document Storage below |
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
- **Document deletion is file-first, DB-row-second, and checks deletion
  protection first**: `deleteDocument` (`src/lib/documents/mutations.ts`)
  removes the physical file before the database row, treating "already
  missing" (`ENOENT`) as success and aborting before touching the row on
  any other storage error. This means a failure can only ever leave a
  stale-but-harmless DB row, never an orphaned file with no trace of it —
  see Backup & Recovery below for the one exception (direct database
  administration bypassing this path) and its manual cleanup tool. Before
  any of that, it checks whether the document is protected from deletion
  at all — today that means a `ContractInformation` record built from it
  (`onDelete: Restrict` in the schema); this check running *before* the
  file delete, not after, is itself a fix (see git history/commit message
  for the bug it closes) and is the intended extension point for a future
  document-carrying feature (e.g. a not-yet-built tax/expense record) that
  needs its own, different retention policy — see Document Storage below.

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

## Document Storage

Documents are only ever read/written through the `StorageAdapter` interface
(`src/lib/storage/index.ts`) — application code never touches a filesystem
path or an S3 SDK call directly. Which physical backend that resolves to is
controlled by `DOCUMENT_STORAGE_DRIVER`:

- **`local` (the default)** — `LocalFilesystemStorageAdapter` writes to
  `DOCUMENT_STORAGE_PATH` on local disk. **Development and the test suite
  only.**
- **`s3`** — `S3StorageAdapter` (`src/lib/storage/s3.ts`) writes to any
  S3-compatible bucket — Cloudflare R2, AWS S3, Backblaze B2, MinIO, etc. —
  via the AWS SDK v3. Nothing in this adapter is vendor-specific; switching
  providers is an environment-variable change, never a code change. **This
  is the driver production must use.**

### Never rely on the Vercel filesystem for production documents

Vercel serverless functions have an ephemeral, effectively read-only
filesystem outside `/tmp`, and `/tmp` itself does not persist across
function invocations or deployments. If `DOCUMENT_STORAGE_DRIVER` is left
unset (or set to `local`) in a production Vercel environment, every
uploaded document will be silently lost the moment the serving function
recycles — no error, no warning, the file just quietly stops existing on
the next request. `DOCUMENT_STORAGE_DRIVER=s3` and its `S3_*` variables
must be configured before production traffic ever reaches document upload.

### Environment variables

| Variable | Applies to | Required | Notes |
| --- | --- | --- | --- |
| `DOCUMENT_STORAGE_DRIVER` | both | No — defaults to `local` | `"local"` or `"s3"` |
| `DOCUMENT_STORAGE_PATH` | `local` | No — defaults to `.data/documents` | **Development/test only** |
| `S3_BUCKET` | `s3` | Yes | |
| `S3_ACCESS_KEY_ID` | `s3` | Yes | |
| `S3_SECRET_ACCESS_KEY` | `s3` | Yes | |
| `S3_REGION` | `s3` | No — defaults to `"auto"` | Use a real AWS region for AWS S3 |
| `S3_ENDPOINT` | `s3` | Depends on provider | Required for R2/MinIO/most non-AWS providers; omit entirely for real AWS S3 |
| `S3_FORCE_PATH_STYLE` | `s3` | No — defaults to `false` | Some providers (e.g. MinIO) need `"true"` |

No credentials, bucket names, or endpoints are hard-coded anywhere in the
codebase — every value above comes only from the environment.

### Staying compatible with document deletion and orphan detection

- `deleteDocument` (`src/lib/documents/mutations.ts`) depends only on the
  `StorageAdapter` interface's error contract — `get()` throws an error
  with `.code === "ENOENT"` for a missing key, and `delete()` of an
  already-missing key does not throw. Both adapters honor this, so the
  file-first/DB-row-second deletion ordering and its failure semantics
  (see Backup & Recovery below) are identical regardless of which driver
  is active.
- `scripts/find-orphaned-documents.ts` is local-filesystem-specific — it
  walks `DOCUMENT_STORAGE_PATH` directly rather than going through
  `StorageAdapter`, so under the `s3` driver it has nothing local to scan
  and simply reports zero files. It is not a reconciliation tool for an S3
  bucket; that would need a separate tool built against the provider's
  listing API, which isn't needed until production actually adopts the
  `s3` driver.

### Future document-carrying features (e.g. tax/expense tracking)

Nothing about `StorageAdapter` or the R2/S3 backend is specific to
contacts, clients, or transactions — `storagePath` is an opaque key, and
neither adapter knows or cares what owns a document. A future feature that
attaches its own documents (receipts, invoices, mileage logs, ...) reuses
this exact storage layer and bucket, the same way `Contact`/`Client`/
`Transaction` already do: one more nullable foreign key on `Document`
(e.g. `expenseRecordId`), a new key prefix (e.g.
`expenses/{id}/{uuid}.ext`), and one more clause in `deleteDocument`'s
ownership check — never a second storage system.

Retention is designed the same way, and is already proven, not just
planned: `ContractInformation` documents are protected from deletion via
`onDelete: Restrict` in the schema, and `deleteDocument`
(`src/lib/documents/mutations.ts`) checks for that relation *before*
touching storage — never after, which was itself a bug this fixed (a
protected file was previously destroyed before the database constraint
ever got a chance to block anything). A future retention policy — e.g. a
tax/expense record's documents needing to survive longer, or under
different rules, than an ordinary project document — plugs into that same
pre-storage-delete check. No retention rules are implemented for a
tax/expense feature today, because that feature doesn't exist yet; the
point is only that adding one later is a small, additive change to an
existing, already-working check, not a redesign.

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

**Document storage.** Uploaded files are never covered by `db:backup` —
they need their own, separate backup, and what that looks like depends on
the driver (see Document Storage above). Under `local`, that means the
`DOCUMENT_STORAGE_PATH` directory needs the deployment environment's
standard file-backup mechanism (e.g. a volume snapshot, rsync to off-site
storage) — though `local` should only ever be development/test in the
first place. Under `s3`, durability is largely the object-storage
provider's job (most S3-compatible providers replicate objects and offer
their own versioning/lifecycle features) — check what your chosen provider
guarantees and enable versioning if you want protection against an
accidental overwrite or delete, rather than assuming it's on by default. A
full recovery restores both the database dump and the document-storage
state from around the same point in time, then run
`npx prisma migrate status` to confirm the restored schema matches the
deployed code before serving traffic.

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
- `src/lib/storage/*` — document storage abstraction (`local.ts` for dev/test, `s3.ts` for production; see Document Storage above)
- `src/app/(app)/*` — authenticated app shell and pages
- `src/app/login` — public sign-in page
