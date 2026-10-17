# Form consistency: inventory, rules and verification

## Shared rules

`ModalSheet` now owns the overlay lifecycle for sheets, centred dialogs,
full-screen onboarding and the navigation drawer. `DialogSheet` and
`CompanionSheet` remain compatibility exports of that same shell, not alternative
implementations.

- Fixed, labelled header with a visible Close button; one scrolling body; a
  compact primary-action footer. Short forms fit their content. Long forms are
  capped by the current visual viewport, with safe-area spacing.
- `FormActions` renders the primary action into that footer. Secondary actions,
  privacy explanations, optional preset fields, errors and destructive actions
  remain in the body. Instant-save selectors need no artificial Save button.
- `FormPage` keeps genuine page tasks as pages, with a titled Back action and
  document scrolling. Its primary action follows the page content.
- `FormField`, `FormError`, shared scoped field styles and `FormTextarea` provide
  consistent labels, 44px minimum control height, input text size, spacing, help
  text and accessible errors. Textareas grow with their contents rather than
  creating a second scrolling region. Date inputs remain native and visibly
  labelled; selects and photo pickers keep their existing native behaviour.
- Close, backdrop and Escape use the same value-based dismissal check. Unchanged
  forms close immediately. Changed forms offer **Keep editing / Discard changes**
  in the existing overlay, without mounting another backdrop. Writes in progress
  prevent dismissal. Decorative drag handles and their inconsistent old handlers
  were removed; the shells no longer advertise drag dismissal.
- One overlay stack makes only the active layer visible/focusable. Parent forms
  stay mounted during equipment/preset/image-preview subflows. A reference-counted
  body lock restores original styles, inertness and exact scroll position only
  after the last overlay closes. Focus is trapped in the active layer and restored
  to an available opener. Opening a form does not automatically summon a keyboard.
- SPA navigation and browser Back use one `FormNavigationGuard`. The root uses
  React Router's existing data-router API to support navigation blocking while
  retaining the existing route definitions. Successful saves explicitly allow
  their completion navigation. Browser reloads/tab closure use the browser's
  native before-unload warning; browsers do not permit custom wording there.

No schema, policies, storage permissions, production configuration or consent
defaults were changed. Existing save payloads and privacy rules are retained.

## Audited inventory and entry points

The audit included all JSX inputs, textareas, selects, modal implementations,
routes and caller sites, including forms assembled from buttons rather than
native `<form>` elements. Shared field-only wrappers are listed with their owners.

| Form / surface | Implementation | Entry points and treatment |
| --- | --- | --- |
| Activity/task chooser | `AddBottomSheet`, `SelectActivityTypeModal` | Journal +, Calendar +, Presets add; titled, closable selectors; no draft to discard |
| Manual quick log | `AddActivityForm`, `AddActivityModal`, `useQuickLogForm` | Journal / Calendar after type selection; shared fields + footer; loaded defaults establish the clean baseline |
| Imported activity completion | Same Quick Log components | Pending imported Journal / Calendar activities; locked type, updates existing activity, preserves provenance; Keep imported details stays in body |
| Activity edit | `EditActivityModal`, `useActivityEditForm` | Journal, Calendar day entries; native date, metrics, feelings, equipment, notes/photos; one body, primary Save footer |
| Existing activity reflection edit | `EditActivityModal` with `reflectionOnly` | Journal / Calendar reflection actions; same shell, restricted fields retained |
| Optional post-log reflection | `AddNoteModal`, `PostLogNoteFlow` | After a successful manual/imported log; separate note/photo draft; discarding it never deletes the already-saved activity |
| Standalone journal note create/edit | `JournalEntryModal` | Journal + / note card; Calendar + / day entry; draft protection, growing textarea, Save footer; delete stays in body |
| Quick Log preset option | `SavePresetFooter`, `PresetsBar` | Manual quick log; optional preset checkbox/name in scrolling body; compact wrapping shortcuts + All presets selector |
| All presets selector | `AddActivityForm` secondary sheet | Quick Log More; one scrolling list, no nested list scroll |
| Preset create/edit | `AddPresetModal`, `EditPresetModal`, `PresetFormContent` | Presets page; shared activity primitives and equipment selector; Save footer; deletion in body. Removed the old non-functional preset Title control (only Name is persisted) |
| Legacy preset page | `AddPresetPage` | `/presets/new`, including embedded API; remains a page with title/Back and guarded draft; same save fields retained |
| Equipment selection | `EquipmentDialog` | Quick Log, activity edit, preset create/edit; local selection is guarded until Done; list uses parent body's scroll |
| Equipment create | `EquipmentFormSheet` | Equipment page, embedded onboarding, nested equipment selector; short centred dialog, shared labelled fields and validation |
| Equipment edit/usage | `ManageEquipmentPage` edit sheet | `/settings/equipment` item, embedded onboarding item; one body for fields and usage; Save footer |
| Equipment retirement confirmation | Same page | Stop using this equipment; short dialog; retirement action remains in body, Keep using it is the footer action; past activities unchanged |
| Activity preferences | `ActivityPreferencesPage` | `/settings/activity-preferences`, onboarding step; stays page/embedded; enabled/order/metric changes remain instant-save; reorder handle also supports arrow keys |
| Default metric selector | Same page's metric sheet | Activity metric button/row; titled, closable, instant-save; errors visible in the active sheet |
| Direction / Tiny Tweak chooser | `DirectionAddModal` | Insights Direction tab +; short selector; visible Close |
| Direction measures selector | `GoalDirectionSheet` | Insights Direction group; existing measure/edit/add flow preserved in shared shell |
| Direction create/edit | `AddGoalModal`, `EditGoalModal` | Insights, duplicate-goal edit handoff, onboarding; type/metric/period/target/name rules retained; visible errors; Save footer, delete in body |
| Tiny Tweak create/adjust/end | `MicroAdjustmentCreateModal` | Journal strip, Insights +, onboarding; suggestions + custom text guarded; ending remains a saved operation, not unsaved draft cancellation |
| Tiny Tweak review | `TinyTweakStrip` reflection sheet | Ended tweak prompt in Journal; independent journal-note save; discard clears only the local review text |
| Companion reflection | `WeeklyCompanionCard` | Companion feed card; own words guarded separately from the AI post; Save footer; Not now/remove in body |
| Companion provenance | Same card, sources sheet | What it used / AI marker; read-only, shared title/Close/scroll/focus rules |
| Companion preferences | `CompanionSettings` | Settings Premium row; instant-save toggles, consent/privacy explanations retained, busy close protection, Done footer; entitlement checks unchanged |
| Image sharing preview | `ActivityImageSheet` | Journal activity actions; actual PNG preview, no record draft; Share or Save is primary footer, secondary Save stays in body |
| Welcome carousel | `OnboardingCarousel` | First sign-in / local onboarding state; remains full-screen; fixed title/Close, scrolling explanation, Next footer and labelled Back |
| Onboarding wizard | `OnboardingWizard` | First setup / Settings restart; all five steps reuse the same shell; nested forms retain their own save boundaries; cannot advance during an in-flight write |
| Login + email code | `Login` | `/login`, invitation redirect, signup link; page title/Back, labelled email/OTP, inline validation, footer action, guarded navigation |
| Signup + email code/consent | `Signup` | `/signup`, login redirect; same page frame; required Privacy/Terms and optional newsletter consent unchanged |
| Circle mini-profile / avatar | `ManageCirclePage` | `/settings/circle`; page Back guards unsaved friendly name; avatar upload remains immediately saved and is keyboard-operable; profile errors stay visible |
| Circle invite creation/sharing | Same page | Share invite; instant operation with OS share/copy fallback, no artificial unsaved draft |
| Circle invitation acceptance | `CircleInvitePage` | `/circle/invite/:token`; remains an actual page, not a faux backdrop dialog; title/Back in all status states; Accept footer; completion navigation allowed after success |
| Circle connections / reactions | `ManageCirclePage`, `CircleFeedCard` | Existing connection and inline reaction actions remain instant-save; reaction disclosure has Close/Escape; no draft discard prompt |
| Settings units / account deletion request | `SettingsPage` | `/settings`; page Back; units short instant-save sheet with visible failure; deletion-request dialog still only opens an email, never deletes an account |
| Integrations | `ConnectionsPage`, `PolarCallbackPage`, `StravaCallbackPage` | `/settings/connections`, both callbacks; page titles/Back, existing connect/sync/disconnect and OAuth checks unchanged; Strava remains paused |
| Calendar day selector | `CalendarPage` | Calendar day tap; shared read-only Day entries sheet; edit/log/note use the same forms above; removed inner list scrolling |
| Navigation drawer | `Sidebar`, `Layout` | Header menu; shared drawer lifecycle; removed duplicate global Sidebar mount |
| Search/filter input | `SearchBar` | Journal/Calendar/Photos toolbar callers; remains inline, labelled, 16px input, visible Close and Escape; no persisted draft |
| Photo viewer | `GalleryLightbox` | Journal, Calendar, Photos, Circle; retains specialised pan/zoom layout but shares scroll locking/overlay ownership; visible Close, keyboard trap/restoration; removed forced no-zoom viewport metadata |

`ActivityForm`, `ActivityFormFields`, `PresetFormContent`, distance/duration,
feeling and effort selectors are shared primitives, not independently opened
forms. Their owning forms above were migrated. About, Support, legal pages and
the admin reporting dashboard contain no editable data forms. Calendar/Insights
filters and goal pins are immediate view/preferences actions, not unsaved editors.
Toasts, tooltips, OS share/install dialogs and native date/photo pickers are not
additional app forms.

## Deliberate exceptions

- Page tasks remain pages; onboarding remains full-screen. No forced bottom-sheet
  conversion of every task.
- Autosaved settings, connections, invitations and reactions do not acquire a
  misleading Save/Discard workflow. Already-saved equipment/activities/notes are
  never rolled back when a later optional step is dismissed.
- The photo viewer keeps its image-specific gesture/layout behaviour. It is not
  an editable form; private note display there is unchanged.
- Reload/tab-close/external-navigation warnings are browser-controlled. Native
  date, select, camera/library and OS share UIs remain platform-controlled.

## Repeatable checks

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5182
# In a second terminal, with a local Chrome/Chromium executable:
CHROME_BIN=/path/to/chrome node scripts/form-browser-check.cjs
```

The browser runner uses the existing `ws` dependency from Supabase's dependency
tree and a Chrome DevTools connection; no new package was added. `FORM_QA_URL`
can override the Vite origin and `FORM_QA_OUTPUT` the artifact directory. Fixtures
under `scripts/form-qa/` replace authentication, reads and writes with fictional
data and reject unmocked Supabase network requests. They are not app imports and
are not bundled into `dist`.

Unit regressions cover dirty-value comparisons (including photos), unchanged
dismissal, busy-save protection, navigation allowances, nested layer ownership,
StrictMode re-registration, reference-counted scrolling and exact position/style
restoration across same-tick handoffs. Browser checks render the actual migrated
components, rather than replicas.

### Verification scope and limits

Final results: **59 unit tests passed**, **172 browser scenarios passed**, production
build passed, focused ESLint checks for the shared form infrastructure passed,
and `git diff --check` passed. The build still reports the existing stale
Browserslist/large-bundle warnings. No schema check/reset was run because there
are no database changes.

Tested with **Chrome for Testing 156.0.8078.4, headless Linux**: 390px mobile,
1280px desktop, and 320px with 200% CSS text size; long content, errors, dirty
dismissal/reversal, saved-step boundaries, busy writes, nested equipment/presets,
OTP/consent steps, settings selectors, tab trapping/focus restoration, browser
Back, photo file selection and a contracted keyboard-sized viewport.

Supabase was mocked. These checks do not prove live authentication, OAuth,
uploads, backend policies or successful real data writes. Existing unit tests
and the production build also run; no SQL changed, so database reset/schema
verification is not needed for this UI migration.

**Not device-tested:** physical iOS Safari/PWA or Android Chrome/PWA, actual
software keyboards and their VisualViewport behaviour, native date/select
pickers, camera capture, OS share targets, or screen-reader announcements. Those
still need real-device/manual assistive-technology checks; viewport emulation is
not a claim of native keyboard verification.

Representative screenshots and the browser result manifest are in
[`previews/forms/`](previews/forms/). They contain fictional data only.

- [Activity logging, mobile](previews/forms/log-mobile.png)
- [Activity editing, desktop](previews/forms/edit-desktop.png)
- [Nested equipment dialog, mobile](previews/forms/nested-equipment-mobile.png)
- [Unsaved-change protection](previews/forms/discard-mobile.png)
- [Signup page](previews/forms/signup-mobile.png)
- [Long note with a contracted viewport](previews/forms/keyboard-viewport.png)
- [Browser version and scenario manifest](previews/forms/results.json)

Navigation API reference: [React Router useBlocker](https://reactrouter.com/api/hooks/useBlocker).
