import { useState, useEffect, useCallback, useRef } from 'react';

interface FitRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Given an image URL and a viewport ref, computes the fitted rectangle
 * (using object-contain logic) so that the full image is visible without
 * cropping. Device markers positioned as percentages inside this rect
 * will map to the same point on the image regardless of viewport size.
 */
export function useFloorPlanFit(
  imageUrl: string | null,
  viewportRef: React.RefObject<HTMLDivElement>,
) {
  const [imageState, setImageState] = useState<{ url: string | null; ratio: number | null; failed: boolean }>({ url: null, ratio: null, failed: false });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  // Detect natural image aspect ratio
  useEffect(() => {
    if (!imageUrl) {
      setImageState({ url: null, ratio: null, failed: false });
      return;
    }
    let cancelled = false;
    setImageState({ url: imageUrl, ratio: null, failed: false });
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setImageState({ url: imageUrl, ratio: img.naturalWidth / img.naturalHeight, failed: false });
      }
    };
    img.onerror = () => {
      if (!cancelled) setImageState({ url: imageUrl, ratio: null, failed: true });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  // Never apply an old floor's aspect ratio to a newly selected image.
  const imgRatio = imageState.url === imageUrl ? imageState.ratio : null;
  const imageError = imageState.url === imageUrl && imageState.failed;

  // Track viewport size with ResizeObserver
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [viewportRef]);

  const fitRect: FitRect | null = useCallback(() => {
    if (!imgRatio || viewportSize.width === 0 || viewportSize.height === 0) return null;

    const vw = viewportSize.width;
    const vh = viewportSize.height;
    const containerRatio = vw / vh;

    let width: number;
    let height: number;

    if (imgRatio > containerRatio) {
      // Image is wider than container — fit to width
      width = vw;
      height = vw / imgRatio;
    } else {
      // Image is taller than container — fit to height
      height = vh;
      width = vh * imgRatio;
    }

    return {
      left: (vw - width) / 2,
      top: (vh - height) / 2,
      width,
      height,
    };
  }, [imgRatio, viewportSize.height, viewportSize.width])();

  return { fitRect, imgRatio, imageError };
}
