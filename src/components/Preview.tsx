import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Grid3x3,
  LayoutGrid,
  Maximize2,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport } from '../lib/tgs';

export type Backdrop = 'dark' | 'tg' | 'light' | 'checker';
export type MultiViewPref = 'auto' | 'banner' | 'grid' | 'single';

export interface PreviewSticker {
  id: string;
  name: string;
  catalogId: string | null;
  doc: LottieDoc;
}

export interface PreviewProps {
  doc: LottieDoc;
  selectedStickers?: PreviewSticker[];
  primaryId?: string;
  onSelectPrimary?: (id: string) => void;
  onCollapseToSingle?: () => void;
}

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'dark', label: 'Студия' },
  { id: 'tg', label: 'TG Чат' },
  { id: 'light', label: 'Светлый' },
  { id: 'checker', label: 'Альфа' },
];

const SPEEDS = [0.5, 1, 1.5, 2] as const;

const BANNER_ORDER: Record<string, number> = {
  shablony1_012: 1,
  shablony1_013: 2,
  shablony1_014: 3,
};

interface SeekSignal {
  tick: number;
  ratio: number;
}

interface LottieCellProps {
  doc: LottieDoc;
  playing: boolean;
  speed: number;
  seekSignal: SeekSignal;
  onEnterFrame?: (frame: number) => void;
  className?: string;
}

const LottieCell = React.memo(function LottieCell({
  doc,
  playing,
  speed,
  seekSignal,
  onEnterFrame,
  className,
}: LottieCellProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const ratioRef = useRef(0);
  const onEnterFrameRef = useRef(onEnterFrame);
  onEnterFrameRef.current = onEnterFrame;

  const total = Math.max(1, Math.round(doc.op - doc.ip));

  useEffect(() => {
    if (!boxRef.current) return;
    let cancelled = false;
    let anim: AnimationItem | null = null;

    // Throttle animation initialization via requestAnimationFrame so rapid doc mutations (e.g. slider drag) coalesce
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !boxRef.current) return;

      try {
        const clean = cleanForExport(doc) as LottieDoc;
        anim = lottie.loadAnimation({
          container: boxRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          animationData: clean,
        });
        anim.setSpeed(speedRef.current);
        animRef.current = anim;

        const start = () => {
          if (!anim || cancelled) return;
          const f = Math.min(total - 1, Math.max(0, Math.round(ratioRef.current * (total - 1))));
          if (playingRef.current) {
            anim.goToAndPlay(f, true);
          } else {
            anim.goToAndStop(f, true);
          }
        };

        anim.addEventListener('enterFrame', () => {
          if (!anim || cancelled) return;
          const f = Math.floor(anim.currentFrame);
          ratioRef.current = total > 1 ? f / (total - 1) : 0;
          onEnterFrameRef.current?.(f);
        });

        if (anim.isLoaded) start();
        else anim.addEventListener('DOMLoaded', start);

        // Keep cleanup reference
        animRef.current = anim;
      } catch {
        return;
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [doc, total]);

  useEffect(() => {
    if (playing) animRef.current?.play();
    else animRef.current?.pause();
  }, [playing]);

  useEffect(() => {
    animRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (seekSignal.tick === 0) return;
    ratioRef.current = seekSignal.ratio;
    const f = Math.min(total - 1, Math.max(0, Math.round(seekSignal.ratio * (total - 1))));
    animRef.current?.goToAndStop(f, true);
  }, [seekSignal, total]);

  return <div className={className ?? 'stage-canvas'} ref={boxRef} />;
});

/** Studio player supporting single 512×512 view, seamless multi-tile Telegram banner strip, and live multi-grid. */
export function Preview({
  doc,
  selectedStickers = [],
  primaryId,
  onSelectPrimary,
  onCollapseToSingle,
}: PreviewProps) {
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef(0);
  const scrubberRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [showGrid, setShowGrid] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>('dark');
  const [viewPref, setViewPref] = useState<MultiViewPref>('auto');
  const [seekSignal, setSeekSignal] = useState<SeekSignal>({ tick: 0, ratio: 0 });

  const total = Math.max(1, Math.round(doc.op - doc.ip));
  const multiCount = selectedStickers.length;
  const isMulti = multiCount > 1;

  const isBannerSet = useMemo(() => {
    if (multiCount < 2 || multiCount > 5) return false;
    return selectedStickers.every(
      (s) => (s.catalogId && s.catalogId in BANNER_ORDER) || /баннер/i.test(s.name),
    );
  }, [multiCount, selectedStickers]);

  const bannerStickers = useMemo(() => {
    const slice = selectedStickers.slice(0, 6);
    if (!isBannerSet) return slice;
    return [...slice].sort(
      (a, b) =>
        (BANNER_ORDER[a.catalogId ?? ''] ?? 99) - (BANNER_ORDER[b.catalogId ?? ''] ?? 99),
    );
  }, [isBannerSet, selectedStickers]);

  const effectiveMode: 'banner' | 'grid' | 'single' = !isMulti
    ? 'single'
    : viewPref === 'auto'
      ? isBannerSet
        ? 'banner'
        : 'grid'
      : viewPref === 'banner' && multiCount > 6
        ? 'grid'
        : viewPref;

  // Ultra-fast 60 FPS frame sync directly updating DOM input and label without React re-rendering the whole stage
  const handlePrimaryFrame = useCallback(
    (f: number) => {
      frameRef.current = f;
      if (scrubberRef.current && Number(scrubberRef.current.value) !== f) {
        scrubberRef.current.value = String(f);
      }
      if (counterRef.current) {
        counterRef.current.textContent = `${Math.min(f, total - 1) + 1}/${total}`;
      }
    },
    [total],
  );

  const seek = useCallback(
    (nextFrame: number) => {
      const clamped = ((nextFrame % total) + total) % total;
      setPlaying(false);
      frameRef.current = clamped;
      if (scrubberRef.current) scrubberRef.current.value = String(clamped);
      if (counterRef.current) counterRef.current.textContent = `${clamped + 1}/${total}`;
      const ratio = total > 1 ? clamped / (total - 1) : 0;
      setSeekSignal((prev) => ({ tick: prev.tick + 1, ratio }));
    },
    [total],
  );

  const visibleGridStickers = selectedStickers.slice(0, 12);
  const gridLen = visibleGridStickers.length;
  const gridCols =
    gridLen <= 2 ? 2 : gridLen === 3 ? 3 : gridLen === 4 ? 2 : gridLen <= 6 ? 3 : 4;
  const gridMaxWidth =
    gridLen === 4 ? 430 : gridLen <= 2 ? 500 : gridLen <= 6 ? 620 : 690;

  return (
    <div className={`preview ${effectiveMode !== 'single' ? 'preview-wide' : ''}`}>
      {isMulti && (
        <div className="multi-stage-bar">
          <div className="multi-stage-badge">
            <Sparkles size={14} />
            <span>Редактируются сразу {multiCount} эмодзи</span>
          </div>

          <div className="multi-stage-controls">
            <div className="seg">
              {multiCount <= 6 && (
                <button
                  type="button"
                  className={effectiveMode === 'banner' ? 'on' : ''}
                  onClick={() => setViewPref('banner')}
                  title="Склеить выбранные эмодзи в единую горизонтальную строку без зазора (как баннер в Telegram)"
                >
                  <Columns3 size={13} /> Склейка
                </button>
              )}
              <button
                type="button"
                className={effectiveMode === 'grid' ? 'on' : ''}
                onClick={() => setViewPref('grid')}
                title="Показать все выбранные эмодзи сеткой"
              >
                <LayoutGrid size={13} /> Сетка ({multiCount})
              </button>
              <button
                type="button"
                className={effectiveMode === 'single' ? 'on' : ''}
                onClick={() => setViewPref('single')}
                title="Увеличить активный эмодзи крупным планом (изменения всё равно применяются ко всем выбранным)"
              >
                <Maximize2 size={13} /> Крупно
              </button>
            </div>

            {onCollapseToSingle && (
              <button
                type="button"
                className="mini-btn"
                onClick={onCollapseToSingle}
                title="Снять мультивыбор и оставить только 1 текущий эмодзи"
              >
                <X size={12} /> Оставить 1
              </button>
            )}
          </div>
        </div>
      )}

      {effectiveMode === 'single' && (
        <div className={`stage stage-${backdrop}`}>
          <LottieCell
            doc={doc}
            playing={playing}
            speed={speed}
            seekSignal={seekSignal}
            onEnterFrame={handlePrimaryFrame}
            className="stage-canvas"
          />
          {showGrid && <div className="stage-grid-overlay" aria-hidden />}
          <div className="stage-mini-pip" title="Реальный размер эмодзи в чате Telegram (40×40 px)">
            <LottieCell
              doc={doc}
              playing={playing}
              speed={speed}
              seekSignal={seekSignal}
              className="stage-mini-canvas"
            />
            <span>TG 40px</span>
          </div>
          <button
            type="button"
            className={`stage-grid-btn ${showGrid ? 'on' : ''}`}
            onClick={() => setShowGrid((g) => !g)}
            title="Показать/скрыть центровочную сетку 512×512"
          >
            <Grid3x3 size={15} />
          </button>
        </div>
      )}

      {effectiveMode === 'banner' && (
        <div className={`stage stage-banner-wrap stage-${backdrop}`}>
          <div className="banner-stage-label">
            Бесшовная склейка из {bannerStickers.length} эмодзи (кликните по части для выбора слоя)
          </div>

          <div
            className={`banner-strip ${showGrid ? 'show-seams' : ''}`}
            style={{ gridTemplateColumns: `repeat(${bannerStickers.length}, 1fr)` }}
          >
            {bannerStickers.map((item, idx) => {
              const isFocus = item.id === primaryId;
              return (
                <div
                  key={item.id}
                  className={`banner-tile ${isFocus ? 'focused' : ''}`}
                  onClick={() => onSelectPrimary?.(item.id)}
                  title={`${item.name} — кликните для фокуса`}
                >
                  <LottieCell
                    doc={item.doc}
                    playing={playing}
                    speed={speed}
                    seekSignal={seekSignal}
                    onEnterFrame={idx === 0 ? handlePrimaryFrame : undefined}
                    className="banner-tile-canvas"
                  />
                  {showGrid && <span className="banner-tile-num">#{idx + 1}</span>}
                </div>
              );
            })}
          </div>

          <div className="banner-tg-bubble" title="Как эта связка эмодзи выглядит в сообщении Telegram">
            <span className="banner-tg-caption">В чате TG:</span>
            <div className="banner-tg-inline">
              {bannerStickers.map((item) => (
                <div key={`mini-${item.id}`} className="banner-tg-cell">
                  <LottieCell
                    doc={item.doc}
                    playing={playing}
                    speed={speed}
                    seekSignal={seekSignal}
                    className="banner-tg-canvas"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={`stage-grid-btn ${showGrid ? 'on' : ''}`}
            onClick={() => setShowGrid((g) => !g)}
            title="Показать/скрыть границы между отдельными эмодзи баннера"
          >
            <Grid3x3 size={15} />
          </button>
        </div>
      )}

      {effectiveMode === 'grid' && (
        <div className={`stage stage-multi-grid-wrap stage-${backdrop}`}>
          <div
            className="multi-preview-grid"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              maxWidth: `${gridMaxWidth}px`,
            }}
          >
            {visibleGridStickers.map((item, idx) => {
              const isFocus = item.id === primaryId;
              return (
                <div
                  key={item.id}
                  className={`multi-preview-cell ${isFocus ? 'focused' : ''}`}
                  onClick={() => onSelectPrimary?.(item.id)}
                  onDoubleClick={() => {
                    onSelectPrimary?.(item.id);
                    setViewPref('single');
                  }}
                  title={`${item.name} (двойной клик — открыть крупно)`}
                >
                  <LottieCell
                    doc={item.doc}
                    playing={playing}
                    speed={speed}
                    seekSignal={seekSignal}
                    onEnterFrame={idx === 0 ? handlePrimaryFrame : undefined}
                    className="multi-cell-canvas"
                  />
                  <span className="multi-cell-label">{item.name}</span>
                </div>
              );
            })}
          </div>
          {multiCount > visibleGridStickers.length && (
            <div className="multi-overflow-note">
              + ещё {multiCount - visibleGridStickers.length} эмодзи редактируются синхронно в фоне
            </div>
          )}
        </div>
      )}

      {isMulti && effectiveMode === 'single' && (
        <div className="multi-focus-strip">
          {selectedStickers.slice(0, 10).map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`mini-btn ${s.id === primaryId ? 'accent-outline' : ''}`}
              onClick={() => onSelectPrimary?.(s.id)}
            >
              #{i + 1} {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="player">
        <button
          type="button"
          className="icon-btn"
          onClick={() => seek(frameRef.current - 1)}
          title="Предыдущий кадр"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-btn play-btn"
          onClick={() => setPlaying((p) => !p)}
          title={playing ? 'Пауза' : 'Играть'}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => seek(frameRef.current + 1)}
          title="Следующий кадр"
        >
          <ChevronRight size={16} />
        </button>

        <input
          ref={scrubberRef}
          className="scrubber"
          type="range"
          min={0}
          max={total - 1}
          defaultValue={0}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Кадр"
        />

        <span ref={counterRef} className="frame-count">
          1/{total}
        </span>

        <div className="seg">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={speed === s ? 'on' : ''}
              onClick={() => setSpeed(s)}
              title={`Скорость ${s}×`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="seg">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={backdrop === b.id ? 'on' : ''}
              onClick={() => setBackdrop(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
