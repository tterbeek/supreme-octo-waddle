import { supabase } from "../supabaseClient";

export const NOTE_STORAGE_BUCKET = "actvity-notes";
export const LEGACY_NOTE_STORAGE_BUCKET = "activity-notes";
const SIGNED_URL_SAFETY_WINDOW_SECONDS = 30;
const SIGNED_URL_CACHE = new Map<string, { url: string; expiresAtMs: number }>();

const nowMs = () => Date.now();
const cacheKey = (bucket: string, path: string) => `${bucket}:${path}`;
const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function normalizeStoragePath(
  value: string,
  acceptedBuckets: string[] = [NOTE_STORAGE_BUCKET, LEGACY_NOTE_STORAGE_BUCKET]
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  if (!withoutQuery.startsWith("http")) {
    const decoded = safeDecode(withoutQuery).replace(/^\/+/, "");
    for (const bucket of acceptedBuckets) {
      const prefix = `${bucket}/`;
      if (decoded.startsWith(prefix)) {
        return decoded.slice(prefix.length) || null;
      }
    }
    return decoded || null;
  }

  try {
    const url = new URL(withoutQuery);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/);
    if (!match?.[2]) return null;
    const bucket = match[1];
    if (acceptedBuckets.length > 0 && !acceptedBuckets.includes(bucket)) return null;
    const normalized = safeDecode(match[2]).replace(/^\/+/, "");
    return normalized || null;
  } catch {
    return null;
  }
}

export async function createSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 86400
) {
  const map: Record<string, string> = {};
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (!uniquePaths.length) return map;

  const unresolved: string[] = [];
  for (const path of uniquePaths) {
    const cached = SIGNED_URL_CACHE.get(cacheKey(bucket, path));
    if (
      cached &&
      cached.expiresAtMs - SIGNED_URL_SAFETY_WINDOW_SECONDS * 1000 > nowMs()
    ) {
      map[path] = cached.url;
    } else {
      unresolved.push(path);
    }
  }

  if (!unresolved.length) return map;

  for (const batch of chunk(unresolved, 100)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(batch, expiresIn);

    if (error) {
      // Fallback to per-path calls so one bad object doesn't fail the whole batch.
      const fallbackResults = await Promise.all(
        batch.map(async (path) => {
          const single = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);
          if (single.error) {
            console.warn(
              `[storage] createSignedUrl failed (${bucket}/${path}): ${single.error.message}`
            );
            return [path, null] as const;
          }
          return [path, single.data?.signedUrl || null] as const;
        })
      );
      fallbackResults.forEach(([path, url]) => {
        if (!url) return;
        map[path] = url;
        SIGNED_URL_CACHE.set(cacheKey(bucket, path), {
          url,
          expiresAtMs: nowMs() + expiresIn * 1000,
        });
      });
      continue;
    }

    for (const row of data || []) {
      if (!row.path) continue;
      if ((row as any).error) {
        console.warn(
          `[storage] createSignedUrls failed (${bucket}/${row.path}): ${(row as any).error}`
        );
        continue;
      }
      if (!row.signedUrl) continue;
      map[row.path] = row.signedUrl;
      SIGNED_URL_CACHE.set(cacheKey(bucket, row.path), {
        url: row.signedUrl,
        expiresAtMs: nowMs() + expiresIn * 1000,
      });
    }
  }

  return map;
}

export async function signStorageValues(
  rawValues: string[],
  options?: {
    primaryBucket?: string;
    fallbackBuckets?: string[];
    expiresIn?: number;
  }
) {
  const primaryBucket = options?.primaryBucket || NOTE_STORAGE_BUCKET;
  const fallbackBuckets = options?.fallbackBuckets || [LEGACY_NOTE_STORAGE_BUCKET];
  const expiresIn = options?.expiresIn ?? 86400;

  const uniqueRaw = Array.from(
    new Set(
      rawValues
        .filter((value) => typeof value === "string")
        .filter((value) => value.trim().length > 0)
    )
  );

  if (uniqueRaw.length === 0) return {} as Record<string, string>;

  const pathByRaw: Record<string, string | null> = {};
  uniqueRaw.forEach((raw) => {
    pathByRaw[raw] = normalizeStoragePath(raw, [primaryBucket, ...fallbackBuckets]);
  });

  const signedByRaw: Record<string, string> = {};

  const uniquePaths = Array.from(
    new Set(
      Object.values(pathByRaw).filter(
        (path): path is string => Boolean(path && path.length > 0)
      )
    )
  );

  const signedByPath: Record<string, string> = {};
  if (uniquePaths.length > 0) {
    const primarySigned = await createSignedUrls(primaryBucket, uniquePaths, expiresIn);
    Object.assign(signedByPath, primarySigned);

    let unresolved = uniquePaths.filter((path) => !signedByPath[path]);
    for (const bucket of fallbackBuckets) {
      if (!unresolved.length) break;
      if (bucket === primaryBucket) continue;
      const fallbackSigned = await createSignedUrls(bucket, unresolved, expiresIn);
      Object.entries(fallbackSigned).forEach(([path, url]) => {
        if (url) signedByPath[path] = url;
      });
      unresolved = unresolved.filter((path) => !signedByPath[path]);
    }
  }

  uniqueRaw.forEach((raw) => {
    const path = pathByRaw[raw];
    if (path && signedByPath[path]) {
      signedByRaw[raw] = signedByPath[path];
      return;
    }
    if (raw.startsWith("http")) {
      signedByRaw[raw] = raw;
    }
  });

  return signedByRaw;
}
