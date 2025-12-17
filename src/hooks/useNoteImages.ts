import { useCallback, useEffect, useState } from "react";
import { createSignedUrls } from "../services/storage.service";

export function useNoteImages(bucket: string) {
  const [signedNoteImages, setSignedNoteImages] = useState<Record<string, string>>({});
  const [noteImageOrientation, setNoteImageOrientation] = useState<
    Record<string, "portrait" | "landscape">
  >({});

  const resolveFor = useCallback(
    (activities: any[]) => {
      const withImages = activities.filter((a) => a.note_image_url);
      if (withImages.length === 0) {
        setSignedNoteImages({});
        return () => {};
      }

      let cancelled = false;
      (async () => {
        const urlMap = await createSignedUrls(
          bucket,
          withImages.map((a) => a.note_image_url as string),
          86400
        );
        if (cancelled) return;
        const map: Record<string, string> = {};
        withImages.forEach((a) => {
          const url = urlMap[a.note_image_url as string];
          if (url) map[a.id] = url;
        });
        setSignedNoteImages(map);
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
      setNoteImageOrientation({});
    };
  }, []);

  return {
    signedNoteImages,
    noteImageOrientation,
    setNoteImageOrientation,
    resolveFor,
  };
}
