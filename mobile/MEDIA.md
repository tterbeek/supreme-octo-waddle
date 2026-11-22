# Native Android photos

The existing PWA forms and upload services are reused. Build-time adapters in
`src/media.ts` and `src/exif.ts` call MoveNotesMediaPlugin for native selected-file
access and the system camera. Original EXIF is read before PWA compression.

Photo locations are optional. Include locations requests Android metadata access;
Photos only and system denial still allow uploads without coordinates. Current
device location is never substituted. Five photos are allowed. Private temporary
copies are released after ingestion. The existing upload/storage authorization is
unchanged. The metadata-aware newer Photo Picker branch remains unverified; the
selected-document fallback was tested on Android17/API37.

Local Supabase serves HTTP images. `src/local-images.ts` bridges only emulator
storage image URLs into temporary blob URLs because Chromium blocks those images
inside an HTTPS page. It releases URLs when images are removed/replaced. Hosted
HTTPS images are unchanged. No PWA/backend source changes are required.

## Observed checks

On owner emulator-5554 (Android17/API37), using fictional local Supabase data:
GPS photo (50.85,4.35), no-GPS photo, actual system camera capture, full OS metadata
denial and explicit Photos only all upload successfully through original PWA
reflection. Expected coordinates are persisted. Compressed uploads have no raw
GPS EXIF. The emulator camera did not embed GPS, so camera GPS was correctly null;
a physical camera producing GPS EXIF has not been tested.

A 90-second picker/cancel test preserves the process and returns to the edit form.
This emulator's bundled WebView145.0.7632.45 crashed on background trim callbacks.
MoveNotesApplication defers only UI_HIDDEN/BACKGROUND callbacks while a media
picker is active, only on API37 with that exact WebView version. Critical memory
pressure still propagates. Other device/provider versions are unaffected. This
narrow workaround needs retesting when that preview emulator is upgraded.

Build/install commands are in README.md. Detailed local evidence is under
verification/media/. No staging exists, no production data/configuration was used,
and real-device permissions/camera GPS and five-file selection still need checking.
