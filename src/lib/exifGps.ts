type GpsCoords = {
  lat: number;
  lng: number;
};

const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xe1;
const SOS_MARKER = 0xda;
const EOI_MARKER = 0xd9;
const TIFF_MAGIC = 42;
const GPS_INFO_IFD_POINTER = 0x8825;
const GPS_LATITUDE_REF = 0x0001;
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_LONGITUDE = 0x0004;

const TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

const asRoundedCoord = (value: number) => Math.round(value * 1e7) / 1e7;

const inBounds = (view: DataView, offset: number, length = 1) =>
  offset >= 0 && length >= 0 && offset + length <= view.byteLength;

const readAscii = (view: DataView, offset: number, length: number) => {
  if (!inBounds(view, offset, length)) return "";
  let output = "";
  for (let index = 0; index < length; index += 1) {
    const code = view.getUint8(offset + index);
    if (code === 0) break;
    output += String.fromCharCode(code);
  }
  return output;
};

const readUint16 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 2)) return null;
  return view.getUint16(offset, littleEndian);
};

const readUint32 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 4)) return null;
  return view.getUint32(offset, littleEndian);
};

const getIfdEntryOffset = (
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  tagId: number,
  littleEndian: boolean
) => {
  const entryCount = readUint16(view, tiffStart + ifdOffset, littleEndian);
  if (entryCount == null) return null;

  const entriesStart = tiffStart + ifdOffset + 2;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesStart + index * 12;
    const currentTag = readUint16(view, entryOffset, littleEndian);
    if (currentTag == null) return null;
    if (currentTag === tagId) return entryOffset;
  }

  return null;
};

const getEntryValueInfo = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
) => {
  const type = readUint16(view, entryOffset + 2, littleEndian);
  const count = readUint32(view, entryOffset + 4, littleEndian);
  if (type == null || count == null) return null;

  const unitSize = TYPE_SIZES[type];
  if (!unitSize) return null;

  const byteLength = unitSize * count;
  if (byteLength <= 4) {
    return {
      type,
      count,
      valueOffset: entryOffset + 8,
    };
  }

  const pointer = readUint32(view, entryOffset + 8, littleEndian);
  if (pointer == null) return null;

  return {
    type,
    count,
    valueOffset: tiffStart + pointer,
  };
};

const readAsciiEntry = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
) => {
  const info = getEntryValueInfo(view, tiffStart, entryOffset, littleEndian);
  if (!info || info.type !== 2 || info.count < 1) return "";
  return readAscii(view, info.valueOffset, info.count);
};

const readRationalArray = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
) => {
  const info = getEntryValueInfo(view, tiffStart, entryOffset, littleEndian);
  if (!info || info.type !== 5 || info.count < 1) return [];

  const values: number[] = [];
  for (let index = 0; index < info.count; index += 1) {
    const partOffset = info.valueOffset + index * 8;
    const numerator = readUint32(view, partOffset, littleEndian);
    const denominator = readUint32(view, partOffset + 4, littleEndian);
    if (
      numerator == null ||
      denominator == null ||
      denominator === 0
    ) {
      return [];
    }
    values.push(numerator / denominator);
  }

  return values;
};

const dmsToDecimal = (values: number[], ref: string) => {
  if (values.length < 3) return null;
  const [degrees, minutes, seconds] = values;
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(decimal)) return null;
  if (ref === "S" || ref === "W") return -decimal;
  return decimal;
};

const parseExifGpsFromJpeg = (view: DataView): GpsCoords | null => {
  if (!inBounds(view, 0, 2) || view.getUint16(0) !== JPEG_SOI) return null;

  let offset = 2;
  while (inBounds(view, offset, 4)) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;

    if (marker === SOS_MARKER || marker === EOI_MARKER) break;

    const segmentLength = readUint16(view, offset, false);
    if (segmentLength == null || segmentLength < 2) return null;

    const segmentDataOffset = offset + 2;
    const segmentDataLength = segmentLength - 2;
    if (!inBounds(view, segmentDataOffset, segmentDataLength)) return null;

    if (
      marker === APP1_MARKER &&
      readAscii(view, segmentDataOffset, 6) === "Exif"
    ) {
      const tiffStart = segmentDataOffset + 6;
      if (!inBounds(view, tiffStart, 8)) return null;

      const endianMark = readAscii(view, tiffStart, 2);
      const littleEndian =
        endianMark === "II" ? true : endianMark === "MM" ? false : null;
      if (littleEndian == null) return null;

      const magic = readUint16(view, tiffStart + 2, littleEndian);
      if (magic !== TIFF_MAGIC) return null;

      const firstIfdOffset = readUint32(view, tiffStart + 4, littleEndian);
      if (firstIfdOffset == null) return null;

      const gpsPointerEntry = getIfdEntryOffset(
        view,
        tiffStart,
        firstIfdOffset,
        GPS_INFO_IFD_POINTER,
        littleEndian
      );
      if (gpsPointerEntry == null) return null;

      const gpsIfdOffset = readUint32(view, gpsPointerEntry + 8, littleEndian);
      if (gpsIfdOffset == null) return null;

      const latRefEntry = getIfdEntryOffset(
        view,
        tiffStart,
        gpsIfdOffset,
        GPS_LATITUDE_REF,
        littleEndian
      );
      const latEntry = getIfdEntryOffset(
        view,
        tiffStart,
        gpsIfdOffset,
        GPS_LATITUDE,
        littleEndian
      );
      const lngRefEntry = getIfdEntryOffset(
        view,
        tiffStart,
        gpsIfdOffset,
        GPS_LONGITUDE_REF,
        littleEndian
      );
      const lngEntry = getIfdEntryOffset(
        view,
        tiffStart,
        gpsIfdOffset,
        GPS_LONGITUDE,
        littleEndian
      );

      if (
        latRefEntry == null ||
        latEntry == null ||
        lngRefEntry == null ||
        lngEntry == null
      ) {
        return null;
      }

      const latRef = readAsciiEntry(view, tiffStart, latRefEntry, littleEndian)
        .trim()
        .toUpperCase();
      const lngRef = readAsciiEntry(view, tiffStart, lngRefEntry, littleEndian)
        .trim()
        .toUpperCase();
      const lat = dmsToDecimal(
        readRationalArray(view, tiffStart, latEntry, littleEndian),
        latRef
      );
      const lng = dmsToDecimal(
        readRationalArray(view, tiffStart, lngEntry, littleEndian),
        lngRef
      );

      if (
        lat == null ||
        lng == null ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) {
        return null;
      }

      return {
        lat: asRoundedCoord(lat),
        lng: asRoundedCoord(lng),
      };
    }

    offset += segmentLength;
  }

  return null;
};

export async function extractPhotoGps(file: Blob): Promise<GpsCoords | null> {
  try {
    const buffer = await file.arrayBuffer();
    return parseExifGpsFromJpeg(new DataView(buffer));
  } catch {
    return null;
  }
}
