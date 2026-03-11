import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { signStorageValues } from "../services/storage.service";

const sortByDateAndCreated = (items: any[]) =>
  [...items].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const bCreated =
      (b.created_at && new Date(b.created_at).getTime()) ||
      (b.inserted_at && new Date(b.inserted_at).getTime()) ||
      (b.updated_at && new Date(b.updated_at).getTime()) ||
      0;
    const aCreated =
      (a.created_at && new Date(a.created_at).getTime()) ||
      (a.inserted_at && new Date(a.inserted_at).getTime()) ||
      (a.updated_at && new Date(a.updated_at).getTime()) ||
      0;

    return bCreated - aCreated;
  });

export function useNoteImages(bucket: string) {
  const [signedNoteImages, setSignedNoteImages] = useState<Record<string, string>>({});
  const [signedNoteThumbs, setSignedNoteThumbs] = useState<Record<string, string>>({});
  const [noteImageOrientation, setNoteImageOrientation] = useState<
    Record<string, "portrait" | "landscape">
  >({});

  const resolveFor = useCallback(
    (activities: any[]) => {
      const withAnyImages = activities.filter(
        (a) => a.note_image_url || a.note_thumb_image_url
      );
      if (withAnyImages.length === 0) {
        setSignedNoteImages({});
        setSignedNoteThumbs({});
        return () => {};
      }

      const ordered = sortByDateAndCreated(withAnyImages);
      const idsWithImages = new Set(ordered.map((a) => a.id));

      // Drop any stale entries from previous runs so state only contains
      // images that are still visible in the current feed.
      setSignedNoteImages((prev) => {
        const next: Record<string, string> = {};
        Object.entries(prev).forEach(([id, url]) => {
          if (idsWithImages.has(id)) next[id] = url;
        });
        return next;
      });
      setSignedNoteThumbs((prev) => {
        const next: Record<string, string> = {};
        Object.entries(prev).forEach(([id, url]) => {
          if (idsWithImages.has(id)) next[id] = url;
        });
        return next;
      });

      let cancelled = false;
      (async () => {
        const thumbItems = ordered.filter(
          (a) => a.note_thumb_image_url || a.note_image_url
        );
        const fullItems = ordered.filter((a) => a.note_image_url);

        const fetchUrls = async (
          items: any[],
          selector: (item: any) => string,
          setter: Dispatch<SetStateAction<Record<string, string>>>
        ): Promise<Record<string, string>> => {
          const collected: Record<string, string> = {};
          if (items.length === 0) return collected;

          const [newest, ...rest] = items;
          const newestPath = selector(newest);
          if (newestPath) {
            const newestUrl = await signStorageValues([newestPath], {
              primaryBucket: bucket,
              expiresIn: 86400,
            });
            if (!cancelled) {
              const url = newestUrl[newestPath];
              if (url) {
                collected[newest.id] = url;
                setter((prev) => ({
                  ...prev,
                  [newest.id]: url,
                }));
              }
            }
          }

          if (rest.length > 0) {
            const restPaths = rest.map(selector).filter(Boolean);
            if (restPaths.length === 0) return collected;

            const restUrlMap = await signStorageValues(restPaths, {
              primaryBucket: bucket,
              expiresIn: 86400,
            });
            if (cancelled) return collected;

            setter((prev) => {
              const next = { ...prev };
              rest.forEach((item) => {
                const path = selector(item);
                if (!path) return;
                const url = restUrlMap[path];
                if (!url) return;
                collected[item.id] = url;
                next[item.id] = url;
              });
              return next;
            });
          }

          return collected;
        };

        await fetchUrls(
          thumbItems,
          (item) => item.note_thumb_image_url || item.note_image_url,
          setSignedNoteThumbs
        );

        const fullUrls = await fetchUrls(
          fullItems,
          (item) => item.note_image_url,
          setSignedNoteImages
        );

        // Ensure we at least have a thumbnail URL even if no dedicated thumb exists.
        setSignedNoteThumbs((prev) => {
          const next = { ...prev };
          fullItems.forEach((item) => {
            if (!next[item.id]) {
              const url = fullUrls[item.id];
              if (url) {
                next[item.id] = url;
              }
            }
          });
          return next;
        });
      })();

      return () => {
        cancelled = true;
      };
    },
    [bucket]
  );

  useEffect(() => {
    return () => {
      setSignedNoteImages({});
      setSignedNoteThumbs({});
      setNoteImageOrientation({});
    };
  }, []);

  return {
    signedNoteImages,
    signedNoteThumbs,
    noteImageOrientation,
    setNoteImageOrientation,
    resolveFor,
  };
}
