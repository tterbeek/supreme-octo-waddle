# Legacy migrations

These migrations were previously committed as the project's migration history,
but they do not form a replayable history from an empty database. They depend on
an older foundational schema that was not present in the repository.

They are retained for audit and reference only. Do not add them back to the
active `supabase/migrations/` directory or apply them to a hosted project.
The active migration path starts with
`../migrations/00000000000000_production_baseline.sql`.
