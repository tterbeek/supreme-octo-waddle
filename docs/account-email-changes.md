# Login email changes and owner access

Settings → Profile → Login email → Change email opens the shared form layout.
The change uses `supabase.auth.updateUser({ email }, { emailRedirectTo })` for the
signed-in account, preserving its user ID. It does not create a replacement
account or copy activities, connections or Community memberships.

The sheet validates the new address, keeps drafts after errors, protects unsaved
edits, blocks duplicate submission and closes after an accepted request. The
Profile section shows the current Auth email and any server-reported pending
address separately. A request is not treated as a completed change. Confirmation
can be checked manually or refreshed when returning to the app; Auth events are
handled without awaiting another Auth call inside the SDK's event callback.
Resending uses Supabase's email-change resend operation and a UI cooldown.

Keep **Secure email change** enabled in Supabase's Email provider settings.
With that setting, users must follow the confirmations for both addresses.
The app does not disable or bypass confirmation. The dedicated public landing
page `/auth/email-change` supports completed, pending, expired, and partial
confirmation flows, including a first confirmation opened without a session.
The SDK processes its normal confirmation-link session. It never treats a
successful first confirmation as proof that the entire change is complete.

Supabase Auth remains authoritative. Profile reads its current email from Auth,
not the possibly stale `user_preferences.login_email` copy. The migration
`20261029000000_account_email_sync.sql` uses the existing sync function in an
Auth-email update trigger and reconciles existing cached addresses. A requested
`email_change` alone does not alter that copy. Confirmed email updates do not
change friendly names, profile photos, IDs or activity ownership.

## Owner identities

Companion access, manual generation, test-request storage and frontend admin
access now use these pinned IDs, not a mutable email or user-editable metadata:

| Account | User ID |
| --- | --- |
| Production | `589c83df-8ee7-4319-9203-5b5c9aae0d07` |
| Development | `7725b4a2-16df-47dd-bae0-c7695717a342` |

The dev ID was read from the existing local Auth account for
`me@thijsterbeek.com`. The shared helper is
`supabase/functions/_shared/accountAccess.ts`. The database migration
`20261029010000_owner_user_id_access.sql` pins the same identities in
`companion_account_allowed` and `admin_assert_owner`, protecting both direct
Companion requests/RLS and all existing admin reporting RPCs. Companion retains
its existing confirmed-email requirement. Receiving the old email address does
not transfer access to another account. The IDs are explicit owner allowlists;
no accounts are created or looked up dynamically by email at runtime.

## Local activation

Both new migrations have been applied to the existing local dev database,
without resetting data. The complete schema and SQL tests were also replayed
in the isolated verification project.

Local Auth redirect configuration now targets Vite on `127.0.0.1:5173` and
allows the callback on both that origin and `localhost:5173`. If the normal
stack was already running with the old configuration, restart it to pick up
these Auth settings, then restart the dev command as needed:

```bash
npx supabase stop
npx supabase start
npm run dev
```

These stop/start commands preserve local database volumes. Do not use db reset.
For future checkouts apply pending migrations with
`npx supabase migration up --local` while the stack is running.

Use Mailpit at `http://127.0.0.1:54324` for a manual confirmation check. Keep the
Change Email template's confirmation link (`{{ .ConfirmationURL }}`), even if
login/signup emails use OTP codes. Follow the local project's configured
confirmation behavior; if Auth is configured to apply a change immediately,
the UI shows the applied current address rather than inventing a pending state.

## Production release — not performed

1. Review `npx supabase db push --linked --dry-run`, then apply the two pending
   migrations with `npx supabase db push --linked`.
2. In Supabase Authentication → URL Configuration → Redirect URLs, allow
   `https://movenotes.app/auth/email-change` (or the actual frontend origin).
   If a suitable existing wildcard already covers it, no extra entry is needed.
   Keep Secure email change enabled and ensure the Change Email template includes
   its confirmation link. No SMTP credentials are changed by this work.
3. Redeploy the existing function so its manual/test-run guard also uses IDs:

   ```bash
   npx supabase functions deploy weekly-companion --project-ref ljthydvstmbcgqdnqkvx --use-api
   ```

4. Deploy the frontend using the normal main/Vercel flow.

No new Edge Function or environment secret is needed. Deploy SQL and the updated
function before relying on preserved access when changing the owner's email.
Production has not been modified or deployed by this work.

## Verification limits

Passed: 202 unit tests, production build, focused lint, full isolated migration
replay/SQL regressions, and 38 browser assertions with fictional Auth responses.
Checks cover validation/errors, pending/current addresses, draft preservation,
resend, partial/expired callbacks, mobile/desktop/enlarged text, both pinned
identities, and denial for another account holding the old email. The SQL tests
exercise actual RLS/admin RPCs and confirm email-cache synchronization without
changing activity ownership. Browser screenshots are under
`/tmp/movenotes-account-email-previews`.

Real confirmation email delivery and hosted-template/redirect configuration
still need a manual Mailpit/production check. No real login email was changed,
no confirmation email was sent by these fixtures, and no paid AI call was made.

References: [Supabase updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
