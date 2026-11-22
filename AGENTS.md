# Working agreement

- For this small app, make routine development changes directly on `main`.
- Do not create a feature branch or pull request unless the user explicitly asks for one.
- Keep proportionate checks (tests, build, and local schema verification when relevant), but avoid process overhead that does not add value.
- Do not push to or deploy production without the user's explicit request.

## Mobile architecture — owner clarification

- Use Capacitor to package the existing PWA for Android and, later, iOS.
- The existing PWA remains the single UI codebase. Do not create an Expo/React Native app or a separate mobile UI to maintain.
- This decision supersedes the Expo/React Native default suggested in MOVENOTES_ANDROID_HANDOVER.md. The discarded separate mobile workspace has been removed.
- Do not start iOS implementation until explicitly requested.

MoveNotes repository instructions
Mission
Build and verify the Android version of MoveNotes against the existing web app and backend. Read [MOVENOTES_ANDROID_HANDOVER.md](MOVENOTES_ANDROID_HANDOVER.md) for delivery scope, acceptance checks, and the definition of done. Keep iOS viable through reusable code within the new mobile workspace and clear platform boundaries. Start iOS implementation only when explicitly requested.
Product rules
- MoveNotes is a private, low-pressure movement journal. Make it easy to capture movement, optionally add how it felt, and revisit the memory later.
- Save an activity before offering a reflection. Skipping or dismissing the reflection preserves the activity. Keep standalone journal entries distinct from activity reflections.
- Respect each activity type’s chosen primary metric. Keep the journal and maps quiet. Offer trends and targets in their own views.
- Keep notes and reflections private. Share only fields and photos explicitly included in the user-approved summary. Preserve backend authorization and check account isolation.
- Match the app’s established terminology, preference behavior, and visual identity. Use accessible Android controls and predictable Back, keyboard, and dismissal behavior.
Protect the current PWA
- Confine implementation and tooling changes to a dedicated mobile workspace. Treat the existing PWA, existing shared code, web build and deployment configuration, and existing backend source and configuration as read-only. Leave the PWA manifest, service worker, web assets, existing dependency and lock files, and web CI untouched.
- Read the existing implementation as a reference. Reuse stable APIs and existing code as-is where practical. Put any Android-specific adapters, dependencies, and fixtures in the mobile workspace. Use authorized staging accounts for test writes through existing APIs.
- If a feature needs a PWA or backend change, record the blocker and seek explicit approval for the specific change. Continue independent Android work while that decision is pending.
- Record the initial working tree and verify the final diff, including new files, against that baseline. Confirm that the run changed only the mobile workspace and any explicitly authorized files.
Working in this repository
- Read applicable repository instructions and check the branch, working tree, and baseline checks before editing. Preserve user changes. If these instructions are being added to a repository with an existing root AGENTS.md, merge them with its project-specific guidance.
- Use the existing code, schema, auth, and server functions as the source of truth for behavior. Check how each feature is exposed in the current app and preserve compatibility with existing API contracts.
- Use the established mobile stack if it can support the handover. Otherwise assess the repository using the handover’s architecture guidance, record the choice, and make the first end-to-end slice buildable before expanding it.
- Work in complete slices through the normal app entry points. Run relevant checks after each slice, fix failures you introduce, and record any observed baseline failures. Use focused regression tests for privacy, import identity, and other tricky behavior.
- Keep secrets out of source, build artifacts, logs, screenshots, and handoff notes. Use documented environment configuration and test or staging data. Preserve unrelated code and avoid broad cleanup.
Run to completion
- Maintain a short Android completion checklist in the repository during implementation. Record verified slices, commands and results, artifact location, open dependencies, and the next actionable step. Update it when a slice lands or a blocker changes.
- Proceed through routine implementation decisions, recoverable build failures, and independent slices without waiting for approval. When a dependency blocks one check, use safe local verification where possible and continue the remaining work.
- Pause for a decision only when it materially changes the agreed scope, requires unavailable access, or involves an irreversible action. Get explicit authorization before deploying to production, changing live data or auth configuration, publishing to a store, or using release signing credentials.
- Check every handover criterion before reporting completion. Record the exact device or emulator, build variant, and backend used for each runtime check. If the run ends early, leave reproducible commands and the next action in the checklist so another run can resume.
- Keep build, live integration, and release status explicit. Report what passed, what remains blocked, and the deliverable’s exact path. Use the evidence thresholds in the handover.
