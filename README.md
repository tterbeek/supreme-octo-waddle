# MoveNotes

## Local development

Start local Supabase with `npx supabase start`, then run `npm run dev`.
This starts Vite and the local Edge Functions together, using
`supabase/functions/.env`, so profile pictures and challenge covers can load.
Stop any separately running `supabase functions serve` command first.
Ctrl+C stops both development processes without resetting Supabase data.
Vite options still work, for example `npm run dev -- --host 127.0.0.1`.

## Circle and closed Communities

The new canonical sharing experience is implemented behind an off-by-default
frontend and database flag. It preserves existing Circle connections and Journal
records. It adds per-audience sharing rules, explicit shared notes/photos,
QR-only Community invitations, one conversation per activity and Community-wide challenges.
See [behavior, local setup, rollout and verification](docs/circles-communities.md).
This change requires a migration and the new `social-media` Edge Function before
enabling the frontend; pushing the frontend alone does not enable it.

Production release order (on `main`):

1. Run `npm test`, `npm run build`, and `npm run supabase:verify-local`.
2. Run `npx supabase db push --linked --dry-run`; expect the nine migrations
   from `20261025000000` through `20261027020000`. Apply with
   `npx supabase db push --linked` once the pending list matches.
3. Deploy `npx supabase functions deploy social-media --project-ref ljthydvstmbcgqdnqkvx --use-api`.
4. Set `VITE_SOCIAL_V2_ENABLED=true` in Vercel's Production environment.
5. Commit and push `main` to deploy the frontend. After deployment succeeds, run
   `update public.social_config set enabled=true where singleton;` in the
   production Supabase SQL Editor, then refresh the app.
6. Check sharing, a community invitation, photos, comments and challenge progress.

The new profile settings, Settings icons and Memories layout ship with this
frontend release. Photo priority and persistent community invites are included
in the migrations. No new production secrets are required. To roll back sharing,
disable `social_config.enabled` and redeploy with the frontend flag off; retain
the schema and user data.

## Memories

Memories offers a private Timeline, Calendar and Photos with a dedicated activity
reader and a daily, dismissible moment to revisit. See [Memories V1](docs/memories-v1.md)
for behavior, the required migration, local checks and verification limits.

## Weekly thought feedback

Weekly thoughts offer **Yes / Not really**, an optional 300-character comment,
and **Edit / Remove feedback**. Ratings save immediately; comments save only
with **Save feedback**. This stays separate from journal reflections and never
regenerates the current thought. The next generated thought can use up to three
recent comments, not bare ratings. See [feedback behavior and checks](docs/ai-feedback.md).

The AI card also has a three-dot **Delete** action. The confirmed owner account
`me@thijsterbeek.com` can use **Admin → Run weekly now** to explicitly rerun the
most recent completed week. It asks before making a paid call and keeps your
written reflection when replacing a thought.

Rollout requires `20261018000000_companion_feedback.sql` and
`20261018010000_companion_manual_and_delete.sql`, and the corrective
`20261018020000_companion_manual_context_fix.sql`, redeploying the existing
`weekly-companion` function, and publishing the frontend in that order. No new
secrets, settings, or Edge Functions are needed.

## Form layouts and regression checks

See the [complete form inventory, shared rules and verification limits](docs/form-consistency.md).
This consistency pass is frontend-only; no Supabase migration or deployment is
required. Work is kept local until explicitly committed/pushed.

## Share an activity as an image

Use **Activity actions → Share → Share other** in the Journal.
Preview an optional photo, then share or save a branded PNG.
Personal notes stay private; Circle visibility is unchanged.

This feature is frontend-only: no Supabase migrations, functions or secrets to
deploy. See [implementation notes and device checks](docs/activity-sharing.md).

## Publish Weekly Companion to production

Follow the [Companion production rollout](supabase/README.md#companion-production-rollout)
for the commands and expected migration list. Run these steps from the repository
root, in this order:

1. Run the tests, build and isolated local schema check.
2. Link the CLI to the production Supabase project and dry-run the migration push.
3. Apply the two pending Companion migrations, which also install the SQL helpers
   and Premium access rules.
4. Add `OPENAI_API_KEY` in the production project's Edge Function secrets and
   deploy only the `weekly-companion` Edge Function.
5. Commit the reviewed changes directly on `main`, then push `main` to trigger
   Vercel. Complete the Supabase steps **before** this push.
6. Sign in as the confirmed account `me@thijsterbeek.com`, enable Companion in
   Settings, and check the weekly thought and optional response. Other accounts
   should see a greyed-out **Premium** row.

There is no new Vercel environment variable for Companion. The OpenAI key stays
in Supabase secrets. GitHub/Vercel deployment does not apply the SQL migrations
or deploy the Edge Function for you.

Companion uses GPT-6 Luna (`gpt-6-luna`). Set `COMPANION_MODEL=gpt-6-luna`
in the function's local environment and production Supabase secrets if replacing
an older model setting.

## Frontend tooling

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Stats page using Supabase stored procedures

- Default stats route `/stats` now uses the Supabase RPC-backed page.
- Legacy client-side stats remain available at `/stats-legacy` (not linked in the sidebar). `/stats-rpc` is an alias to the new default.
- Expected procedures:
  - `stats_goal_progress(user_id uuid)` → rows with `goal_id, name, activity_type (run|ride|any), metric (distance|count), period (week|month|year), target, current_value, unit (km|activities), progress_ratio (0-1), comparison_pct`.
  - `stats_trends_90_days(user_id uuid)` → rows with `activity_type (run|ride), total_distance, weekly_avg_distance, trend_pct (vs previous 90 days), avg_feeling`.
- The page will show loading/error states if these RPCs are missing or fail; make sure to create them in Supabase before using the route.

## Home page using Supabase goal stats

- Default home `/` now uses the `stats_goal_progress` RPC for the top goals section (rest of the feed/quick-log behavior is unchanged).
- Legacy client-side home remains available at `/home-legacy` (not linked in the sidebar). `/home-rpc` is an alias to the new default.
