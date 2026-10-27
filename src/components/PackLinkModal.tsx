import { useState } from 'react';
import { DownloadCloud, Link2, X } from 'lucide-react';

interface PackLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (link: string) => void;
}

export function PackLinkModal({ isOpen, onClose, onImport }: PackLinkModalProps) {
  const [url, setUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onImport(url.trim());
    onClose();
  };

  return (
    <div className="tg-modal-backdrop" onClick={onClose}>
      <div
        className="tier-panel"
        style={{
          width: 'min(92vw, 440px)',
          background: '#131620',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '14px' }}>
            <Link2 size={16} color="#38bdf8" />
            <span>Импорт пака по ссылке</span>
          </div>
          <button type="button" className="tier-nav-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            Вставьте ссылку на набор эмодзи или стикеров Telegram (например, <code>https://t.me/addstickers/MAGNAT</code> или имя пака):
          </p>

          <input
            type="text"
            className="tier-input"
            placeholder="https://t.me/addstickers/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="tier-nav-btn" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="tier-nav-btn tier-btn-primary"
              disabled={!url.trim()}
            >
              <DownloadCloud size={14} />
              <span>Загрузить</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
