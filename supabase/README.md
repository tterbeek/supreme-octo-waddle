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

The following is the **historical Polar rollout**, not the pending-migration
list for Companion. Use the [Companion production rollout](#companion-production-rollout)
below when publishing this feature.

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

The verifier now uses the separate `movenotes-schema-check` project and ports
55321–55329, so it does not reset the regular development stack. SQL behavior
checks in `tests/` run transactionally against that disposable database.

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

## Weekly Companion

Weekly Companion is labelled **Premium** in Settings. Initial access is limited
to the confirmed Supabase Auth account `me@thijsterbeek.com`, using the same
database rule in development and production. Other accounts see a greyed-out
row. The migration `20261017010000_companion_premium_access.sql` also enforces
this through database policies, generation/publish checks and the Edge Function;
editable profile metadata cannot grant access. The allowed account can opt in
using the normal settings switches; eligibility does not automatically opt it in.

Apply the weekly Companion and Premium-access migrations to the **local** database before
testing this feature (use `npx supabase migration up --local` with the local
stack running; do not reset a development database containing useful test data).
The migration adds private preferences and weekly posts, owner-only access,
server-only generation claims, and a client-writable response field.

In the existing ignored `supabase/functions/.env`, add the server-side
`OPENAI_API_KEY` and optional `COMPANION_MODEL` (default `gpt-6-luna`). The
example file in `functions/.env.example` contains only placeholders; preserve
any existing Polar configuration. Start the local function with:

```bash
npx supabase functions serve weekly-companion --env-file supabase/functions/.env
```

In the app, open **Settings → Weekly Companion** and opt in. Activity-note use
is a separate switch, also off by default. Enabling Companion sends current
Directions, the current Tiny Tweak, the last Tiny Tweak reflection, and previous
week's activity details to OpenAI. Activity notes are queried and included only
with their own permission. Email, account identifiers, photos, locations,
Circle data, and the user's response to the Companion post are not sent.

The first Journal visit after a week completes prepares one post for the
previous Monday–Sunday in the timezone saved with the preferences. Generation
is requested on Journal entry/return; there is no background schedule. It does
not backfill missed weeks. The post is a short thought and optional question;
the prompt excludes weekly recaps and target summaries. **What it used** holds
the supporting records as a snapshot; later edits to records do not rewrite an
already published thought. Large inputs are bounded to 200 activities, 30
Directions, 1,000 characters per activity note, and a shared 20,000-character
activity-note budget. Excerpts/omissions are labelled in provenance.

The provider uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text)
with `store: false`; this is not a claim of zero provider retention. The API key
is used only inside the Edge Function. No live AI request is needed for unit or
schema checks. Prompt/output quality still needs a review with an enabled
development account and configured server secret.

The default model is [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
using `reasoning.effort: "none"` for these short weekly posts. An existing
`COMPANION_MODEL` environment variable overrides the code default. To switch an
existing setup, set it to `gpt-6-luna` in the local function `.env` and in the
production Supabase Edge Function secrets, then restart the local function or
redeploy `weekly-companion`. This model change needs no SQL migration and
affects newly generated posts; existing weekly thoughts are kept.

The database enforces one post per user/week, reserves concurrent requests,
backs failures off for five minutes, and caps attempts at three per week. The
function independently validates the signed-in user even though gateway JWT
verification is disabled in its configuration. Clients cannot create or change
AI content; they can only update their own optional response.

Turning Companion off hides its posts without deleting responses. Turning
activity-note use off clears stored thoughts and provenance that used those
notes and cancels pending generation. Responses survive; the most recent
completed week's post can then be prepared without notes. Older affected posts
show a short removed-content notice with the person's response. Requests
already sent to the provider cannot be recalled. This permission applies to
activity notes; opt-in to Companion itself covers the last Tiny Tweak reflection.

## Companion production rollout

Run from the repository root. Publish the Supabase changes first, then the
frontend. These are rollout instructions; local development checks do not
execute them automatically.

### 1. Check the local changes

```bash
npm test
npm run build
npm run supabase:verify-local
```

The schema check uses a disposable database on separate ports. It does not
reset your regular development data or change the hosted project.

### 2. Select the production Supabase project and preview the migrations

Replace `your-production-project-ref` with the reference shown in your
production project's Supabase dashboard. Keep using the same terminal for the
commands that reference this variable. If the CLI asks you to log in, run
`npx supabase login` first.

```bash
COMPANION_PROD_REF="ljthydvstmbcgqdnqkvx"
npx supabase link --project-ref "$COMPANION_PROD_REF"
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

For a production project already running the baseline and Polar migrations,
the only pending migrations should be these, in order:

```text
20261017000000_weekly_companion.sql
20261017010000_companion_premium_access.sql
```

If one is already applied, only the remaining migration should be pending.
Stop if the baseline, Polar migration or an unrelated migration appears
unexpectedly; check the project reference and migration history before pushing.

### 3. Apply the migrations

After the dry run shows the expected pending Companion migration(s):

```bash
npx supabase db push --linked
npx supabase migration list --linked
```

Both Companion versions should now appear as applied remotely. Use the CLI
push so migration history stays consistent; do not also paste the SQL into
the dashboard. These migrations add Companion tables, policies and SQL helper
functions. The second restricts access to the confirmed account
`me@thijsterbeek.com`; the same rule applies in production and development.
The SQL helpers require no separate function-deploy command.

### 4. Set the server secret and deploy the Edge Function

In the **production Supabase project → Edge Functions → Secrets**, add:

| Secret | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `COMPANION_MODEL` | `gpt-6-luna` (also the code default; replace any older setting) |

The ignored local `supabase/functions/.env` is not uploaded automatically.
Set the production secret explicitly rather than uploading that whole file,
which may also contain development Polar credentials. Do not put this key in
Vercel or give it a `VITE_` prefix.

Deploy only the new Edge Function:

```bash
npx supabase functions deploy weekly-companion --project-ref "$COMPANION_PROD_REF"
```

Its imported `_shared/companion.ts` file is bundled with it. Existing Polar and
other Edge Functions do not need redeploying. The function's gateway setting
comes from `config.toml`; the handler checks the signed-in user and Premium
access before any AI call.

### 5. Publish the frontend through GitHub and Vercel

Review and commit the intended Companion changes directly on `main`, including
both migrations, the function and shared helper, `config.toml`, frontend files,
tests and documentation. Keep local `.env` files out of the commit. Then:

```bash
git push origin main
```

With the existing Vercel Git integration, that push starts the production
deployment. Wait for both GitHub Actions and Vercel to finish successfully.
Neither replaces the Supabase steps above. No additional Vercel environment
variable is required; retain the existing production Supabase URL and public key.

### 6. Check production

1. Sign in with the confirmed `me@thijsterbeek.com` account. In **Settings →
   Weekly Companion**, the **Premium** row should be enabled. The Companion
   and activity-note switches start off; enable Companion and choose whether
   activity notes may be used.
2. Open Journal. A thought for the previous completed Monday–Sunday should
   appear after generation; you do not need to wait another week. It should
   start with the thought, rather than a recap of activity totals.
3. Open **What it used**, add your own reflection, and reload to confirm it
   persists. Leaving the thought unanswered should also work.
4. Check another account: the Premium row should be greyed out and no Companion
   post should appear.

If your own row is locked, check the account's exact confirmed email in
Supabase Auth and that both migrations reached the same project used by Vercel.
If generation fails, check that `weekly-companion` and `OPENAI_API_KEY` exist
in that project. Failed generation retries wait five minutes and are capped
at three attempts per week; repeated refreshes do not bypass that limit.

There is no background schedule: subsequent weekly thoughts are prepared on
the next Journal visit after a week completes. If you need to pause the feature,
switch Companion off in Settings; posts are hidden and your responses remain
stored. Keep the additive schema in place rather than dropping its tables.
