import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractPhotoGps } from "../src/exif.ts";
import { nativePhotoMetadata } from "../src/media-metadata.ts";
const image = () =>
  new Blob(
    [
      fs.readFileSync(
        new URL("../verification/media/MoveNotesGPS.jpg", import.meta.url),
      ),
    ],
    { type: "image/jpeg" },
  );
test("existing EXIF parser reads fictional original coordinates", async () => {
  assert.deepEqual(await extractPhotoGps(image()), { lat: 50.85, lng: 4.35 });
});
test("native metadata denial prevents PWA fallback from reading GPS", async () => {
  const photo = image();
  nativePhotoMetadata.set(photo, { allowed: false, coords: null });
  assert.equal(await extractPhotoGps(photo), null);
});
test("approved native coordinates survive without re-inferring position", async () => {
  const photo = image();
  nativePhotoMetadata.set(photo, {
    allowed: true,
    coords: { lat: 50.85, lng: 4.35 },
  });
  assert.deepEqual(await extractPhotoGps(photo), { lat: 50.85, lng: 4.35 });
});
test("photo without GPS remains valid with no invented location", async () => {
  const photo = new Blob([
    fs.readFileSync(
      new URL("../verification/media/MoveNotesNoGPS.jpg", import.meta.url),
    ),
  ]);
  nativePhotoMetadata.set(photo, { allowed: true, coords: null });
  assert.equal(await extractPhotoGps(photo), null);
});

test('shared PWA file helper retains denied-metadata identity',async()=>{const {createImageFile}=await import('../../src/lib/media/getImage.ts');const file=new File([fs.readFileSync(new URL('../verification/media/MoveNotesGPS.jpg',import.meta.url))],'fixture.jpg',{type:'image/jpeg'});nativePhotoMetadata.set(file,{allowed:false,coords:null});const wrapped=createImageFile(file,'fallback',null);assert.equal(wrapped,file);assert.equal(await extractPhotoGps(wrapped),null);});
