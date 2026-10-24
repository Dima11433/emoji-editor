import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { Check } from '../lib/validate';

interface Props {
  checks: Check[];
  onTrim: () => void;
  onOptimize: () => void;
}

const ICON = {
  ok: <CircleCheck size={16} className="ok" />,
  warn: <TriangleAlert size={16} className="warn" />,
  error: <CircleAlert size={16} className="error" />,
};

export function ChecksPanel({ checks, onTrim, onOptimize }: Props) {
  const durationBad = checks.some((c) => c.id === 'duration' && c.status === 'error');
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Проверка для Telegram</h3>
      </header>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.id}>
            {ICON[c.status]}
            <div>
              <div>{c.label}</div>
              <div className="muted small">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="chips">
        <button onClick={onOptimize} title="Округлить числа и убрать служебные поля">
          Сжать файл
        </button>
        {durationBad && <button onClick={onTrim}>Обрезать до 3 с</button>}
      </div>
    </section>
  );
}
