import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import { cleanForExport } from '../lib/tgs';
import { applyShapeEffects } from '../lib/effects';
import type { LottieDoc } from '../lib/lottie';
import { loadCatalogDoc, peekCatalogDoc, type CatalogItem } from '../lib/templates';

interface LazyThumbProps {
  item?: CatalogItem;
  doc?: LottieDoc | null;
  autoPlay?: boolean;
}

type ObserverCallback = (isIntersecting: boolean) => void;
const observerSubscribers = new Map<Element, ObserverCallback>();
let sharedObserver: IntersectionObserver | null = null;

function observeElement(el: Element, cb: ObserverCallback): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    cb(true);
    return () => {};
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const fn = observerSubscribers.get(entry.target);
          if (fn) fn(entry.isIntersecting);
        }
      },
      { rootMargin: '350px' },
    );
  }
  observerSubscribers.set(el, cb);
  sharedObserver.observe(el);
  return () => {
    observerSubscribers.delete(el);
    sharedObserver?.unobserve(el);
  };
}

/** Global memory cache for raster/SVG poster markup of catalog templates */
const svgPosterCache = new Map<string, string>();

/**
 * High-performance Lazy Lottie thumbnail.
 * - Uses a single shared IntersectionObserver across all 284+ items.
 * - Caches static SVG markup so scrolling is 60-120 FPS instantaneous with 0 JS overhead.
 * - Spins up the interactive Lottie player ONLY when hovered by the user.
 */
export function LazyThumb({ item, doc: directDoc, autoPlay = false }: LazyThumbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [isNear, setIsNear] = useState(() => Boolean(directDoc || (item && svgPosterCache.has(item.id))));
  const [loadedDoc, setLoadedDoc] = useState<LottieDoc | null>(() =>
    directDoc ?? (item ? peekCatalogDoc(item.id) : null),
  );
  const [cachedHtml, setCachedHtml] = useState<string | null>(() =>
    item ? svgPosterCache.get(item.id) ?? null : null,
  );
  const [isHovered, setIsHovered] = useState(false);

  // Sync directDoc
  useEffect(() => {
    if (directDoc) {
      setLoadedDoc(directDoc);
      setIsNear(true);
      return;
    }
    if (!item) return;
    const hit = svgPosterCache.get(item.id);
    if (hit) {
      setCachedHtml(hit);
      setIsNear(true);
    }
    const cached = peekCatalogDoc(item.id);
    if (cached) setLoadedDoc(cached);
  }, [directDoc, item]);

  // Shared IntersectionObserver: once near, stay near (never destroy loaded cards on scroll)
  useEffect(() => {
    if (isNear && (cachedHtml || directDoc)) return;
    const el = wrapRef.current;
    if (!el) return;

    const cleanup = observeElement(el, (visible) => {
      if (visible) {
        setIsNear(true);
      }
    });
    return cleanup;
  }, [isNear, cachedHtml, directDoc]);

  // Lazy load doc when near
  useEffect(() => {
    if (!isNear || directDoc || !item || loadedDoc || cachedHtml) return;
    let cancelled = false;
    loadCatalogDoc(item)
      .then((d) => {
        if (!cancelled) setLoadedDoc(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isNear, directDoc, item, loadedDoc, cachedHtml]);

  const activeDoc = directDoc ?? loadedDoc;

  // Render static poster or hover player
  useEffect(() => {
    // If we have cached HTML and not hovered, we don't need lottie-web at all!
    if (cachedHtml && !isHovered && !autoPlay) {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      return;
    }

    if (!isNear || !activeDoc || !canvasRef.current) return;

    let anim: AnimationItem | null = null;
    let destroyed = false;

    try {
      const rendered = cleanForExport(applyShapeEffects(activeDoc)) as LottieDoc;
      const span = Math.max(1, Math.round(rendered.op - rendered.ip));
      const posterFrame = Math.min(span - 1, Math.max(15, Math.floor(span * 0.35)));

      // If already playing or user hovered, load animation and play
      anim = lottie.loadAnimation({
        container: canvasRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: rendered,
      });
      animRef.current = anim;

      const onReady = () => {
        if (destroyed || !anim) return;
        if (autoPlay || isHovered) {
          anim.play();
        } else {
          anim.goToAndStop(posterFrame, true);
          // Cache the rendered static SVG for instant zero-cost re-renders
          if (item && canvasRef.current) {
            const html = canvasRef.current.innerHTML;
            if (html.includes('<svg')) {
              svgPosterCache.set(item.id, html);
              setCachedHtml(html);
              // Free up the Lottie player instance since static SVG is now in place
              anim.destroy();
              animRef.current = null;
            }
          }
        }
      };

      if (anim.isLoaded) onReady();
      else anim.addEventListener('DOMLoaded', onReady);
    } catch {
      return;
    }

    return () => {
      destroyed = true;
      anim?.destroy();
      animRef.current = null;
    };
  }, [isNear, activeDoc, autoPlay, isHovered, cachedHtml, item]);

  const handleEnter = () => {
    setIsHovered(true);
    animRef.current?.play();
  };

  const handleLeave = () => {
    setIsHovered(false);
    if (autoPlay) return;
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
  };

  return (
    <div
      className="thumb-stage"
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {cachedHtml && !isHovered && !autoPlay ? (
        <div
          className="thumb-svg thumb-cached"
          dangerouslySetInnerHTML={{ __html: cachedHtml }}
        />
      ) : isNear && activeDoc ? (
        <div className="thumb-svg" ref={canvasRef} />
      ) : (
        <div className="thumb-skeleton" />
      )}
    </div>
  );
}
