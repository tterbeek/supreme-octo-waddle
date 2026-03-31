type GpsCoords = {
  lat: number;
  lng: number;
};

type Box = {
  type: string;
  start: number;
  headerSize: number;
  dataStart: number;
  dataEnd: number;
};

type HeifItemLocation = {
  baseOffset: number;
  extents: Array<{
    offset: number;
    length: number;
  }>;
  constructionMethod: number;
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
const isNullIsland = (lat: number, lng: number) =>
  Math.abs(lat) < 1e-7 && Math.abs(lng) < 1e-7;

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

const readUint8 = (view: DataView, offset: number) => {
  if (!inBounds(view, offset, 1)) return null;
  return view.getUint8(offset);
};

const readUint16 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 2)) return null;
  return view.getUint16(offset, littleEndian);
};

const readUint24 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 3)) return null;
  if (littleEndian) {
    return (
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16)
    );
  }
  return (
    (view.getUint8(offset) << 16) |
    (view.getUint8(offset + 1) << 8) |
    view.getUint8(offset + 2)
  );
};

const readUint32 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 4)) return null;
  return view.getUint32(offset, littleEndian);
};

const readUint64 = (view: DataView, offset: number, littleEndian: boolean) => {
  if (!inBounds(view, offset, 8)) return null;

  const left = readUint32(view, offset + (littleEndian ? 4 : 0), littleEndian);
  const right = readUint32(view, offset + (littleEndian ? 0 : 4), littleEndian);
  if (left == null || right == null) return null;

  return littleEndian ? right * 2 ** 32 + left : left * 2 ** 32 + right;
};

const readSizedUint = (
  view: DataView,
  offset: number,
  byteLength: number,
  littleEndian: boolean
) => {
  if (byteLength === 0) return 0;
  if (byteLength === 1) return readUint8(view, offset);
  if (byteLength === 2) return readUint16(view, offset, littleEndian);
  if (byteLength === 3) return readUint24(view, offset, littleEndian);
  if (byteLength === 4) return readUint32(view, offset, littleEndian);
  if (byteLength === 8) return readUint64(view, offset, littleEndian);
  return null;
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
    if (numerator == null || denominator == null || denominator === 0) {
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

const parseExifGpsFromTiff = (view: DataView, tiffStart: number): GpsCoords | null => {
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
      return parseExifGpsFromTiff(view, segmentDataOffset + 6);
    }

    offset += segmentLength;
  }

  return null;
};

const readBox = (view: DataView, offset: number): Box | null => {
  if (!inBounds(view, offset, 8)) return null;

  const size32 = readUint32(view, offset, false);
  const type = readAscii(view, offset + 4, 4);
  if (size32 == null || !type) return null;

  let headerSize = 8;
  let size = size32;

  if (size32 === 1) {
    const largesize = readUint64(view, offset + 8, false);
    if (largesize == null || !Number.isFinite(largesize)) return null;
    size = largesize;
    headerSize = 16;
  } else if (size32 === 0) {
    size = view.byteLength - offset;
  }

  if (size < headerSize) return null;

  const dataStart = offset + headerSize;
  const dataEnd = offset + size;
  if (!inBounds(view, offset, size)) return null;

  return {
    type,
    start: offset,
    headerSize,
    dataStart,
    dataEnd,
  };
};

const findChildBoxes = (
  view: DataView,
  start: number,
  end: number,
  options?: { skipFullBoxHeader?: boolean }
) => {
  const boxes: Box[] = [];
  let offset = start + (options?.skipFullBoxHeader ? 4 : 0);
  while (offset + 8 <= end) {
    const box = readBox(view, offset);
    if (!box || box.dataEnd > end || box.dataEnd <= offset) break;
    boxes.push(box);
    offset = box.dataEnd;
  }
  return boxes;
};

const findTopLevelBox = (view: DataView, type: string) => {
  const boxes = findChildBoxes(view, 0, view.byteLength);
  return boxes.find((box) => box.type === type) ?? null;
};

const isHeifLike = (view: DataView) => {
  const ftyp = findTopLevelBox(view, "ftyp");
  if (!ftyp || ftyp.dataEnd - ftyp.dataStart < 8) return false;

  const brand = readAscii(view, ftyp.dataStart, 4);
  const compatible: string[] = [];
  for (let offset = ftyp.dataStart + 8; offset + 4 <= ftyp.dataEnd; offset += 4) {
    compatible.push(readAscii(view, offset, 4));
  }

  const allBrands = [brand, ...compatible];
  return allBrands.some((value) =>
    ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(value)
  );
};

const parseIinfExifItemIds = (view: DataView, box: Box) => {
  const version = readUint8(view, box.dataStart);
  if (version == null) return new Set<number>();

  const entryCountOffset = box.dataStart + 4;
  const entryCount =
    version === 0
      ? readUint16(view, entryCountOffset, false)
      : readUint32(view, entryCountOffset, false);
  if (entryCount == null) return new Set<number>();

  const itemIds = new Set<number>();
  const children = findChildBoxes(view, entryCountOffset + (version === 0 ? 2 : 4), box.dataEnd);
  for (const child of children.slice(0, entryCount)) {
    if (child.type !== "infe") continue;

    const infeVersion = readUint8(view, child.dataStart);
    if (infeVersion == null) continue;

    let cursor = child.dataStart + 4;
    let itemId: number | null = null;
    if (infeVersion >= 2) {
      itemId =
        infeVersion === 2
          ? readUint16(view, cursor, false)
          : readUint32(view, cursor, false);
      cursor += infeVersion === 2 ? 2 : 4;
      cursor += 2; // item protection index
      const itemType = readAscii(view, cursor, 4);
      if (itemId != null && itemType === "Exif") {
        itemIds.add(itemId);
      }
      continue;
    }

    itemId = readUint16(view, cursor, false);
    cursor += 2;
    cursor += 2; // item protection index
    const itemName = readAscii(view, cursor, Math.max(0, child.dataEnd - cursor));
    if (itemId != null && itemName.startsWith("Exif")) {
      itemIds.add(itemId);
    }
  }

  return itemIds;
};

const parseIloc = (view: DataView, box: Box) => {
  const version = readUint8(view, box.dataStart);
  const sizes = readUint8(view, box.dataStart + 4);
  const sizeByte = readUint8(view, box.dataStart + 5);
  if (version == null || sizes == null || sizeByte == null) {
    return new Map<number, HeifItemLocation>();
  }

  const offsetSize = (sizes >> 4) & 0x0f;
  const lengthSize = sizes & 0x0f;
  const baseOffsetSize = (sizeByte >> 4) & 0x0f;
  const indexSize = sizeByte & 0x0f;

  let cursor = box.dataStart + 6;
  const itemCount =
    version < 2
      ? readUint16(view, cursor, false)
      : readUint32(view, cursor, false);
  if (itemCount == null) return new Map<number, HeifItemLocation>();

  cursor += version < 2 ? 2 : 4;

  const locations = new Map<number, HeifItemLocation>();

  for (let index = 0; index < itemCount; index += 1) {
    const itemId =
      version < 2
        ? readUint16(view, cursor, false)
        : readUint32(view, cursor, false);
    if (itemId == null) break;
    cursor += version < 2 ? 2 : 4;

    let constructionMethod = 0;
    if (version === 1 || version === 2) {
      const rawConstructionMethod = readUint16(view, cursor, false);
      if (rawConstructionMethod == null) break;
      constructionMethod = rawConstructionMethod & 0x000f;
      cursor += 2;
    }

    cursor += 2; // data_reference_index

    const baseOffset = readSizedUint(view, cursor, baseOffsetSize, false);
    if (baseOffset == null) break;
    cursor += baseOffsetSize;

    const extentCount = readUint16(view, cursor, false);
    if (extentCount == null) break;
    cursor += 2;

    const extents: HeifItemLocation["extents"] = [];
    for (let extentIndex = 0; extentIndex < extentCount; extentIndex += 1) {
      if ((version === 1 || version === 2) && indexSize > 0) {
        const itemIndex = readSizedUint(view, cursor, indexSize, false);
        if (itemIndex == null) break;
        cursor += indexSize;
      }

      const extentOffset = readSizedUint(view, cursor, offsetSize, false);
      if (extentOffset == null) break;
      cursor += offsetSize;

      const extentLength = readSizedUint(view, cursor, lengthSize, false);
      if (extentLength == null) break;
      cursor += lengthSize;

      extents.push({
        offset: extentOffset,
        length: extentLength,
      });
    }

    locations.set(itemId, {
      baseOffset,
      extents,
      constructionMethod,
    });
  }

  return locations;
};

const parseHeifExifGps = (view: DataView): GpsCoords | null => {
  if (!isHeifLike(view)) return null;

  const meta = findTopLevelBox(view, "meta");
  if (!meta) return null;

  const children = findChildBoxes(view, meta.dataStart, meta.dataEnd, {
    skipFullBoxHeader: true,
  });

  const iinf = children.find((box) => box.type === "iinf");
  const iloc = children.find((box) => box.type === "iloc");
  if (!iinf || !iloc) return null;

  const exifItemIds = parseIinfExifItemIds(view, iinf);
  if (exifItemIds.size === 0) return null;

  const locations = parseIloc(view, iloc);
  const idat = children.find((box) => box.type === "idat") ?? null;

  for (const itemId of exifItemIds) {
    const location = locations.get(itemId);
    if (!location || location.extents.length === 0) continue;

    const extent = location.extents[0];
    const dataStart =
      location.constructionMethod === 1 && idat
        ? idat.dataStart + location.baseOffset + extent.offset
        : location.baseOffset + extent.offset;
    const dataLength = extent.length;
    if (!Number.isFinite(dataStart) || !Number.isFinite(dataLength) || dataLength <= 0) {
      continue;
    }
    if (!inBounds(view, dataStart, dataLength)) continue;

    const offsetToTiff = readUint32(view, dataStart, false);
    const candidateStarts = [
      dataStart + 4 + (offsetToTiff ?? 0),
      dataStart + (offsetToTiff ?? 0),
      dataStart + 4,
    ];

    for (const candidateStart of candidateStarts) {
      const coords = parseExifGpsFromTiff(view, candidateStart);
      if (coords) return coords;
    }
  }

  return null;
};

export async function extractPhotoGps(file: Blob): Promise<GpsCoords | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const coords = parseExifGpsFromJpeg(view) || parseHeifExifGps(view);
    if (!coords) return null;
    if (isNullIsland(coords.lat, coords.lng)) return null;
    return coords;
  } catch {
    return null;
  }
}
