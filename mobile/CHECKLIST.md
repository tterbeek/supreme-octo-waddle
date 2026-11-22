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
