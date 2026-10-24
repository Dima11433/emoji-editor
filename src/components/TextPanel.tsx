import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FONTS, type FontId } from '../lib/fonts';
import { DEFAULT_TEXT, TEXT_ANIMATIONS, type TextAnimation } from '../lib/text';

export interface TextRequest {
  text: string;
  fontId: FontId;
  size: number;
  fillHex: string;
  strokeHex: string | null;
  strokeWidth: number;
  y: number;
  animation: TextAnimation;
}

export function TextPanel({ onAdd, busy }: { onAdd: (req: TextRequest) => void; busy: boolean }) {
  const [req, setReq] = useState<TextRequest>({
    text: 'MAGNAT',
    fontId: 'montserrat',
    size: DEFAULT_TEXT.size,
    fillHex: DEFAULT_TEXT.fillHex,
    strokeHex: DEFAULT_TEXT.strokeHex,
    strokeWidth: DEFAULT_TEXT.strokeWidth,
    y: DEFAULT_TEXT.y,
    animation: 'pop',
  });
  const set = <K extends keyof TextRequest>(key: K, value: TextRequest[K]) => setReq((r) => ({ ...r, [key]: value }));
  const font = FONTS.find((f) => f.id === req.fontId)!;

  return (
    <form
      className="text-form pad"
      onSubmit={(e) => {
        e.preventDefault();
        if (req.text.trim()) onAdd(req);
      }}
    >
      <label className="field">
        <span>Текст</span>
        <input
          value={req.text}
          maxLength={24}
          onChange={(e) => set('text', e.target.value)}
          style={{ fontFamily: font.css, fontWeight: font.weight }}
        />
      </label>
      <label className="field">
        <span>Шрифт</span>
        <select value={req.fontId} onChange={(e) => set('fontId', e.target.value as FontId)}>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Размер · {req.size}</span>
        <input type="range" min={40} max={220} value={req.size} onChange={(e) => set('size', Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Высота на холсте · {Math.round(((512 - req.y) / 512) * 100)}%</span>
        <input type="range" min={60} max={452} step={4} value={512 - req.y} onChange={(e) => set('y', 512 - Number(e.target.value))} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Цвет</span>
          <input type="color" value={req.fillHex} onChange={(e) => set('fillHex', e.target.value)} />
        </label>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={req.strokeHex !== null}
              onChange={(e) => set('strokeHex', e.target.checked ? '#1b1b2f' : null)}
            />{' '}
            Обводка
          </span>
          <input
            type="color"
            disabled={req.strokeHex === null}
            value={req.strokeHex ?? '#1b1b2f'}
            onChange={(e) => set('strokeHex', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Толщина</span>
          <input
            type="number"
            min={1}
            max={24}
            disabled={req.strokeHex === null}
            value={req.strokeWidth}
            onChange={(e) => set('strokeWidth', Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
          />
        </label>
      </div>
      <label className="field">
        <span>Анимация</span>
        <select value={req.animation} onChange={(e) => set('animation', e.target.value as TextAnimation)}>
          {TEXT_ANIMATIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <button className="primary wide" type="submit" disabled={busy || !req.text.trim()}>
        <Plus size={16} /> {busy ? 'Загружаю шрифт…' : 'Добавить на стикер'}
      </button>
      <p className="muted small">
        Telegram не показывает текстовые слои, поэтому буквы превращаются в фигуры. Цвета текста потом можно менять в палитре.
      </p>
    </form>
  );
}
