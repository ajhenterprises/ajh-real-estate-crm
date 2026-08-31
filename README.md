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
- **Integration-ready, not integrated**: `Contact.source` /
  `Contact.sourceContactId` and the `ExternalSyncLink` model
  (provider, externalId, local contact id, last-synced timestamp, sync
  status/error) exist so a future BoldTrail/Follow Up Boss sync job can
  match instead of duplicating records. No provider-specific logic exists
  anywhere yet — this phase does not implement either integration.
- **Documents foundation only**: the `Document` model and
  `src/lib/storage` abstraction exist; there is no upload UI yet
  (that's a later phase per the roadmap below), and there is no AI
  parsing anywhere in the plan for it.

## Roadmap (not yet built)

Phase 2: Contacts + client workflow (create/edit forms) · Phase 3:
Transaction workflow · Phase 4: Contract/document upload · Phase 5: Contract
data extraction (deterministic PDF text extraction + user review/confirm —
**not AI**) · Phase 6: Task templates · Phase 7: Deadline/reminder engine ·
Phase 8: Follow Up Boss integration · Phase 9: BoldTrail integration · Phase
10: Calendar/email/notification integrations.

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

## Key files

- `prisma/schema.prisma` — the full data model
- `src/lib/db.ts` — Prisma client singleton (driver-adapter pattern required by Prisma 7)
- `src/lib/auth/*` — Auth.js config (edge/node split), session helper, server actions
- `src/proxy.ts` — route-level auth boundary
- `src/lib/repos/*` — owner-scoped read queries
- `src/lib/storage/*` — document storage abstraction
- `src/app/(app)/*` — authenticated app shell and pages
- `src/app/login` — public sign-in page
