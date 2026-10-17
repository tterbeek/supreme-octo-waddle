# MoveNotes — share an activity as an image

## Task

Implement an activity image-sharing feature in the existing MoveNotes app. A user should be able to create a polished, screenshot-like image of one of their activities and share it through their phone’s share sheet, including to WhatsApp where available. Include the real MoveNotes logo and the visible URL **https://movenotes.app** inside the exported image.

Interpret “similar to a Circle object” as resembling the existing Gentle Circle activity card, not as a circular image crop. Reuse the app’s established visual language. This is an implementation handover, not a request for an isolated prototype.

## Product context and boundaries

MoveNotes is a private, low-pressure movement journal that helps people remember how movement felt. External sharing should feel like sending a small memory to someone, without introducing performance pressure, a social publishing workflow, or promotional clutter.

The supplied app summaries say Circle summaries can contain titles, distance, duration, and photos, while personal notes stay private. Preserve that boundary. Exporting an image must not share the activity to Circle, change its visibility, upload a public copy, or create a public activity page. Activities can be exported whether or not they are shared to Circle. Receiving the image requires no MoveNotes account.

The image necessarily leaves MoveNotes when the user shares it; recipients can retain or forward it. Explain this with one calm line in the preview, not an extra confirmation dialog.

## Inspect before implementing

Read the repository’s AGENTS.md and relevant implementation. The attached summaries describe the app but are not a verified current codebase. Confirm actual paths, schemas, and behavior before editing.

- Find the existing Circle activity card and its public-summary field selection. Start with `src/pages/CirclePage.tsx` and follow its imports.
- Find the Journal activity actions and activity detail view; `src/pages/Home.tsx` is a supplied starting point.
- Find the canonical logo/wordmark assets, fonts, colors, spacing, corner radii, buttons, and modal/bottom-sheet patterns.
- Confirm activity-type-specific metric formatting, units, localization, date display, and attachment permissions.
- Check for existing image-export utilities and dependencies before adding a library.

Follow existing architecture. Do not introduce guessed component paths or a second branding system.

## User flow

1. Add **Share as image** to the existing actions for an activity owned by the current user. Put it in the Journal activity menu and the activity detail actions if that screen exists. Keep **Share to Circle** distinct.
2. Open a mobile-friendly preview sheet using the existing app pattern. Show the complete export composition, including its logo and URL.
3. If the activity has photos, allow **No photo** or one photo chosen from its attachments. Default to no photo for deliberate external disclosure. Keep the photo selector small and use existing thumbnail UI.
4. Prepare the actual image file while the preview is open. Keep the share button disabled with a short preparation state until that file is ready. The preview must correspond to the prepared file and current selection.
5. Offer **Share image** as the primary action where file sharing is supported, with helper text: “Choose WhatsApp or another app.” The operating system chooses which targets are available; do not promise a direct WhatsApp launch.
6. Offer **Save image** as a secondary action. Where file sharing is unsupported, make this primary and explain: “Save the image, then attach it in WhatsApp.” Use platform-appropriate download/save behavior and verify it on supported devices.
7. Closing the sheet or cancelling the system share sheet leaves the activity unchanged.

Preview privacy line: **“Only what’s shown here is included. Personal notes stay private.”** Follow with a short line such as “People you send it to can save or forward it.”

## Image design and content

Create a purpose-built export card, not a capture of the whole screen or live Journal DOM. It should clearly feel like a MoveNotes Circle activity card with a quiet brand footer.

Use one fixed export width of 1080 pixels and content-driven height with sensible limits. Prefer a compact portrait composition; a no-photo activity must not have a large empty photo area. This is an image attachment, so avoid introducing story templates or multiple export formats in v1.

| Element | Requirement |
| --- | --- |
| Activity heading | Existing activity-type icon/label and activity title; fall back to the activity type when the title is empty. |
| Date | The activity’s date using existing app date/timezone rules; no precise time or location. |
| Metrics | Distance and/or duration where relevant and available, using the existing activity-type preferences and unit formatters. Omit missing values without blank placeholders. |
| Optional photo | One explicitly selected attachment, with a restrained crop consistent with Circle styling. Preserve orientation and avoid stretching. |
| Brand footer | Actual MoveNotes logo/wordmark plus the literal text `https://movenotes.app`. Keep this visible on every export, including photo-free cards. |

Use the app’s type hierarchy, warm/quiet palette, padding, and card treatment. Ensure the logo and URL remain readable at phone chat-preview size. Put branding on an opaque surface. Use an opaque image background and generous edge padding so messaging compression does not undermine legibility.

The URL printed in image pixels is not a clickable link. Do not depend on a caption being preserved for attribution. Keep v1’s image share payload to the file; recipients can type the visible URL. A separately copied link can be considered later.

Exclude personal reflections, standalone journal text, effort/feeling fields, equipment, precise location, route maps/GPX, heart rate, account email, profile identifiers, other people’s reactions, and app navigation. These exclusions keep v1 small and avoid assuming every existing Circle field is appropriate externally. Activity titles and selected photos remain visible in the preview so users can review their own sensitive content.

No AI-generated captions, comparisons, records, streaks, leaderboards, or “join now” messaging.

## Implementation requirements

### Explicit export data

Build an allowlisted export model containing only the fields above. Pass that model to the export renderer rather than the complete activity or account object. Check ownership through the existing data-access layer. Do not serialize attachment credentials, signed URLs, or metadata into output. Re-render selected photos into the final composite rather than attaching the source photo, and do not copy source EXIF/GPS metadata.

Share visual primitives and formatting helpers with the existing card where useful, while keeping private fields and interactive controls out of the export render tree. Avoid broad refactors to the Circle feature.

### Rendering and file lifecycle

Render locally in the client. Use an existing export tool if suitable; otherwise choose a small maintained DOM-to-image or canvas approach compatible with the project. Embed or load the real logo, wait for required fonts and selected-photo decoding, and generate a PNG file with the correct MIME type and a neutral filename such as `movenotes-activity.png`.

Use the existing authorized attachment loader. Handle image fetch failures, expired URLs, and canvas cross-origin restrictions through approved app access paths; never make private storage public. If the chosen photo cannot be rendered, offer Retry or No photo. Do not silently share a different composition.

Regenerate the file after any content change. Prevent older asynchronous render results from overwriting newer selections. Release temporary object URLs on replacement and close; discard prepared files when the sheet is dismissed. Avoid persisting generated images on the server.

### Native share and fallback

Use `navigator.canShare({ files: [file] })` to check file-sharing support and `navigator.share({ files: [file] })` from a fresh user click when supported. The file should already be prepared: lengthy async rendering inside that click can lose the transient user activation required by the API. Require the appropriate secure context and handle policy restrictions.

Do not substitute a text-only WhatsApp URL action for sending the image. Keep Save image available. Treat share-sheet cancellation quietly; handle genuine failures with “Couldn’t share the image. Try again or save it instead.” Require another explicit click for retry. Prevent duplicate concurrent share calls.

Do not show “Sent to WhatsApp” after the promise resolves: the browser does not provide reliable confirmation of delivery or which recipient/app completed the action.

Reference documentation:
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare

## Acceptance criteria and verification

- An owned manual or imported activity can open the preview and generate an image; Circle visibility is irrelevant and unchanged.
- Every exported image contains the correct logo and exact URL `https://movenotes.app`, with no app controls or private notes.
- Export with no photo, one selected photo, and a failed photo load. The preview and exported file match; the footer is never cropped.
- Verify long titles, non-Latin characters, missing metrics, duration-only activities, distance-only activities, and the app’s supported unit/date formats. Wrap titles within a sensible limit and show any truncation in the preview too.
- Confirm fonts, logo assets, image orientation, and readability in the exported PNG and after an actual WhatsApp image send.
- On supported iOS Safari/PWA and Android Chrome/PWA devices, verify the system share flow and selecting WhatsApp when installed. Record actual tested versions and limitations; use real-device manual checks for the native handoff.
- Verify unsupported file sharing, cancellation, denied sharing, preparation errors, retry, repeated opening/closing, rapid photo changes, and download fallback. No automatic retry or unexpected download after cancellation.
- Check accessible action labels, focus management, keyboard dismissal, visible loading/error states, and narrow-screen preview layout.
- Add focused tests for the export allowlist/private-field exclusion, missing-value formatting, render selection races, and share/fallback/cancel branches using the existing test setup. Run relevant existing checks and visually inspect representative exports. Do not attempt to prove native WhatsApp behavior solely with mocked browser tests.

## Deliverable from Codex

Implement the feature in the existing app. Return a concise explanation of the changes, relevant files, verification performed, and any actual device/browser limitations. Include representative photo and no-photo export previews for review using existing project tooling. Keep this iteration limited to one activity image and its sharing flow.

## Source basis

Product guidance comes from the supplied `Philosophy-of-MoveNotes-app.txt` and `How-stuff-functions-in-MoveNotes.txt`. Their repository paths are investigation leads, not confirmation of the current implementation. Layout defaults and the photo/privacy choices in this handover are proposed v1 product decisions.
