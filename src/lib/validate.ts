import type { Layer, LottieDoc } from './lottie';
import { formatKb } from './tgs';

export type CheckStatus = 'ok' | 'warn' | 'error';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export const MAX_BYTES = 64 * 1024;

/** Checks a sticker against Telegram's animated sticker rules. */
export function checkTelegram(doc: LottieDoc, gzBytes: number): Check[] {
  const checks: Check[] = [];
  const seconds = (doc.op - doc.ip) / doc.fr;

  checks.push({
    id: 'size',
    label: 'Вес файла',
    status: gzBytes <= MAX_BYTES ? 'ok' : 'error',
    detail: `${formatKb(gzBytes)} из 64 кБ`,
  });
  checks.push({
    id: 'canvas',
    label: 'Холст 512×512',
    status: doc.w === 512 && doc.h === 512 ? 'ok' : 'error',
    detail: `${doc.w}×${doc.h}`,
  });
  checks.push({
    id: 'fps',
    label: 'Частота кадров',
    status: doc.fr === 60 ? 'ok' : doc.fr === 30 ? 'warn' : 'error',
    detail: doc.fr === 30 ? '30 к/с, Telegram рекомендует 60' : `${doc.fr} к/с`,
  });
  checks.push({
    id: 'duration',
    label: 'Длительность до 3 с',
    status: seconds <= 3 + 1e-6 ? 'ok' : 'error',
    detail: `${seconds.toFixed(2).replace('.', ',')} с`,
  });

  const found = findUnsupported(doc);
  checks.push({
    id: 'features',
    label: 'Поддержка в Telegram',
    status: found.length ? 'warn' : 'ok',
    detail: found.length ? `Могут не отображаться: ${found.join(', ')}` : 'Всё поддерживается',
  });
  return checks;
}

function findUnsupported(doc: LottieDoc): string[] {
  const found = new Set<string>();
  const layers: Layer[] = [...doc.layers, ...(doc.assets ?? []).flatMap((a) => a.layers ?? [])];
  for (const layer of layers) {
    if (layer.ty === 5) found.add('текстовые слои');
    if (layer.ty === 2) found.add('картинки');
    if (layer.hasMask || (Array.isArray(layer.masksProperties) && layer.masksProperties.length)) found.add('маски');
    if (layer.tt) found.add('маски слоёв (matte)');
    if (layer.ddd === 1) found.add('3D-слои');
    if (layer.tm) found.add('перенастройка времени');
    if (Array.isArray(layer.ef) && layer.ef.length) found.add('эффекты слоёв');
    if (layer.ao === 1) found.add('автоориентация');
  }
  walk(doc.layers, (obj) => {
    if (obj.ty === 'rp') found.add('повторители');
    if (obj.ty === 'mm') found.add('объединение контуров');
    if (typeof obj.x === 'string' && 'k' in obj) found.add('выражения');
  });
  if ((doc.assets ?? []).some((a) => typeof a.p === 'string' && !a.layers)) found.add('картинки');
  return [...found];
}

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

/** Shortens the animation to 3 seconds. */
export function trimToLimit(doc: LottieDoc): void {
  const maxOp = doc.ip + Math.floor(3 * doc.fr);
  if (doc.op <= maxOp) return;
  doc.op = maxOp;
  for (const layer of doc.layers) layer.op = Math.min(layer.op, maxOp);
}
