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

/**
 * Lazy-loaded Lottie thumbnail that only fetches & mounts SVG when near the viewport.
 * Keeps 263+ MAGNAT stickers fast and responsive.
 */
export function LazyThumb({ item, doc: directDoc, autoPlay = false }: LazyThumbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [near, setNear] = useState(() => Boolean(directDoc));
  const [loadedDoc, setLoadedDoc] = useState<LottieDoc | null>(() =>
    directDoc ?? (item ? peekCatalogDoc(item.id) : null),
  );

  useEffect(() => {
    if (directDoc) {
      setLoadedDoc(directDoc);
      setNear(true);
      return;
    }
    if (!item) return;
    const cached = peekCatalogDoc(item.id);
    if (cached) setLoadedDoc(cached);
  }, [directDoc, item]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setNear(entry.isIntersecting);
        }
      },
      { rootMargin: '260px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || directDoc || !item || loadedDoc) return;
    let cancelled = false;
    loadCatalogDoc(item)
      .then((d) => {
        if (!cancelled) setLoadedDoc(d);
      })
      .catch(() => {
        // Ignore transient network errors on thumbnail
      });
    return () => {
      cancelled = true;
    };
  }, [near, directDoc, item, loadedDoc]);

  const activeDoc = directDoc ?? loadedDoc;

  useEffect(() => {
    if (!near || !activeDoc || !canvasRef.current) return;
    const rendered = cleanForExport(applyShapeEffects(activeDoc)) as LottieDoc;
    const span = Math.max(1, Math.round(rendered.op - rendered.ip));
    const posterFrame = Math.min(span - 1, Math.max(15, Math.floor(span * 0.35)));

    const anim = lottie.loadAnimation({
      container: canvasRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: rendered,
    });
    animRef.current = anim;

    const init = () => {
      if (autoPlay) anim.play();
      else anim.goToAndStop(posterFrame, true);
    };
    if (anim.isLoaded) init();
    else anim.addEventListener('DOMLoaded', init);

    return () => {
      anim.destroy();
      animRef.current = null;
    };
  }, [near, activeDoc, autoPlay]);

  const handleEnter = () => {
    animRef.current?.play();
  };

  const handleLeave = () => {
    if (autoPlay || !animRef.current || !activeDoc) return;
    const span = Math.max(1, Math.round(activeDoc.op - activeDoc.ip));
    const posterFrame = Math.min(span - 1, Math.max(15, Math.floor(span * 0.35)));
    animRef.current.goToAndStop(posterFrame, true);
  };

  return (
    <div
      className="thumb-stage"
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {near && activeDoc ? (
        <div className="thumb-svg" ref={canvasRef} />
      ) : (
        <div className="thumb-skeleton" />
      )}
    </div>
  );
}
