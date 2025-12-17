import { useRef, useState, type MouseEvent, type TouchEvent } from "react";

type LightboxState = {
  url: string;
  activity: any;
} | null;

export function useLightbox() {
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const lightboxOpenedAt = useRef<number>(0);
  const imageTouch = useRef<{ x: number; y: number; moved: boolean }>({
    x: 0,
    y: 0,
    moved: false,
  });

  const openLightbox = (url: string, activity: any) => {
    lightboxOpenedAt.current = Date.now();
    setLightbox({ url, activity });
  };

  const closeLightbox = () => setLightbox(null);

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lightboxOpenedAt.current < 300) {
      e.stopPropagation();
      return;
    }
    closeLightbox();
  };

  const onImageClick = (e: MouseEvent<HTMLImageElement>, url: string, activity: any) => {
    e.stopPropagation();
    openLightbox(url, activity);
  };

  const onImageTouchStart = (e: TouchEvent<HTMLImageElement>) => {
    const t = e.touches[0];
    imageTouch.current = { x: t.clientX, y: t.clientY, moved: false };
  };

  const onImageTouchMove = (e: TouchEvent<HTMLImageElement>) => {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - imageTouch.current.x);
    const dy = Math.abs(t.clientY - imageTouch.current.y);
    if (dx > 8 || dy > 8) {
      imageTouch.current.moved = true;
    }
  };

  const onImageTouchEnd = (
    e: TouchEvent<HTMLImageElement>,
    url: string,
    activity: any
  ) => {
    if (imageTouch.current.moved) return;
    e.stopPropagation();
    openLightbox(url, activity);
  };

  return {
    lightbox,
    openLightbox,
    closeLightbox,
    handleOverlayClick,
    onImageClick,
    onImageTouchStart,
    onImageTouchMove,
    onImageTouchEnd,
  };
}
