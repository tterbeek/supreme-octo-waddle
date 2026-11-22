# Capacitor Android checklist

- [x] Read instructions; owner requires the existing PWA as the only UI.
- [x] Record initial dirty tree and protected-file hashes. Work on main; no production deployment.
- [x] Install independent Capacitor tooling and create Android shell.
- [x] Bundle existing index.html/src/public directly; no copied screens or parallel UI.
- [x] Native Back, resume, sharing and service-worker adapters; document redirect limits.
- [x] Build debug APK; install on running emulator and verify real PWA UI.
- [x] Local verified-session bootstrap, actual Quick Log/API persistence, Back guard, reflection skip, restart, native share image and native picker cancellation. Limits documented.
- [x] Existing tests/typecheck/build and final protected-file comparison.
- [x] Deliver final APK, checksum, README.md and VERIFICATION.md. iOS deferred.

No staging is available. Do not read/write production data. Default Android build uses local Supabase (emulator host10.0.2.2); real native provider redirects require owner-approved configuration.

Observed on emulator-5554 (Android17/API37): actual PWA rendering/login, local verified-session bootstrap, Quick Log save with original metric validation, Android Back unsaved guard, optional reflection skip, process restart/session/activity persistence, PWA-generated image in native share sheet. No message sent. Local OTP template is link-only; interactive code entry not verified. No staging/provider authorization available.

Next: owner review of the existing PWA in the installed app. For live provider/email redirect work, obtain explicit configuration approval. Continue remaining acceptance checks listed in VERIFICATION.md; no staging is available.

## Production Journal compatibility follow-up (2026-11-22)

- Confirmed by a read-only production schema query: `cycling_mode_override` is absent; the old APK's enrichment request failed and suppressed imported rows/pagination.
- Removed that field from shared Journal/calendar reads, activity writes/types and bike-resolution logic. Equipment/import classification remains; historical migrations are preserved, with a new cleanup migration.
- Web build and314 tests pass. Regression test verifies the Journal request excludes the obsolete column and preserves imported rows.
- Production APK has not been rebuilt/reinstalled for this cleanup; no emulator was connected during diagnosis. The currently installed previous APK still needs replacement.
- Pending Dance changes also remain in the working tree and require their migration before using Dance against production. No production writes/migrations/deployments were performed by this follow-up.
