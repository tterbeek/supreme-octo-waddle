# Supabase development workflow

The production database currently contains the authoritative schema in
`remote-schema-baseline.sql`. The numbered files in `migrations/` are later
incremental migrations and do not include the original core schema.

For local validation, run:

```bash
npm run supabase:verify-local
```

This command creates a temporary Supabase project directory, copies the
baseline into that directory as its only migration, starts a local Docker
stack, and resets the local database from scratch. The temporary project is
removed and the local stack is stopped when the command finishes.

The script intentionally does not run `supabase db push`, `supabase db pull`,
or any command that targets the linked hosted project.

Do not place `remote-schema-baseline.sql` inside the normal `migrations/`
directory yet. Doing so would make it appear to be a new production migration
until the hosted migration history has been deliberately reconciled.
