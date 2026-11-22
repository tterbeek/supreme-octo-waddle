# MoveNotes Android build handover

## Start the run

Place this file and `AGENTS.md` at the root of the MoveNotes source checkout. If the repository already has a root `AGENTS.md`, merge the supplied guidance into it so existing project instructions stay in effect. Open that checkout in Codex and give it this prompt.

> Implement the Android version of MoveNotes. Read the root AGENTS.md and MOVENOTES_ANDROID_HANDOVER.md. Use the current PWA and backend as read-only references. Build, test, and package Android in a dedicated mobile workspace through the acceptance checks. Ask before any change to existing PWA, shared, or backend files or configuration. Continue through every slice you can complete, fixing recoverable failures and keeping a resumable checklist. Produce an installable APK, reproducible build instructions, and a verification report. Verify live integrations with authorized staging access when available. Keep iOS for a later run. Ask me only for a dependency you cannot obtain, a material scope decision, or authorization for an irreversible action.

Give Codex the existing MoveNotes checkout, including the backend functions and migrations if they live separately. Provide a staging environment and test accounts for live checks if available. For Polar and Circle, useful fixtures are a test Polar account with a completed workout and two MoveNotes test users. Supply configuration through the established environment mechanism.

## Outcome and scope

Deliver an Android app that works with the existing MoveNotes accounts and data. A person should be able to capture movement with little effort, add personal context when they feel like it, and find that memory again. Make a reproducible test build and verify it on Android. Treat signing and publishing as separate, owner-authorized release work.

Keep the existing PWA and backend unchanged. Use a dedicated mobile workspace with its own dependencies and build configuration as needed. Leave existing web and shared source, dependency and lock files, manifest, service worker, CI, and deployment settings untouched. Test writes may go through existing APIs against authorized staging accounts. If a backend change or new redirect configuration is needed, describe the smallest change requiring approval and keep working on other Android features.

Use the current repository to confirm feature scope. The project notes describe the flows below, but the checkout and deployed staging behavior may be newer. Record any meaningful discrepancy and follow working behavior where it fits the product rules. If a repository path has moved, locate its replacement.

| Area | Reference starting points |
| --- | --- |
| Onboarding and quick log | `src/components/OnboardingWizard.tsx`, `src/features/activities/AddActivityForm.tsx`, `src/hooks/useQuickLogForm.tsx` |
| Reflection and activities | `src/components/PostLogNoteFlow.tsx`, `src/services/quickLog.service.ts` |
| Polar | `src/pages/ConnectionsPage.tsx`, `supabase/functions/polar-import-activities/index.ts` |
| Journal and memories | `src/pages/Home.tsx`, `src/pages/CalendarPage.tsx`, `src/pages/PhotosPage.tsx` |
| Directions and Tiny Tweaks | `src/pages/StatsRpcPage.tsx`, `src/components/TinyTweakStrip.tsx` |
| Gentle Circle | `src/pages/CirclePage.tsx` and Journal sharing controls |

Keep experimental, paused, and planned work at its current availability. Verify whether Companion, WhatsApp summary sharing, Polar defaults, and import naming are already implemented and released in the checkout. Carry enabled behavior across when it belongs to the user-facing app. Leave unshipped behavior for its own task, and record where it stands. Preserve the current Circle behavior where copy and implementation disagree, and honor the privacy promise for personal notes.

## Architecture and build order

1. **Establish the baseline.** Inspect repository layout, mobile work, CI, documented build commands, auth and redirect flows, schema, storage, integrations, and feature flags. Run the documented baseline checks. Map confirmed features to Android screens and list prerequisites for live testing.
2. **Choose the smallest fit for Android and later iOS.** Extend an existing viable mobile project when present. If the checkout has only the TypeScript web app, evaluate Expo with React Native as the default. Compare it with any maintained hybrid approach already present in the repo. Base the choice on code reuse, reliable auth redirects, photos, maps, native sharing, and reproducible Android builds. Record the decision and use an isolated mobile directory, following any existing mobile convention that preserves this boundary.
3. **Build the first complete slice.** Start the Android app, use the existing auth and session lifecycle, open the Journal, save a real test activity, and reopen it after app restart. Prove the build, navigation, and data path before expanding the feature set. Confirm that an entry created on one client is visible on the other with the same staging account.
4. **Complete the journal and integrations.** Build onboarding, quick log and reflection, calendar and photos, Directions and Tiny Tweaks, Polar, and Circle in complete slices. Reuse compatible domain rules, types, validation, backend contracts, and brand assets as-is. Keep any Android-specific adaptations inside the mobile workspace. Record any dependency on a shared or backend change as blocked pending approval.
5. **Harden and package.** Exercise failures and lifecycle changes on Android, run the project’s type, lint, test, and build checks, and run the available PWA baseline checks in a way that leaves its source and configuration untouched. Build the test APK from a clean checkout or equivalent clean build environment and install that same artifact for the final smoke test. Document local and CI steps and the Android SDK, JDK, and build prerequisites actually used.

Keep auth callbacks, secure session storage, photo picking, maps, and sharing behind narrow platform boundaries where there is a practical need. Reuse the repository’s managed toolchain and dependency conventions. Confirm the application ID from project configuration or the owner before a release build. An explicitly documented development ID can unblock a test APK.

## Android acceptance checks

| Flow | What to verify |
| --- | --- |
| Account and onboarding | Sign in with supported methods, recover the session after app restart, and sign out cleanly. Confirm that switching accounts exposes only the current user’s data. Onboarding can be skipped and preserves activity type, equipment, and primary metric choices when completed. |
| Quick Log and activity detail | Save with the expected metric and validate date, title, effort, feelings, equipment, and presets where available. Verify that skipping reflection keeps the saved entry. Edit and delete through the normal UI and test undo. Retrying a save after an interrupted response must avoid duplicate activities. |
| Reflection and photos | Add and edit a private note and attach up to five photos, following the current limit. Test picker cancellation, denied access where relevant, and a failed or interrupted upload. The saved activity survives reflection and upload failures. |
| Journal and memories | Verify one chronological feed with activities and standalone writing, calendar navigation by day, and photo gallery links back to the source entry. Test empty states, existing records, local dates, and optional metrics or maps. |
| Directions and Tiny Tweaks | Verify current target types and periods, distance or duration trends, and the Tiny Tweak eligibility, reflection, and renewal paths. Keep the app’s existing progress language and low-pressure defaults. |
| Polar | Verify connection and callback on Android, manual sync, and the app-open sync behavior present in the checkout. Confirm sport mapping, external-ID deduplication, and that “Add details” edits the imported activity. Test deletion followed by sync so a deleted import stays deleted and undo restores it, using the existing deletion behavior. If the backend reimports deleted activities, document the failing check and the required backend change for approval. Test disconnect, expired authorization, and retry. |
| Gentle Circle | With two test accounts, verify invitation or existing connection, explicit sharing, and unsharing. Check reactions if enabled. Check user-facing payloads and backend permissions for note and reflection privacy, including direct access from a different account. |
| Enabled external sharing | If shipped, open the Android share sheet with the selected activity summary. Verify branding and `https://movenotes.app` when the current contract calls for them. Inspect the actual output for private notes, photos outside the selected share, and any extra data. |
| Android controls | Test startup, resume, system Back, keyboard overlap, accessible labels, larger text, and a small screen. Use consistent form presentation and dismissal. Try saving with a slow or failed connection and preserve input for retry where the app supports it. |

Use authorized staging for live auth, cross-client data, Polar, and multi-account privacy checks. Use fixtures or a local backend to exercise failure paths and keep development moving when services are unavailable. Record the environment used and the observed result for each check.

## Definition of done

- **Android build delivered.** Source and setup instructions are in the checkout. The app builds reproducibly into an installable APK. Install that APK on a device or emulator from the supported range and run a smoke test covering launch, sign-in via the available test environment, Journal, activity save, restart, and reopen. Provide the exact APK path and the commands to rebuild it.
- **Feature verification complete.** Every in-scope row has an observed result, or a documented reason it is genuinely inapplicable. Record which checks used an emulator or device and whether they used fixtures, a local backend, or staging. A fixture pass is evidence for that test environment. If a required live check is unavailable, keep it open with the missing dependency and the exact retest procedure. Mark the build and feature verification statuses separately.
- **Regression checks complete.** Run the relevant Android and web checks. Compare the final working tree with the starting state and confirm that existing PWA, shared, and backend files have no changes from this run unless specifically authorized. Record any reproducible baseline failures and fix regressions introduced by the change. Include the test environment and limitations in the final report.
- **Handoff is resumable.** Leave a compact checklist with the verified scope, architecture decision, commands and results, artifact location, known issues, and unresolved setup. When a blocker prevents completion, finish all independent work before reporting the precise action or access needed.
- **Release status is explicit.** A test APK is sufficient for this handover. If store distribution is requested later, verify current Play requirements, confirm app identity and signing through the owner’s process, create the release bundle, and publish only with authorization.

## Later iOS run

Carry forward the chosen architecture, backend contracts, feature checks, and Android verification report. Start the iOS build as its own task with access to an Apple build environment and the appropriate test configuration. Verify Apple-side redirect and session handling, native permissions and pickers, sharing, navigation, and accessibility on iOS. Use the same staging data and privacy checks where practical. Treat TestFlight or App Store distribution as an authorized release step.
