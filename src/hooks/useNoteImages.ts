import { useCallback, useEffect, useRef, useState } from "react";
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
  const requestIdRef = useRef(0);

  const resolveFor = useCallback(
    (activities: any[]) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      const withAnyImages = activities.filter(
        (a) => a.note_image_url || a.note_thumb_image_url
      );
      if (withAnyImages.length === 0) {
        setSignedNoteImages({});
        setSignedNoteThumbs({});
        return () => {
          if (requestIdRef.current === requestId) {
            requestIdRef.current += 1;
          }
        };
      }

      const ordered = sortByDateAndCreated(withAnyImages);

      (async () => {
        const thumbPaths = ordered
          .map((item) => item.note_thumb_image_url || item.note_image_url)
          .filter((path): path is string => Boolean(path));
        const fullPaths = ordered
          .map((item) => item.note_image_url)
          .filter((path): path is string => Boolean(path));

        const [thumbUrlMap, fullUrlMap] = await Promise.all([
          signStorageValues(thumbPaths, {
            primaryBucket: bucket,
            expiresIn: 86400,
          }),
          signStorageValues(fullPaths, {
            primaryBucket: bucket,
            expiresIn: 86400,
          }),
        ]);

        if (requestIdRef.current !== requestId) return;

        const nextImages: Record<string, string> = {};
        const nextThumbs: Record<string, string> = {};

        ordered.forEach((item) => {
          const thumbPath = item.note_thumb_image_url || item.note_image_url;
          const fullPath = item.note_image_url;
          const fullUrl = fullPath ? fullUrlMap[fullPath] : null;
          const thumbUrl = thumbPath ? thumbUrlMap[thumbPath] : null;

          if (fullUrl) {
            nextImages[item.id] = fullUrl;
          }
          if (thumbUrl || fullUrl) {
            nextThumbs[item.id] = thumbUrl || fullUrl || "";
          }
        });

        setSignedNoteImages(nextImages);
        setSignedNoteThumbs(nextThumbs);
      })();

      return () => {
        if (requestIdRef.current === requestId) {
          requestIdRef.current += 1;
        }
      };
    },
    [bucket]
  );

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
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
