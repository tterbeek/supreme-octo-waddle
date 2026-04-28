import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { IconArrowLeft, IconMinus, IconPlus } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import type { GalleryItem } from "../lib/photos";
import { formatActivityMeta, getActivityNoteText } from "../lib/photos";

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
  const preloadedRef = useRef<Set<string>>(new Set());
  const closeTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageStageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportContentRef = useRef<string | null>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>(
    {}
  );
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const zoomScaleRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const touchPanRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pointerPanRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

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
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  const resetZoom = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    zoomScaleRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    touchPanRef.current = null;
    pointerPanRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      setChromeVisible(false);
      setNoteExpanded(false);
      setFullReady({});
      preloadedRef.current.clear();
      setIsClosing(false);
      resetZoom();
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      return;
    }
    setChromeVisible(false);
    setNoteExpanded(false);
    resetZoom();
  }, [open, resetZoom]);

  useEffect(() => {
    if (!open) return;
    setNoteExpanded(false);
    resetZoom();
  }, [activeIndex, open, resetZoom]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return;

    if (viewportContentRef.current == null) {
      viewportContentRef.current = viewportMeta.getAttribute("content");
    }

    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    );

    return () => {
      const previous =
        viewportContentRef.current || "width=device-width, initial-scale=1.0";
      viewportMeta.setAttribute("content", previous);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const target = imageStageRef.current;
    if (!target) return;

    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    target.addEventListener("gesturestart", preventGesture, { passive: false });
    target.addEventListener("gesturechange", preventGesture, { passive: false });
    target.addEventListener("gestureend", preventGesture, { passive: false });

    return () => {
      target.removeEventListener("gesturestart", preventGesture);
      target.removeEventListener("gesturechange", preventGesture);
      target.removeEventListener("gestureend", preventGesture);
    };
  }, [open]);

  const getFittedImageMetrics = useCallback(() => {
    if (!containerRef.current || !activeItem) return null;
    const size = imageSizes[activeItem.key];
    if (!size || !size.w || !size.h) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const baseScale = Math.min(rect.width / size.w, rect.height / size.h);
    const displayW = size.w * baseScale;
    const displayH = size.h * baseScale;
    return {
      rect,
      displayW,
      displayH,
    };
  }, [activeItem, imageSizes]);

  const clampPan = useCallback(
    (nextPan: { x: number; y: number }, scale: number) => {
      if (scale <= 1) {
        return { x: 0, y: 0 };
      }
      const metrics = getFittedImageMetrics();
      if (!metrics) return { x: 0, y: 0 };

      // Allow panning across the enlarged image area even if it still mostly fits
      // within the viewport, so zooming into off-center details feels usable.
      const maxX = Math.max(0, (metrics.displayW * (scale - 1)) / 2);
      const maxY = Math.max(0, (metrics.displayH * (scale - 1)) / 2);

      return {
        x: Math.min(Math.max(nextPan.x, -maxX), maxX),
        y: Math.min(Math.max(nextPan.y, -maxY), maxY),
      };
    },
    [getFittedImageMetrics]
  );

  const requestClose = () => {
    if (isClosing) return;
    resetZoom();
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

  const applyZoomScale = useCallback(
    (nextScale: number) => {
      const clampedScale = Math.min(4, Math.max(1, nextScale));
      setZoomScale(clampedScale);
      setPanOffset((prev) => clampPan(prev, clampedScale));
    },
    [clampPan]
  );

  const zoomIn = useCallback(() => {
    applyZoomScale(zoomScaleRef.current + 0.5);
  }, [applyZoomScale]);

  const zoomOut = useCallback(() => {
    const nextScale = zoomScaleRef.current - 0.5;
    if (nextScale <= 1) {
      resetZoom();
      return;
    }
    applyZoomScale(nextScale);
  }, [applyZoomScale, resetZoom]);

  const isPointInsideImage = (clientX: number, clientY: number) => {
    const metrics = getFittedImageMetrics();
    if (!metrics) return true;
    const displayW = metrics.displayW * zoomScaleRef.current;
    const displayH = metrics.displayH * zoomScaleRef.current;
    const offsetX =
      metrics.rect.left +
      (metrics.rect.width - displayW) / 2 +
      panOffsetRef.current.x;
    const offsetY =
      metrics.rect.top +
      (metrics.rect.height - displayH) / 2 +
      panOffsetRef.current.y;
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

  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (isClosing) return;
    if (event.pointerType !== "mouse" && event.pointerType !== "touch") return;
    if (zoomScaleRef.current <= 1) return;

    event.preventDefault();
    pointerPanRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: panOffsetRef.current.x,
      offsetY: panOffsetRef.current.y,
    };
    imageStageRef.current?.setPointerCapture?.(event.pointerId);
  }, [isClosing]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const activePointer = pointerPanRef.current;
    if (!activePointer) return;
    if (activePointer.pointerId !== event.pointerId) return;
    if (zoomScaleRef.current <= 1) return;

    event.preventDefault();
    const nextPan = clampPan(
      {
        x: activePointer.offsetX + (event.clientX - activePointer.x),
        y: activePointer.offsetY + (event.clientY - activePointer.y),
      },
      zoomScaleRef.current
    );
    setPanOffset(nextPan);
  }, [clampPan]);

  const endPointerPan = useCallback((event: PointerEvent) => {
    const activePointer = pointerPanRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) return;
    imageStageRef.current?.releasePointerCapture?.(event.pointerId);
    pointerPanRef.current = null;
  }, []);

  const handleTouchPanStart = useCallback((event: TouchEvent) => {
    if (isClosing) return;
    if (zoomScaleRef.current <= 1) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!touch) return;

    event.preventDefault();
    touchPanRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      offsetX: panOffsetRef.current.x,
      offsetY: panOffsetRef.current.y,
    };
  }, [isClosing]);

  const handleTouchPanMove = useCallback((event: TouchEvent) => {
    const activeTouchPan = touchPanRef.current;
    if (!activeTouchPan) return;
    if (zoomScaleRef.current <= 1) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!touch) return;

    event.preventDefault();
    const nextPan = clampPan(
      {
        x: activeTouchPan.offsetX + (touch.clientX - activeTouchPan.x),
        y: activeTouchPan.offsetY + (touch.clientY - activeTouchPan.y),
      },
      zoomScaleRef.current
    );
    setPanOffset(nextPan);
  }, [clampPan]);

  const endTouchPan = useCallback(() => {
    touchPanRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const target = imageStageRef.current;
    if (!target) return;

    target.addEventListener("touchstart", handleTouchPanStart, { passive: false });
    target.addEventListener("touchmove", handleTouchPanMove, { passive: false });
    target.addEventListener("touchend", endTouchPan, { passive: false });
    target.addEventListener("touchcancel", endTouchPan, { passive: false });
    target.addEventListener("pointerdown", handlePointerDown, { passive: false });
    target.addEventListener("pointermove", handlePointerMove, { passive: false });
    target.addEventListener("pointerup", endPointerPan, { passive: false });
    target.addEventListener("pointercancel", endPointerPan, { passive: false });

    return () => {
      target.removeEventListener("touchstart", handleTouchPanStart);
      target.removeEventListener("touchmove", handleTouchPanMove);
      target.removeEventListener("touchend", endTouchPan);
      target.removeEventListener("touchcancel", endTouchPan);
      target.removeEventListener("pointerdown", handlePointerDown);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", endPointerPan);
      target.removeEventListener("pointercancel", endPointerPan);
    };
  }, [
    open,
    handleTouchPanStart,
    handleTouchPanMove,
    endTouchPan,
    handlePointerDown,
    handlePointerMove,
    endPointerPan,
  ]);

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
      style={{ touchAction: "manipulation" }}
    >
      <button
        type="button"
        onClick={handleBackClose}
        className="absolute top-4 left-4 z-[1] rounded-full bg-black/55 p-2 text-white/95 backdrop-blur"
        aria-label="Back"
        data-gallery-ui
      >
        <IconArrowLeft size={20} strokeWidth={2} />
      </button>

      <div
        className="absolute top-4 right-4 z-[1] flex items-center gap-2 rounded-full bg-black/55 px-2 py-1.5 text-white/95 backdrop-blur"
        data-gallery-ui
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            zoomOut();
          }}
          className="rounded-full p-1.5 hover:bg-white/10 active:scale-95 disabled:opacity-40"
          aria-label="Zoom out"
          disabled={zoomScale <= 1}
        >
          <IconMinus size={18} strokeWidth={2} />
        </button>
        <div className="min-w-[2.5rem] text-center text-xs font-semibold">
          {Math.round(zoomScale * 100)}%
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            zoomIn();
          }}
          className="rounded-full p-1.5 hover:bg-white/10 active:scale-95"
          aria-label="Zoom in"
        >
          <IconPlus size={18} strokeWidth={2} />
        </button>
      </div>

      {activeImage ? (
        <div
          ref={imageStageRef}
          className="flex h-full w-full items-center justify-center overflow-hidden"
          style={{
            touchAction: "none",
            cursor: zoomScale > 1 ? "grab" : "default",
          }}
        >
          <img
            ref={imageRef}
            src={activeImage}
            alt="Activity"
            className="max-h-full max-w-full object-contain"
            draggable={false}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transformOrigin: "center center",
              cursor: zoomScale > 1 ? "grab" : "default",
            }}
            onLoad={(event) => {
              const img = event.currentTarget;
              if (!activeItem || !img.naturalWidth || !img.naturalHeight) return;
              setImageSizes((prev) => ({
                ...prev,
                [activeItem.key]: { w: img.naturalWidth, h: img.naturalHeight },
              }));
            }}
          />
        </div>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-white/70">
          Loading photo...
        </div>
      )}

      {chromeVisible && (
        <>
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
