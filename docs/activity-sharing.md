# Activity image sharing

In the Journal, open **Activity actions → Share → Share other**.
Choose **Share with Circle** instead to use the existing private Circle-sharing flow.
The export uses saved activity details.
Manual and imported activities use the same flow; Circle visibility is irrelevant.

The sheet defaults to **No photo**. Choose at most one attachment, review the
actual prepared PNG, then use **Share image** or **Save image**. File sharing is
capability-detected; unsupported browsers get download instructions instead.
Safari may open a saveable image preview rather than a direct download.

## Implementation and privacy

- `src/services/activityImage.service.ts` verifies the current authenticated owner,
  reads an explicit field selection, loads metric preferences, and downloads photos
  through authenticated private storage (including the existing legacy bucket).
- `src/lib/activityImage.ts` creates the allowlisted renderer model and handles
  file-sharing capability, cancellation and explicit downloads. It never writes
  an activity, shares to Circle, or creates a public URL.
- `src/lib/renderActivityImage.tsx` draws a purpose-built 1080px-wide PNG, including
  the existing Tabler activity icon, canonical HeaderLogo wordmark/fonts and the
  exact URL `https://movenotes.app`. No-photo exports stay compact; selected-photo
  exports have a bounded portrait crop. Titles wrap at word boundaries where
  possible and visibly truncate after three lines, including in the preview.
- `src/components/ActivityImageSheet.tsx` previews the generated file itself,
  guards selection races, revokes temporary URLs, and keeps failures explicit.
  Native sharing is called directly from a fresh click, not after rendering.
- The existing accessible sheet shell is shared as `DialogSheet`; Companion's
  existing component name is retained as a re-export.

No notes, feelings, effort, equipment, locations, routes, profile identifiers,
source URLs or account details enter the export model. Selected photos are
decoded and composited, not attached as originals; source EXIF is not copied.
The title and selected photo can still contain sensitive content: review the
preview before sharing. Recipients can save and forward the result.

No new dependencies, migrations, server functions, environment variables or
storage permissions are required. This is a frontend-only release.

## Verification

Automated checks: `npm test`, `npm run build`, and focused ESLint checks for new
sharing modules. Unit coverage includes privacy allowlisting, ownership filters,
missing/invalid metrics, metric preferences and imperial units, calendar dates,
Unicode/long-title wrapping, stale preparation tickets, file-only share payloads,
cancellation, denial, unsupported/insecure contexts, and explicit downloads.

Local browser verification on **Chrome for Testing 156.0.8078.4 (headless Linux)**,
with fictional fixtures and mocked Supabase reads/native share API:

- Journal action opens the preview without opening edit; no photo is selected.
- The preview and downloaded PNG are byte-identical.
- Both photo and no-photo compositions were exported and visually inspected.
- No metrics / long mixed Latin–Japanese title renders without clipping the footer.
- Rapid photo changes discard stale results; failed photo loads show Retry / No
  photo; retry succeeds without silently changing the composition.
- Cancellation stays quiet; denial shows the save alternative; concurrent calls
  are suppressed. Reopening resets photo selection and releases replaced URLs.
- Escape dismissal, focus restoration, and 320px/390px mobile layouts were checked.
- A JPEG fixture with EXIF orientation 6 is rotated on decode; its exported PNG
  has no source EXIF/orientation metadata.

Representative fictional exports: [without photo](previews/activity-share-no-photo.png)
and [with selected photo](previews/activity-share-photo.png).

### Still requires real-device verification

No real iOS Safari/PWA, Android Chrome/PWA, or WhatsApp send was tested. Native
handoff was mocked, not proved by browser automation. On each supported device:

1. Open an owned manual and imported activity, including an activity not shared
   to Circle. Check date, units, photo orientation and full branding in the preview.
2. Choose Share image, select WhatsApp when available, and send to a test contact.
   Check the received image after messaging compression; record OS/browser versions.
3. Cancel, retry, and test Save image. Confirm the downloaded/saved image can be
   attached manually (including Safari's preview/save behavior).
4. Close/reopen, switch photos quickly and try a missing/deleted attachment.
   Ensure no activity or Circle visibility changes.

The system controls available targets. A resolved share promise does not prove
delivery or identify the chosen app, so the UI does not claim either.

API references: [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
and [file-sharing capability checks](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare).
