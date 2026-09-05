# AJH Closing Desk for Vercel

Fresh CRM workspace based on the AJH Sites build, using the existing AJH Real Estate CRM Supabase PostgreSQL project and private S3-compatible storage.

## Setup

Deploy branch `codex/closing-desk-vercel` as a new Vercel project. Set `DATABASE_URL`, `AUTH_SECRET`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT`, and `S3_FORCE_PATH_STYLE` using the existing CRM settings. Use Supabase's transaction pooler for Vercel.

The build creates only the separate `closing_desk` schema. Existing CRM tables are not changed. Sign-in uses existing `public.users` accounts and password hashes. New document keys use `closing-desk/<user-id>/` in the existing private bucket. Queries are scoped by authenticated user ID; authentication is checked in each API route. No credentials belong in source control.

## Mileage

Log mileage from a showing, contact, transaction, or activity. Mileage supports a typed record picker, standalone meeting/training descriptions, editable links, per-record totals, and CSV exports. Activity records support meetings and training. Server-side validation rejects missing, mismatched, or cross-account attachment IDs.

## Verification and current limits

Run `npm run typecheck` and `npm run build`. Real sign-in, database persistence, and document storage must be verified after connection settings are added. Do not switch the custom domain until those checks pass.

Files are limited to 4 MB for Vercel server uploads. Existing data has not been imported. Automated provider sync, push reminders, PDF extraction, and automatic contract reconciliation are not implemented. Contract deadline planning is manual with explicit confirmation.

The Sites deployment is a separate published application. This branch targets Vercel only.
