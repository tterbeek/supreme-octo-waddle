import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useLayoutChrome } from "../contexts/LayoutChromeContext";
import { getCurrentUser } from "../services/auth.service";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import { createSignedUrls } from "../services/storage.service";
import {
  buildGalleryItemsForActivities,
  getActivityDateValue,
  getActivityPhotos,
} from "../lib/photos";

const NOTE_BUCKET = "actvity-notes";

export default function PhotosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const suppressGridTapUntilRef = useRef(0);
  const { setChromeHidden } = useLayoutChrome();
  const [photoThumbs, setPhotoThumbs] = useState<Record<string, string>>({});
  const signedPathsRef = useRef<Set<string>>(new Set());

  const { activities, initialFeedLoaded, loadMore, hasMoreFeed, isLoading } =
    useHomeFeed(userId);
  const gallery = useGalleryLightbox(NOTE_BUCKET);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
    };

    load();
  }, []);

  useEffect(() => {
    setChromeHidden(gallery.open);
    return () => setChromeHidden(false);
  }, [gallery.open, setChromeHidden]);

  const handleCloseGallery = useCallback(() => {
    gallery.closeGallery();
    suppressGridTapUntilRef.current = Date.now() + 400;
  }, [gallery]);

  const photoActivities = useMemo(
    () => activities.filter((activity) => getActivityPhotos(activity).length > 0),
    [activities]
  );

  const orderedPhotos = useMemo(() => {
    return [...photoActivities].sort(
      (a, b) => getActivityDateValue(b) - getActivityDateValue(a)
    );
  }, [photoActivities]);

  const galleryItems = useMemo(
    () => buildGalleryItemsForActivities(orderedPhotos),
    [orderedPhotos]
  );

  useEffect(() => {
    if (!initialFeedLoaded) return;
    if (galleryItems.length >= 12) return;
    if (!hasMoreFeed || isLoading) return;
    loadMore();
  }, [galleryItems.length, hasMoreFeed, initialFeedLoaded, isLoading, loadMore]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    if (!hasMoreFeed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoading) return;
        loadMore();
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreFeed, isLoading, loadMore]);

  useEffect(() => {
    let cancelled = false;
    const signThumbs = async () => {
      const paths = Array.from(
        new Set(
          galleryItems
            .map((item) => item.thumbPath || item.imagePath)
            .filter((path): path is string => Boolean(path))
        )
      );
      const unsigned = paths.filter((path) => !signedPathsRef.current.has(path));
      if (unsigned.length === 0) return;

      const urlMap = await createSignedUrls(NOTE_BUCKET, unsigned, 86400);
      if (cancelled) return;

      unsigned.forEach((path) => signedPathsRef.current.add(path));
      setPhotoThumbs((prev) => {
        const next = { ...prev };
        galleryItems.forEach((item) => {
          const path = item.thumbPath || item.imagePath;
          if (!path) return;
          const url = urlMap[path];
          if (url) next[item.key] = url;
        });
        return next;
      });
    };

    signThumbs();
    return () => {
      cancelled = true;
    };
  }, [galleryItems]);

  const openViewer = (startIndex: number) => {
    if (galleryItems.length === 0) return;
    gallery.openGallery(galleryItems, startIndex);
  };

  const hasPhotos = galleryItems.length > 0;

  return (
    <div className="min-h-screen bg-movenotes-bg p-2">
      <div className="mt-2">
        {hasPhotos ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galleryItems.map((item, index) => {
                const thumbUrl = photoThumbs[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (Date.now() < suppressGridTapUntilRef.current) return;
                      openViewer(index);
                    }}
                    className="relative aspect-square overflow-hidden rounded-xl border border-movenotes-border bg-movenotes-surface shadow-sm"
                    aria-label="Open activity photo"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt="Activity"
                        loading="lazy"
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="h-full w-full bg-movenotes-bg" />
                    )}
                  </button>
                );
              })}
            </div>
            <div ref={loadMoreRef} className="h-6" />
          </>
        ) : (
          initialFeedLoaded && (
            <div className="text-center text-movenotes-muted text-sm py-16">
              Photos from your activities will appear here.
            </div>
          )
        )}
      </div>

      <GalleryLightbox
        open={gallery.open}
        items={gallery.items}
        activeIndex={gallery.activeIndex}
        onActiveIndexChange={gallery.setActiveIndex}
        onClose={handleCloseGallery}
        signedImages={gallery.signedImages}
        signedThumbs={gallery.signedThumbs}
        showDots={false}
      />
    </div>
  );
}
