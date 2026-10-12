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

Production migration history was checked in the Supabase SQL Editor on
2026-10-12. At that point it contained only
`00000000000000_production_baseline`; the baseline is already marked applied,
and the Polar migration is not. This is a history check, not proof that an
arbitrary linked project is safe to push to. Before promoting a migration,
confirm that the CLI is linked to the intended project, then run:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

For the Polar rollout, the dry run must show **only**
`20261012000000_imported_activity_enrichment.sql`. If it proposes the baseline
or any unexpected migration, stop and investigate; never apply the baseline to
production. Once the expected migration is the only pending one, run:

```bash
npx supabase db push --linked
npx supabase migration list --linked
```

The final list should show both migrations on the remote. Use the CLI push so
the schema change and its migration-history entry stay together. Do not apply
the SQL separately in the dashboard and then push it again.

Future migrations should be created with timestamps later than the baseline and
should be validated with `npm run supabase:verify-local` before review.

Local storage is configured with the application's `actvity-notes` bucket in
`config.toml`. The local `seed.sql` file adds owner-only storage policies so
authenticated development users can upload, read, update, and delete their own
test images. These seed policies are not applied to hosted projects.

## Polar integration (local/dev setup)

The Polar callback URL is `<app origin>/settings/polar/callback`. Register the
exact URL for each environment in the Polar developer console. The browser
needs `VITE_POLAR_CLIENT_ID`; the Supabase Edge Functions need
`POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, and `POLAR_REDIRECT_URI` (the same
exact callback URL). Never put the client secret in a `VITE_` variable.

The app requests `training_sessions:read` and `sports:read`. Deploy the
`polar-exchange-token`, `polar-import-activities`, and `polar-connection` Edge
Functions to the **development project** after applying
`20261012000000_imported_activity_enrichment.sql` there. For production,
follow the migration-history check and dry-run procedure above before applying
the Polar migration.

Sync runs on successful connection and, while the app is open, on Journal or
Calendar entry and every 30 minutes when stale. A server-side schedule is not
configured, so workouts recorded while the app is closed appear when it next
opens. Imports cover up to the latest 90 days; repeats are ignored by the
existing `(external_source, external_id)` unique index. Disconnecting removes
stored Polar tokens but preserves imported activities; revoke app consent in
Polar Flow separately if desired.
