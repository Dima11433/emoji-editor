import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import { ChevronLeft, ChevronRight, Grid3x3, Pause, Play } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport } from '../lib/tgs';

export type Backdrop = 'dark' | 'tg' | 'light' | 'checker';

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'dark', label: 'Студия' },
  { id: 'tg', label: 'TG Чат' },
  { id: 'light', label: 'Светлый' },
  { id: 'checker', label: 'Альфа' },
];

const SPEEDS = [0.5, 1, 1.5, 2] as const;

/** Big studio player with play/pause, frame step, speed, safe-grid, 100px emoji preview, and backdrop switch. */
export function Preview({ doc }: { doc: LottieDoc }) {
  const box = useRef<HTMLDivElement>(null);
  const miniBox = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const miniAnimRef = useRef<AnimationItem | null>(null);
  const frameRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [showGrid, setShowGrid] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>('dark');
  const total = Math.max(1, Math.round(doc.op - doc.ip));

  useEffect(() => {
    if (!box.current) return;
    const clean = cleanForExport(doc) as LottieDoc;
    const anim = lottie.loadAnimation({
      container: box.current,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: clean,
    });
    anim.setSpeed(speedRef.current);
    animRef.current = anim;

    let miniAnim: AnimationItem | null = null;
    if (miniBox.current) {
      miniAnim = lottie.loadAnimation({
        container: miniBox.current,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: structuredClone(clean),
      });
      miniAnim.setSpeed(speedRef.current);
      miniAnimRef.current = miniAnim;
    }

    const start = () => {
      const f = Math.min(frameRef.current, total - 1);
      if (playingRef.current) {
        anim.goToAndPlay(f, true);
        miniAnim?.goToAndPlay(f, true);
      } else {
        anim.goToAndStop(f, true);
        miniAnim?.goToAndStop(f, true);
      }
    };

    const offFrame = anim.addEventListener('enterFrame', () => {
      const f = Math.floor(anim.currentFrame);
      if (f !== frameRef.current) {
        frameRef.current = f;
        setFrame(f);
      }
    });

    if (anim.isLoaded) start();
    else anim.addEventListener('DOMLoaded', start);

    return () => {
      offFrame();
      anim.destroy();
      miniAnim?.destroy();
      animRef.current = null;
      miniAnimRef.current = null;
    };
  }, [doc, total]);

  useEffect(() => {
    if (playing) {
      animRef.current?.play();
      miniAnimRef.current?.play();
    } else {
      animRef.current?.pause();
      miniAnimRef.current?.pause();
    }
  }, [playing]);

  useEffect(() => {
    animRef.current?.setSpeed(speed);
    miniAnimRef.current?.setSpeed(speed);
  }, [speed]);

  const seek = (nextFrame: number) => {
    const clamped = ((nextFrame % total) + total) % total;
    setPlaying(false);
    frameRef.current = clamped;
    setFrame(clamped);
    animRef.current?.goToAndStop(clamped, true);
    miniAnimRef.current?.goToAndStop(clamped, true);
  };

  return (
    <div className="preview">
      <div className={`stage stage-${backdrop}`}>
        <div className="stage-canvas" ref={box} />
        {showGrid && <div className="stage-grid-overlay" aria-hidden />}
        <div className="stage-mini-pip" title="Реальный размер эмодзи в чате Telegram (40×40 px)">
          <div className="stage-mini-canvas" ref={miniBox} />
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

      <div className="player">
        <button
          type="button"
          className="icon-btn"
          onClick={() => seek(frame - 1)}
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
          onClick={() => seek(frame + 1)}
          title="Следующий кадр"
        >
          <ChevronRight size={16} />
        </button>

        <input
          className="scrubber"
          type="range"
          min={0}
          max={total - 1}
          value={Math.min(frame, total - 1)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Кадр"
        />

        <span className="frame-count">
          {Math.min(frame, total - 1) + 1}/{total}
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
