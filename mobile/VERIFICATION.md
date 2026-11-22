# Capacitor Android verification

18 November 2026. Architecture: **the actual existing MoveNotes PWA bundled by Capacitor**, not a recreated UI. No React Native/Expo application or copied React screens exist here.

## Artifact and environment

- APK: `artifacts/MoveNotes-capacitor-debug.apk`; checksum in `artifacts/SHA256SUMS` and `verification/final-apk-results.json`.
- Development ID `app.movenotes.android.dev`, standard Android debug signing. Android project only; iOS deferred.
- Capacitor8.6.2, Node24, full Temurin JDK21, Gradle8.14.3, compile/targetSDK36, minSDK24.
- Installed and exercised on **emulator-5554, sdk_gphone16k_x86_64, Android17/API37**.
- Backend: existing **local Supabase**, accessed by the emulator through10.0.2.2. Only fictional local test accounts/activities. No production writes, migration, deployment, branch, PR or store signing.
- Final APK installed and reopened with the existing local session/activity intact. It contains the PWA assets and does not need a running web dev server to render. Local Supabase still needs to run for data.

## Passed

| Check | Evidence |
| --- | --- |
| Same PWA UI | Original landing/login/logo, Journal, Add/type chooser, Quick Log, form validation, optional reflection and share-image UI render in native WebView. Native screenshots under verification/. The native build reads root index.html/src/public directly. |
| Native origin/assets | Capacitor reports Android; WebView is https://localhost and secure; no service worker registered. Bundled assets/styles present. |
| Local data/auth path | Own local signup confirmation mail verified through existing Supabase APIs. Resulting session bootstrapped through debug CDP; unchanged PWA auth accepts it and loads real local data. No token/credential written to reports. |
| Native Back/unsaved changes | Editing the original Quick Log and pressing Android Back shows its existing discard guard; Keep editing retains input. No substitute native form. |
| Original metric validation | The existing missing-primary-metric prompt appears when duration is omitted; supplying duration permits saving. |
| Activity creation | Original Quick Log creates exactly one database record for Capacitor local walk. Verified independently through existing local Supabase API. |
| Optional reflection | Done without a reflection leaves the created activity in Journal. |
| Restart/update | Force-stop/relaunch and final APK installation preserve session and activity; actual Journal reappears. |
| Native sharing | Existing PWA activity-image renderer generates the branded image; adapter opens Android image-sharing sheet. Preview visually inspected: original title/date/duration/MoveNotes logo/movenotes.app. No message sent. |
| Native photo chooser | Existing Choose photos opens Android PhotopickerGetContentActivity. Back cancels and returns to existing optional reflection. Skipping keeps saved activity. No alternate photo UI. |
| Regression | Existing **312 tests/44 files pass**; existing PWA TypeScript check passes. Caches/type-build metadata are under mobile/. Native adapter typecheck and two focused route/file-policy tests pass. |
| File boundary | `node mobile/scripts/check-boundary.mjs`: changed=[], added=[] outside mobile/ compared with initial recorded baseline, including existing dirty user files. Root packages/lock/config/assets/manifest/service-worker/CI/backend unchanged. |

Results: `android-results.json`, `pwa-save-results.json`, `pwa-restart-results.json`, `pwa-picker-results.json`, `final-apk-results.json`, `boundary-results.json` under verification/. Detailed local build logs are ignored by Git.

Screenshots are **actual Android emulator screenshots**: android-login.png, android-journal.png, android-share.png, android-photo-picker.png, android-final-journal.png. Earlier native tests used the first wrapper build; the final APK adds launch branding/invite-origin handling and was reinstalled/reopened with session/activity verified. The screenshot and results identify their scope; this is not blanket certification of every PWA screen.

## Remaining checks and setup

- **Interactive OTP entry was not verified.** The unchanged local Supabase default email contains a confirmation link, while the unchanged PWA expects an OTP. QA verified its own local mail token and bootstrapped the debug WebView session; no auth setting/template was changed. An OTP-bearing local template is needed for manual code entry. No staging exists and production OTP was not tested.
- **Fresh Polar/Strava connection and email-change callbacks are not ready for native use.** Existing PWA services derive redirects from window.location.origin (https://localhost inside Capacitor); Polar's backend validates its exact configured web callback. Owner-approved native redirects/provider registration and the minimal backend allowlist support are still needed. The guarded custom-scheme receiver alone does not solve that setup. No live provider, expired-token, deletion/resync or webhook behavior was tested.
- Five-photo selection/retry, map interaction, account switching, Tiny Tweak review/renewal, companion entitlement, two-user social/revocation, date/keyboard/font-scale/TalkBack/rotation and Android versions below37 remain device acceptance checks. Their implementation is the original PWA, not replaced native logic. File-picker cancellation and basic form Back are the observed native passes.
- Share-image with selected photos/maps, hide-start/finish, file download/export and external-recipient delivery need native testing. Only a no-photo image opening the native chooser was observed. No message was sent.
- This is a debug/development build, not store-ready: release identity/signing, debug WebView inspection policy, hosted redirect configuration, privacy/store requirements and broader device checks require a separate release pass.

Fictional local auth users and the test activities remain for inspection; nothing was written to a hosted Supabase project. See README.md for rebuild/install/environment steps and CHECKLIST.md for resumption.

## Native media follow-up

See MEDIA.md and MEDIA_CHECKLIST.md. GPS/no-GPS/system camera/OS denial/Photos only
all passed actual local uploads using existing PWA forms. Earlier wrapper-only
photo limitations above are superseded by these scoped checks. Eight focused JS
tests and two Java media policy tests pass; PWA regression312/44 passes. A90-second
native picker cancellation retains the app with the exact-version compatibility
guard. Local image rendering required a wrapper-only HTTP-to-blob bridge.

Image display follow-up: all eight persisted Journal photos have nonzero natural dimensions after the local HTTP bridge (including portrait camera capture). The bridge restricts requests to emulator storage image paths; a focused URL-boundary regression test is included.
