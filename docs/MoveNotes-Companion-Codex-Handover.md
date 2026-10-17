# MoveNotes Companion — standalone prototype handover

## Task

Build a working, interactive prototype of a thoughtful movement companion using the actual MoveNotes app's styles, components and look and feel. This is a product exploration for the owner to click through and understand what would change. It is not an implementation in MoveNotes.

Inspect the real repository as a read-only reference. Build in a separate sibling directory or separate repository, outside the MoveNotes application checkout. Do not modify the actual app, its configuration, dependencies, data or integrations. Do not add a feature flag, migration, production service, API endpoint or live AI adapter to MoveNotes.

The result should feel like the existing app with a few thoughtful additions, rather than a redesigned app or a presentation about AI. Provide a working local prototype with fictional data and simulated AI. Do not publish or deploy unless the owner separately asks.

## What the owner needs to understand

Make these changes tangible through working screens:

1. **Direction gets optional personal context.** Its existing count, distance or duration target remains. Someone can add why it matters and ask for one small experiment to try.
2. **Tiny Tweaks connect intention and experience.** A suggested draft can be edited, accepted, linked to a Direction and reviewed later.
3. **Reflection gets an occasional relevant question.** After an activity is already saved, the companion can help someone notice how an experiment felt.
4. **A due tweak review connects back to actual notes.** It helps the user keep, adjust or finish the experiment without judging target completion.

Include a comparison control so the owner can see the same screen with and without the companion additions. The ordinary app must remain recognizable and useful in both views.

## Product grounding

Read the supplied `Philosophy-of-MoveNotes-app.txt` and `How-stuff-functions-in-MoveNotes.txt` alongside this brief. They describe a private, low-pressure movement journal: remember how movement felt, log quickly, reflect optionally, revisit experiences, and choose gentle next steps. Personal notes remain private; Circle sharing is selective.

The sources are summaries, not a verified component or schema specification. Confirm the current implementation in the repository before reproducing its UI.

Important existing meanings:

- Direction supports activity count, distance or duration over a week, month or year. Do not replace it with a new coaching dashboard.
- A Tiny Tweak is a small experiment, with an existing review after sufficient time and activity. Preserve that concept and the familiar review interaction.
- Saving an activity precedes optional reflection. Skipping a note keeps the activity.
- Imported Polar activities already exist; adding details updates that activity.
- A Direction is optional. Tweaks and journaling work without one.

The proposed relationship is **Direction → optional experiment → movement and notes → review**. It is never a required funnel. The companion is thoughtful and occasional, with goal support only when someone chooses it.

## First: inspect and reproduce the actual design

Follow applicable repository instructions while inspecting. Locate current equivalents of these source hints:

| Reference hint | Inspect for |
| --- | --- |
| `src/pages/Home.tsx` | Journal composition, app shell, navigation, cards, spacing and mobile behavior |
| `src/pages/StatsRpcPage.tsx` | Direction display and editing, target fields, trends layout |
| `src/components/TinyTweakStrip.tsx` | Tweak placement, editor, review presentation and actions |
| `src/components/PostLogNoteFlow.tsx` | Optional reflection, notes, photos, skip and save controls |
| `src/features/activities/AddActivityForm.tsx` | Logging fields, form controls and saved-state transition |
| `src/components/OnboardingWizard.tsx` | Shared Direction and tweak patterns, terminology |
| Theme files, global CSS, UI primitives, assets and package configuration | Tokens, fonts, icons, buttons, sheets, dialogs, typography and responsive breakpoints |

These paths may have changed. Trace actual imports and rendered flows rather than guessing from filenames.

Create a short design inventory before building: actual colors, typefaces and weights, text sizes, spacing, radii, borders, shadows, icon library, button variants, page widths, navigation and modal/sheet behavior. Reference where each was found. If screenshots or a runnable reference app are available through the normal development workflow, use them to check fidelity.

Use the real app as visual authority:

- Copy the necessary theme tokens, local fonts, brand assets and minimal presentational component code into the isolated prototype. Preserve applicable notices.
- Match the existing header, navigation, background, cards, input fields, button treatments, icons, copy tone and mobile layouts.
- Use the current app's native surfaces for additions: a strip where it uses strips, a sheet where it uses sheets, its ordinary note field for reflection.
- Keep existing navigation labels and page hierarchy. Do not invent a prominent Companion tab or a chat-first landing page.
- New UI should inherit the same visual system. The only prototype-specific additions are a compact demo toolbar, small AI markers and source/provenance details.
- Do not use a generic wellness aesthetic, substitute typefaces or decorative imagery when actual assets are available. Do not create a new mascot, AI avatar or competing accent palette.

Avoid importing the real app wholesale: copied presentation components must run with local fixtures and callbacks, without production auth, analytics, service clients or environment variables. The prototype should keep working if the original checkout is moved or unavailable.

If the repository or essential visual assets are unavailable, ask for access to the repository or relevant files/screenshots before claiming a faithful reproduction. Do not silently substitute a new design. Record any unavoidable visual gaps in the delivery notes.

## Prototype architecture and boundaries

Use a small standalone project in the repository's familiar frontend stack where practical. Keep all state in memory or prototype-specific browser storage; include Reset demo. No backend, API key or external model is needed. Do not send entered notes or other content anywhere.

Use explicit local fixtures and deterministic responses. State visibly, once near the demo toolbar: **“Prototype · fictional history · simulated AI.”** This means the AI markers identify what the proposed product would generate or influence, not a live AI connection.

Keep demo state separate from real accounts. No production login, Supabase client, Polar/Garmin calls, Circle sharing, analytics, private routes, photos or live user records. Do not copy production secrets or environment files. Only bring over code/assets needed for presentation.

Provide a local README with startup instructions, the journey to try, how to reset, copied design references, limitations and the separation boundary. Do not implement the prototype in a branch of the production app or depend on running its server.

## Starting screen and comparison

Open on the familiar Journal with an active Tiny Tweak and normal activity entries. The first screen should look like MoveNotes, not a prototype instruction page.

Use a compact toolbar outside the app navigation:

- **Companion on / off**: show or hide proposed additions on the same fixtures. Label the off view “Existing experience · reconstructed from current code.” Disabling must not remove saved activities, personal reasons, accepted tweaks or notes; it hides AI assistance and generated review text.
- **Try a moment**: jump to Direction, save-and-reflect, or due review with the necessary fixture state. These are demo shortcuts, not proposed app navigation.
- **Reset demo**: restore sample history and clear prototype edits.
- **What changed?**: a small expandable explanation of additions on the current screen, separating existing features from proposed ones.

Keep these controls visually subordinate to the app. Include a suggested path, but never force a tutorial overlay or require the owner to complete steps in order.

## Playable journey

### 1. A familiar Direction, with a reason behind it

Begin with an existing-style Direction: **Walk · 3 activities per week**, currently **2 of 3 logged**. Preserve the real UI's metric/period structure and editing behavior.

Add an optional field in the normal Direction editor:

**What would this make room for?**

Example user text: “A little time outside after work.”

Helper: “A simple reason is enough. You can leave this blank.”

This field is user-authored, with no AI marker. Saving it updates local prototype state. The numeric target is still manually editable; the companion never changes it automatically.

Add a quiet, user-invoked **Find a tiny tweak** action. Open a native-looking sheet with:

**A small thing to try** · `AI suggestion`

“For one walk, try heading out before settling in at home. Notice whether that makes getting outside easier.”

Actions: **Edit and try**, **Another idea**, **Leave it for now**.

Provide at least three different prepared suggestions so Another idea visibly works. Use the selected Direction and reason in the fixture logic. If the owner changes them beyond supported examples, offer a general small experiment and identify it as a prepared demo response; never pretend to have understood arbitrary text.

Edit and try opens the familiar Tiny Tweak editor with the draft prefilled. Let the user edit freely and remove the proposed Direction link. Only explicit Save creates the tweak. Cancel and dismiss save nothing. Prevent duplicate saves. Respect the app's existing active-tweak limit: use its replace/finish pattern if necessary instead of inventing parallel active tweaks.

### 2. The accepted tweak appears where tweaks already live

After saving, show the tweak in the existing strip or equivalent, with the optional Direction association. The prototype must reflect the user's edited wording, not revert to sample text.

A draft saved unchanged keeps a small `AI suggestion` origin marker. If edited, change it to `AI-assisted`. A manually written tweak has no marker. Acceptance does not erase AI origin. Do not imply that all future text related to this tweak is AI-written.

Someone can also create an ordinary manual tweak without a Direction or companion help.

### 3. Save an activity, then optionally notice something

Use the app's familiar logging flow with a sample walk. Saving immediately adds one activity to the Journal. The next optional reflection screen can show:

**A moment to notice** · `AI question`

“Your tiny tweak was to try a walk before settling in at home. Did you try it today, or did the day go differently?”

Use the current saved tweak wording. Do not assert that it was followed merely because the activity was in the evening.

Actions: **Add a note**, **Not now**. Add a note focuses the normal note input; it does not open a separate AI conversation. Save the owner's actual typed text as the activity note. Never prefill the answer with generated feelings or save the question as their note. No AI marker on a user-authored answer.

Not now leaves the activity saved, with no note. Reload/navigation must not re-open a dismissed question. A second activity in the same demo week should not prompt again. A non-relevant activity should save through the normal flow without the question. The demo shortcut may explicitly reset eligibility to let the owner replay the moment.

### 4. Review the experiment, connected to the intention

A “Review due” demo shortcut advances to the app's existing review state; clearly identify the time jump as a demo action. Do not make the owner wait days or log many activities.

Use this exact fictional source note in the matching sample scenario:

**Tuesday · After-work walk:** “Getting out before sitting down helped.”

The due review shows the active tweak, its linked reason if present, and a short companion contribution:

`AI reflection`

“You linked this to making time outside after work. In Tuesday's note, you wrote: ‘Getting out before sitting down helped.’ Is this an experiment you'd like to keep?”

Show small source links: **Tuesday's walk** and **Your Direction**. They must open the corresponding local records. The note remains visibly user-authored when opened. The AI composed the connection and question, not the quoted note.

Actions, mapped to existing lifecycle conventions: **Keep trying**, **Change it**, **Leave it here**. Keeping renews the local experiment. Changing opens its editor and commits only on Save. Leaving finishes it. Provide a short optional reflection using the familiar pattern. The UI must visibly update after each choice.

Do not use the quoted example if the note has been changed/deleted, the active tweak is unrelated, or note permission is off. Use a neutral question instead, such as “How did this experiment fit into your days?” When a Direction is absent, omit that association. Never infer that reaching the numeric target proves the tweak worked.

## Small, honest AI markers

Use an unobtrusive badge or small icon plus visible text, styled from actual app tokens. Do not rely on color, a sparkle alone or hover-only tooltips. Make markers keyboard-focusable and tappable.

| Content | Marker |
| --- | --- |
| Generated draft idea | AI suggestion |
| Saved unchanged AI-origin tweak | AI suggestion |
| AI-origin tweak edited by the user | AI-assisted |
| Optional generated post-log question | AI question |
| Generated interpretation in a due review | AI reflection |
| User-written Direction reason, note or manual tweak | None |
| Count, distance, duration or ordinary progress calculation | None |

Tapping a marker opens a concise provenance popover/sheet:

- What AI contributed: drafted wording, suggested an experiment, or connected records.
- What it used: the specific Direction/tweak and, only if allowed, the exact sample notes. Link to those records.
- “Simulated in this prototype; no AI service was called.”

Mark the smallest relevant block. Do not mark the entire activity, Direction card or page as AI-generated. Inside a mixed review, distinguish the user's quoted text from the generated explanation. Preserve origin across local edits, navigation and review actions.

## Companion preferences and alternate states

Add a small settings surface in a location consistent with the existing app, rather than a new navigation destination. The prototype's main walkthrough may start enabled with fictional data, but state this explicitly; it is not a proposal for silent production enrollment.

Working controls:

- Companion enabled/off.
- Thoughtful / Quiet. Quiet hides proactive post-log questions but retains user-invoked suggestions and the ordinary tweak review; generated review assistance is available only when opened by the user.
- Allow use of private notes, initially off. The owner can enable it for the sourced-review scenario. Switching it off immediately removes quoted/generated note-derived context and prevents it appearing in provenance.

Include selectable fixture scenarios, labelled as demo controls:

| Scenario | What the owner should experience |
| --- | --- |
| Personal context | Opt into sample-note use, see the sourced review and open its sources |
| No notes permission | Same activity facts, neutral review, no private-note excerpt |
| Fresh start | No Direction/history required; manual tweak and logging remain usable |
| Busy week | Fewer logged activities than the target; no guilt, catch-up plan or target increase |
| Suggestion unavailable | “Couldn't make a suggestion just now. You can write your own tiny tweak.” Retry can succeed; ordinary saves work |

These controls should update actual prototype state, not just replace a screenshot or display an explanatory toast. Avoid generating claims from changed fixture data that no longer supports them.

## Scope and tone

Keep the companion quiet, specific and optional. Prefer “try,” “notice” and “would this fit?” Missing a target is not failure. Logged activities are not a complete record of someone's life.

Do not add a chatbot, training plans, weekly digest, push notifications, streak pressure, competitive features, community AI content, precise-location analysis, health judgments or inferred emotional memories. Do not add unrelated app features just to make navigation look complete. Inactive destinations can be labelled outside the app as outside the prototype; avoid misleading dead buttons in the main journey.

## Build and verification

1. Inspect the actual app; record the verified design and flow references.
2. Create the isolated project and copy only needed visual assets/primitives.
3. Reconstruct the familiar base screens first, then layer the companion additions on them.
4. Wire the full journey using fixture state, with comparison, provenance and reset.
5. Run the available build/type checks. Verify the main interactions at phone and desktop widths using supported browser tooling if available.

Acceptance checks:

- The production checkout is unchanged. The prototype starts independently without production secrets or network data access.
- Actual fonts, colors, components, spacing and responsive behavior are reused or faithfully reproduced; any gaps are disclosed.
- Companion off makes the difference immediately visible without destroying user-entered content.
- Direction → suggestion → edit → save updates the visible tweak; dismissal saves nothing.
- Activity Save works before reflection; skipping keeps it; adding a note saves only user text.
- A later relevant activity respects the demo frequency rule; an unrelated activity gets no prompt.
- Review sources open the right fixtures; keep/change/finish work; the view reflects edited/deleted source data.
- Notes permission, Quiet and unavailable states work as described.
- Every simulated AI contribution has a small accessible marker; user-authored text and computed metrics are not mislabelled.
- No blocking overlays, broken main-flow controls, horizontal overflow or inaccessible marker popovers at mobile width. Keyboard focus and sheet dismissal work.
- Reset reliably restores the initial scenario. If browser QA is unavailable, report that limit without claiming visual verification.

## Delivery to the owner

Provide the prototype project, exact local launch command and a short “try this” path: open Direction → find/edit/save a tweak → log a walk → add or skip a note → jump to review → compare Companion off. Include how to enable sample-note use for the sourced review.

Summarize the observable changes in plain language. State that AI is simulated, data is fictional, and the actual app has not been modified. Include checks run and any visual differences from the actual app. Do not deploy or connect live services.

## Ready-to-paste Codex prompt

> Build the standalone MoveNotes Companion prototype described in this handover. Use the actual MoveNotes repository as a read-only reference for appearance and existing flows. First inspect its theme, fonts, icons, shared UI components, navigation, Direction, Tiny Tweaks and optional post-log reflection. Create an independent project outside the application checkout and copy the minimum presentational assets/components so it looks and feels like the real app without production services. Implement working local-state Direction-to-tweak suggestions, draft editing/saving, activity saving with optional reflection, and the existing-style tweak review. Include fictional fixtures, deterministic simulated AI, small tappable AI-origin markers with provenance, a Companion on/off comparison, demo scenario shortcuts, preferences and reset. Distinguish user text, computed metrics and AI contributions. Preserve optionality and the low-pressure journal philosophy. No real AI, production data, migrations, codebase changes or deployment. Verify the connected journey and mobile layout, then deliver the isolated project, launch instructions, design references and verification limits. The objective is to let me experience what changes before deciding what belongs in the real app.
