# Android native media completion

- [x] Keep existing PWA forms and upload services unchanged; native-only module adapters.
- [x] Native selected-file / metadata-aware system picker and external system camera.
- [x] ACCESS_MEDIA_LOCATION consent; denial permits upload without coordinates.
- [x] Read original photo EXIF before compression; do not substitute current device location.
- [x] Native result carries original file and GPS; prevent denied metadata being re-read by PWA fallback.
- [x] Five-photo cap, bounded file copying, cancellation, controlled temporary-file release.
- [x] Android build, eight JS privacy/policy tests and two Java media-policy tests pass.
- [x] Real local upload scenarios pass on emulator-5554 Android17/API37: GPS50.85/4.35, no-GPS, native camera, system denial and Photos only. Existing PWA uploads image/thumbnail and stores the expected coordinates; compressed image has no raw GPS EXIF.
- [x] Long native picker remains open 90 seconds; cancel returns to existing edit form.
- [x] Local image bridge: all eight Journal images load with nonzero dimensions in diagnostic build.
- [x] Final normal APK installed; Journal screenshot final-journal.png.

Owner authorized emulator-5554 only. Five real upload scenarios pass against local Supabase. PWA regression:312 tests/44 files. Boundary check unchanged outside mobile. The API37/WebView145 background-trim crash is addressed by an exact-version active-picker compatibility guard; logs confirm levels20/40 deferred and long cancellation passes. See MEDIA.md for remaining device limits.
