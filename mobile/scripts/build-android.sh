#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -d .toolchain/node_modules/.bin ]; then export PATH="$PWD/.toolchain/node_modules/.bin:$PATH"; fi
if [ -d .toolchain/jdk21 ]; then export JAVA_HOME="$PWD/.toolchain/jdk21"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
node --version
./node_modules/.bin/tsc -p tsconfig.json
npm test
npm run web:build
npx cap sync android
./android/gradlew -p android :app:assembleDebug --max-workers=2
mkdir -p artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/MoveNotes-capacitor-debug.apk
sha256sum artifacts/MoveNotes-capacitor-debug.apk > artifacts/SHA256SUMS
