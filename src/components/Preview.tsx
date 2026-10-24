import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import { Pause, Play } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';

export type Backdrop = 'dark' | 'light' | 'checker';

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'dark', label: 'Тёмный' },
  { id: 'light', label: 'Светлый' },
  { id: 'checker', label: 'Прозрачный' },
];

/** Big player with play/pause, frame scrubber and backdrop switch. */
export function Preview({ doc }: { doc: LottieDoc }) {
  const box = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const frameRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const [frame, setFrame] = useState(0);
  const [backdrop, setBackdrop] = useState<Backdrop>('dark');
  const total = Math.max(1, Math.round(doc.op - doc.ip));

  useEffect(() => {
    if (!box.current) return;
    const anim = lottie.loadAnimation({
      container: box.current,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: structuredClone(doc),
    });
    animRef.current = anim;
    const start = () => {
      const f = Math.min(frameRef.current, total - 1);
      if (playingRef.current) anim.goToAndPlay(f, true);
      else anim.goToAndStop(f, true);
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
      animRef.current = null;
    };
  }, [doc, total]);

  useEffect(() => {
    if (playing) animRef.current?.play();
    else animRef.current?.pause();
  }, [playing]);

  const seek = (f: number) => {
    setPlaying(false);
    frameRef.current = f;
    setFrame(f);
    animRef.current?.goToAndStop(f, true);
  };

  return (
    <div className="preview">
      <div className={`stage stage-${backdrop}`}>
        <div className="stage-canvas" ref={box} />
      </div>
      <div className="player">
        <button className="icon-btn" onClick={() => setPlaying((p) => !p)} title={playing ? 'Пауза' : 'Играть'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
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
          {Math.min(frame, total - 1) + 1} / {total}
        </span>
        <div className="seg">
          {BACKDROPS.map((b) => (
            <button key={b.id} className={backdrop === b.id ? 'on' : ''} onClick={() => setBackdrop(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small looping preview for template cards; plays on hover. */
export function Thumb({ doc }: { doc: LottieDoc }) {
  const box = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const anim = lottie.loadAnimation({
      container: box.current,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: structuredClone(doc),
    });
    animRef.current = anim;
    const still = () => anim.goToAndStop(40, true);
    if (anim.isLoaded) still();
    else anim.addEventListener('DOMLoaded', still);
    return () => anim.destroy();
  }, [doc]);

  return (
    <div
      className="thumb"
      ref={box}
      onMouseEnter={() => animRef.current?.play()}
      onMouseLeave={() => animRef.current?.goToAndStop(40, true)}
    />
  );
}
