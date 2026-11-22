# MoveNotes Android — Capacitor

This packages the **existing PWA**. Screens, React components, styles, validation, services and backend contracts come directly from `../index.html`, `../src` and `../public`. There are no copied screens and no separate mobile UI.

The independent package/lock here contains Capacitor tooling/plugins only. The root PWA dependencies, build/deployment settings and backend remain unchanged. iOS can use the same wrapper/adapters later; no iOS project has been created.

## Install / rebuild

APK: `mobile/artifacts/MoveNotes-capacitor-debug.apk` (ignored by Git). It is debug-signed, development ID `app.movenotes.android.dev`, and bundles the PWA assets; no Metro or web dev server is required to render it.

```bash
# Repository root, Node22+ (tested24) and full JDK21, Android SDK36
npm ci
cd mobile
npm ci
export JAVA_HOME=/path/to/jdk21
export ANDROID_HOME="$HOME/Android/Sdk"
npm run android:build
adb install -r artifacts/MoveNotes-capacitor-debug.apk
adb shell am start -n app.movenotes.android.dev/.MainActivity
```

The build script uses `.toolchain/node_modules/.bin` and `.toolchain/jdk21` when those isolated tools exist. Android Studio can open `mobile/android`. Root dependency installation is only needed on a fresh checkout; this implementation did not change the root package or lockfile. Debug signing only; store signing/distribution remains a separate authorized task.

## Backend

**Default APK uses the existing local Supabase**, reading only the root `.env.development.local` and translating localhost to emulator host **10.0.2.2**. It never implicitly loads production `.env.local`. Keep your local Supabase stack running. This is real local PWA data, not a simulated UI.

Optional mobile overrides: copy `.env.example` to **mobile/.env.local**. For a physical phone, provide an accessible backend address and review development network configuration; the supplied network exception is restricted to emulator host10.0.2.2.

To deliberately package another backend, set `MOVENOTES_ANDROID_ENV=/absolute/path/to/public-config.env` and `MOVENOTES_ALLOW_HOSTED_BUILD=1` before building. This opt-in authorizes packaging configuration, not production test writes or deployment. Every `VITE_*` value is public/embedded: anonymous/publishable and public Mapbox keys only. Never put client secrets, service-role keys, passwords or AI keys there.

The local default auth email contains a verification **link**, while the existing PWA asks for an OTP code. Testing used its own local verification mail to establish a session through the debug WebView, without changing auth configuration. For interactive local OTP login, the owner must configure a local mail template containing `{{ .Token }}`; no template/server change was made here. Production's existing OTP template was not tested.

## Thin native adapters

- `vite.config.ts` imports the existing web build config and builds the existing PWA sources directly into `web-dist/`; Tailwind runs with the repository root as its working directory. Only native bootstrap and service-worker alias are added.
- `src/runtime.ts` connects Android Back to the **existing** overlay stack/unsaved-change guards, dispatches resume events, and bridges the existing `navigator.share` image/text output to Android sharing through cache files.
- The native bundle does not register a PWA service worker: the APK already carries its offline assets and APK installs update that bundle. The browser PWA's service worker is untouched.
- Public invite URLs in the Android build use `VITE_PUBLIC_APP_URL` (local default `http://localhost:5173`, hosted default `https://movenotes.app`), rather than the internal WebView origin `https://localhost`.
- The development Android manifest disables account backup, supports `movenotes://` links, allows network cleartext only for emulator10.0.2.2, and resizes for the keyboard. WebView inspection is disabled by default. Enable it only for controlled QA with `MOVENOTES_WEBVIEW_DEBUG=1` when building; do not enable it for normal/release use.
- Activity photos use the existing PWA forms with a native media adapter. Android selected-file/system photo selection and the external camera return original photo data and available EXIF coordinates. Browser/PWA behavior stays unchanged. See MEDIA.md for permissions and verification.

## Integration limits

Login by email OTP uses the existing PWA/Supabase flow. **Fresh Polar/Strava authorization and email-change redirects still need owner-approved mobile redirect configuration.** Current services construct callbacks from the WebView origin; the Polar backend accepts its configured exact web callback. No live auth/provider configuration was changed. Do not treat the custom-scheme receiver as proof that provider authorization works. Existing connected-account status/sync still uses the original PWA services, and live imports were not tested.

Maps, photos, Circle, Memories, Direction, Tiny Tweaks and Companion are the existing implementations and retain their existing availability/privacy rules. Packaging them does not mean every flow is now device-certified. See [VERIFICATION.md](VERIFICATION.md) and [CHECKLIST.md](CHECKLIST.md).

Builds include the PWA snapshot at build time; make normal changes in the existing PWA, then run `npm run android:build` here. You do not maintain a second UI.

## Checks

```bash
cd mobile
./node_modules/.bin/tsc -p tsconfig.json
npm test
# Root PWA checks with outputs/cache under mobile:
cd ..
node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental --tsBuildInfoFile mobile/.cache/web-typecheck.tsbuildinfo
node node_modules/vitest/vitest.mjs run --config mobile/vitest.config.ts
node mobile/scripts/check-boundary.mjs
```

Android smoke scripts under `scripts/` use ADB/WebView debugging and fictional local users only; they are not production tooling. Test sessions/tokens are never written to reports. Retained local user/activity identifiers are test fixtures, not credentials. Test scripts can create local records; do not run against hosted data.

References: [Capacitor setup](https://capacitorjs.com/docs/getting-started), [Android](https://capacitorjs.com/docs/android), [App Back/lifecycle](https://capacitorjs.com/docs/apis/app), [native sharing](https://capacitorjs.com/docs/apis/share).
