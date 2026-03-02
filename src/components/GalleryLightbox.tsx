import { useEffect, useRef, useState, type SyntheticEvent, type TouchEvent } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import type { GalleryItem } from "../lib/photos";
import { formatActivityMeta, getActivityNoteText } from "../lib/photos";

const SWIPE_THRESHOLD = 50;

type GalleryLightboxProps = {
  open: boolean;
  items: GalleryItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  signedImages: Record<string, string>;
  signedThumbs: Record<string, string>;
  showDots?: boolean;
};

export default function GalleryLightbox({
  open,
  items,
  activeIndex,
  onActiveIndexChange,
  onClose,
  signedImages,
  signedThumbs,
  showDots = true,
}: GalleryLightboxProps) {
  const [chromeVisible, setChromeVisible] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [fullReady, setFullReady] = useState<Record<string, boolean>>({});
  const [isClosing, setIsClosing] = useState(false);
  const ignoreClickRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());
  const closeTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>(
    {}
  );

  const activeItem = items[activeIndex];

  const activeFullImage = activeItem ? signedImages[activeItem.key] : "";
  const activeThumbImage = activeItem
    ? signedThumbs[activeItem.key] || signedImages[activeItem.key]
    : "";
  const activeImage =
    activeItem && activeFullImage && fullReady[activeItem.key]
      ? activeFullImage
      : activeThumbImage || activeFullImage;

  const activeNoteText = activeItem ? getActivityNoteText(activeItem.activity) : "";
  const activeMeta = activeItem ? formatActivityMeta(activeItem.activity) : "";
  const dotsVisible = showDots && items.length > 1;

  useEffect(() => {
    if (!open) {
      setChromeVisible(false);
      setNoteExpanded(false);
      setFullReady({});
      preloadedRef.current.clear();
      setIsClosing(false);
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      return;
    }
    setChromeVisible(false);
    setNoteExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNoteExpanded(false);
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, 180);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isClosing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (activeIndex > 0) onActiveIndexChange(activeIndex - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (activeIndex < items.length - 1) onActiveIndexChange(activeIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, isClosing, items.length, onActiveIndexChange, open, requestClose]);

  useEffect(() => {
    if (!open || !activeItem) return;

    const preload = (item: GalleryItem | undefined) => {
      if (!item) return;
      const url = signedImages[item.key];
      if (!url) return;
      if (preloadedRef.current.has(item.key)) return;
      preloadedRef.current.add(item.key);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      img.onload = () => {
        setFullReady((prev) => ({ ...prev, [item.key]: true }));
      };
      img.onerror = () => {
        preloadedRef.current.delete(item.key);
      };
    };

    const prevItem = items[activeIndex - 1];
    const nextItem = items[activeIndex + 1];

    preload(activeItem);
    preload(prevItem);
    preload(nextItem);
  }, [activeIndex, activeItem, items, open, signedImages]);

  const handleTap = () => {
    if (isClosing) return;
    setChromeVisible((prev) => !prev);
  };

  const isPointInsideImage = (clientX: number, clientY: number) => {
    if (!containerRef.current || !activeItem) return true;
    const size = imageSizes[activeItem.key];
    if (!size || !size.w || !size.h) return true;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / size.w, rect.height / size.h);
    const displayW = size.w * scale;
    const displayH = size.h * scale;
    const offsetX = rect.left + (rect.width - displayW) / 2;
    const offsetY = rect.top + (rect.height - displayH) / 2;
    return (
      clientX >= offsetX &&
      clientX <= offsetX + displayW &&
      clientY >= offsetY &&
      clientY <= offsetY + displayH
    );
  };

  const shouldCloseAtPoint = (clientX: number, clientY: number, target?: EventTarget | null) => {
    if (isClosing) return false;
    if (target && target instanceof HTMLElement) {
      if (target.closest("[data-gallery-ui]")) return false;
    }
    return !isPointInsideImage(clientX, clientY);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (isClosing) return;
    const touch = event.touches[0];
    if (!touch) return;
    ignoreClickRef.current = true;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (isClosing) return;
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 10 && absY < 10) {
      if (shouldCloseAtPoint(touch.clientX, touch.clientY, event.target)) {
        requestClose();
        return;
      }
      handleTap();
      return;
    }

    if (absX > absY && absX > SWIPE_THRESHOLD) {
      if (dx < 0) {
        if (activeIndex < items.length - 1) onActiveIndexChange(activeIndex + 1);
      } else if (dx > 0) {
        if (activeIndex > 0) onActiveIndexChange(activeIndex - 1);
      }
      return;
    }

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      setChromeVisible(true);
      setNoteExpanded(dy < 0);
    }
  };

  const handleOverlayClick = (event: SyntheticEvent) => {
    if (isClosing) return;
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    const mouseEvent = event as unknown as { clientX?: number; clientY?: number; target?: EventTarget };
    const clientX = mouseEvent.clientX;
    const clientY = mouseEvent.clientY;
    if (clientX != null && clientY != null) {
      if (shouldCloseAtPoint(clientX, clientY, mouseEvent.target)) {
        requestClose();
        return;
      }
    }
    handleTap();
  };

  const handleBackClose = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  };

  const hasItems = open && items.length > 0;

  const content = hasItems ? (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] bg-black text-white"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {activeImage ? (
        <img
          ref={imageRef}
          src={activeImage}
          alt="Activity"
          className="h-full w-full object-contain"
          draggable={false}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (!activeItem || !img.naturalWidth || !img.naturalHeight) return;
            setImageSizes((prev) => ({
              ...prev,
              [activeItem.key]: { w: img.naturalWidth, h: img.naturalHeight },
            }));
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-white/70">
          Loading photo...
        </div>
      )}

      {chromeVisible && (
        <>
          <button
            type="button"
            onClick={handleBackClose}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerUp={handleBackClose}
            onTouchStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onTouchEnd={handleBackClose}
            className="absolute top-4 left-4 rounded-full bg-black/40 p-2 text-white/90 backdrop-blur"
            aria-label="Back"
            data-gallery-ui
          >
            <IconArrowLeft size={20} strokeWidth={2} />
          </button>

          <div
            className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
            data-gallery-ui
          >
            {!noteExpanded ? (
              <p
                className="text-sm leading-snug text-white/90"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {activeMeta && (
                  <span className="block font-medium text-white">{activeMeta}</span>
                )}
                {activeNoteText && <span className="block">{activeNoteText}</span>}
              </p>
            ) : (
              <div className="space-y-2">
                {activeMeta && (
                  <div className="text-sm font-medium text-white">{activeMeta}</div>
                )}
                {activeNoteText && (
                  <div className="text-base text-white/90 leading-relaxed max-h-[45vh] overflow-y-auto pr-1">
                    {activeNoteText}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {dotsVisible && (
        <div
          className="absolute bottom-28 sm:bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5"
          data-gallery-ui
        >
          {items.map((item, index) => (
            <span
              key={item.key}
              className={`h-1.5 w-1.5 rounded-full ${
                index === activeIndex ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

  if (!content) return null;

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}
