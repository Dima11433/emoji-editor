import lottie from 'lottie-web/build/player/lottie_light_canvas';
import type { LottieDoc } from './lottie';
import { buildPixelDoc, type PixelFrame } from './pixelate';
import { optimize, tgsSize } from './tgs';

/** Renders every other frame of the animation down to a grid × grid image. */
async function sampleFrames(doc: LottieDoc, grid: number): Promise<PixelFrame[]> {
  const big = document.createElement('canvas');
  big.width = doc.w;
  big.height = doc.h;
  const ctx = big.getContext('2d')!;
  const small = document.createElement('canvas');
  small.width = grid;
  small.height = grid;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';

  // With its own context the canvas renderer needs no container element;
  // lottie's types still ask for one.
  const anim = lottie.loadAnimation<'canvas'>({
    container: undefined as unknown as Element,
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: structuredClone(doc),
    rendererSettings: { context: ctx, clearCanvas: true },
  });
  if (!anim.isLoaded) await new Promise<void>((resolve) => anim.addEventListener('DOMLoaded', () => resolve()));

  const frames: PixelFrame[] = [];
  const total = Math.round(doc.op - doc.ip);
  try {
    for (let f = 0; f < total; f += 2) {
      anim.goToAndStop(f, true);
      sctx.clearRect(0, 0, grid, grid);
      sctx.drawImage(big, 0, 0, grid, grid);
      frames.push({ frame: doc.ip + f, data: sctx.getImageData(0, 0, grid, grid).data });
      // Let the page breathe between frames.
      if (f % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    anim.destroy();
  }
  return frames;
}

/** Frame steps tried from smooth to choppy until the file fits Telegram's 64 KB. */
const STEPS = [2, 4, 6, 10, 12, 20, 30];
const BUDGET = 62 * 1024;

export async function pixelate(doc: LottieDoc, grid: number): Promise<{ doc: LottieDoc; fps: number }> {
  const frames = await sampleFrames(doc, grid);
  let result: LottieDoc | null = null;
  let used = STEPS[0];
  for (const step of STEPS) {
    const picked = frames.filter((f) => (f.frame - doc.ip) % step === 0);
    result = optimize(buildPixelDoc(doc, picked, grid), 1);
    used = step;
    if (tgsSize(result) <= BUDGET) break;
  }
  return { doc: result!, fps: Math.round(doc.fr / used) };
}
