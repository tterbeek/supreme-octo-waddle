# Supabase development workflow

The production database schema has been captured as the first active migration:
`migrations/00000000000000_production_baseline.sql`. It is the starting point
for all future local development migrations.

The previous migration files are retained in `migrations-legacy/` for audit and
reference only. They are not part of the active replay path because they cannot
be applied cleanly to an empty database without the missing historical base
schema.

For local validation, run:

```bash
npm run supabase:verify-local
```

This command creates a temporary Supabase project directory, copies the active
migrations into it, starts a local Docker stack, and resets the local database
from scratch. The temporary project is removed and the local stack is stopped
when the command finishes.

The script intentionally does not run `supabase db push`, `supabase db pull`,
or any command that targets the linked hosted project.

Do not run `supabase db push` against the linked production project yet. The
hosted migration history still needs to be deliberately reconciled with this
baseline; the baseline belongs in the repository for local replay, but must not
be treated as an unapplied production change automatically.

Future migrations should be created with timestamps later than the baseline and
should be validated with `npm run supabase:verify-local` before review.

Local storage is configured with the application's `actvity-notes` bucket in
`config.toml`. The local `seed.sql` file adds owner-only storage policies so
authenticated development users can upload, read, update, and delete their own
test images. These seed policies are not applied to hosted projects.
