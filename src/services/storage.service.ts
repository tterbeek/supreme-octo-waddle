import { supabase } from "../supabaseClient";

export async function createSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 86400
) {
  const results = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      if (error) {
        console.warn(`[storage] createSignedUrl failed (${bucket}/${path}): ${error.message}`);
        return [path, null] as const;
      }
      return [path, data?.signedUrl || null] as const;
    })
  );

  const map: Record<string, string> = {};
  results.forEach(([path, url]) => {
    if (url) map[path] = url;
  });
  return map;
}
