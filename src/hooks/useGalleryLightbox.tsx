import { useCallback, useEffect, useRef, useState } from "react";
import { createSignedUrls } from "../services/storage.service";
import type { GalleryItem } from "../lib/photos";

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

const getThumbPath = (item: GalleryItem) => item.thumbPath || item.imagePath;

export function useGalleryLightbox(bucket: string) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});
  const signedImagesRef = useRef<Record<string, string>>({});
  const signedThumbsRef = useRef<Record<string, string>>({});

  const open = items.length > 0;

  const openGallery = useCallback((nextItems: GalleryItem[], startIndex = 0) => {
    if (!nextItems || nextItems.length === 0) return;
    setItems(nextItems);
    setActiveIndex(clampIndex(startIndex, nextItems.length));
    setSignedImages({});
    setSignedThumbs({});
    signedImagesRef.current = {};
    signedThumbsRef.current = {};
  }, []);

  const closeGallery = useCallback(() => {
    setItems([]);
    setActiveIndex(0);
    setSignedImages({});
    setSignedThumbs({});
    signedImagesRef.current = {};
    signedThumbsRef.current = {};
  }, []);

  const updateSignedImages = useCallback((updater: (prev: Record<string, string>) => Record<string, string>) => {
    setSignedImages((prev) => {
      const next = updater(prev);
      signedImagesRef.current = next;
      return next;
    });
  }, []);

  const updateSignedThumbs = useCallback((updater: (prev: Record<string, string>) => Record<string, string>) => {
    setSignedThumbs((prev) => {
      const next = updater(prev);
      signedThumbsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const thumbPaths = Array.from(
        new Set(
          items
            .map((item) => getThumbPath(item))
            .filter((path): path is string => Boolean(path))
        )
      );
      if (thumbPaths.length === 0) return;

      const urlMap = await createSignedUrls(bucket, thumbPaths, 86400);
      if (cancelled) return;

      updateSignedThumbs((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          const path = getThumbPath(item);
          if (!path) return;
          const url = urlMap[path];
          if (url) next[item.key] = url;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, items, open, updateSignedThumbs]);

  const signFullForIndices = useCallback(
    async (indices: number[]) => {
      const needed: Array<{ key: string; path: string }> = [];

      indices.forEach((index) => {
        if (index < 0 || index >= items.length) return;
        const item = items[index];
        const path = item.imagePath;
        if (!path) return;
        if (signedImagesRef.current[item.key]) return;
        needed.push({ key: item.key, path });
      });

      if (needed.length === 0) return;
      const uniquePaths = Array.from(new Set(needed.map((item) => item.path)));
      const urlMap = await createSignedUrls(bucket, uniquePaths, 86400);

      updateSignedImages((prev) => {
        const next = { ...prev };
        needed.forEach(({ key, path }) => {
          const url = urlMap[path];
          if (url) next[key] = url;
        });
        return next;
      });
    },
    [bucket, items, updateSignedImages]
  );

  useEffect(() => {
    if (!open) return;
    signFullForIndices([activeIndex - 1, activeIndex, activeIndex + 1]);
  }, [activeIndex, open, signFullForIndices]);

  return {
    open,
    items,
    activeIndex,
    signedImages,
    signedThumbs,
    openGallery,
    closeGallery,
    setActiveIndex: (index: number) => setActiveIndex(clampIndex(index, items.length)),
  };
}
