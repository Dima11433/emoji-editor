import { useEffect, useRef } from 'react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import { CheckCheck, X } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport } from '../lib/tgs';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: LottieDoc;
  title?: string;
}

export function TelegramModal({ isOpen, onClose, doc, title = 'MAGNAT' }: TelegramModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    try {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      const clean = cleanForExport(doc) as LottieDoc;
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: clean,
      });
      animRef.current = anim;
    } catch {
      // Ignored
    }

    return () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="tg-modal-backdrop" onClick={onClose}>
      <div className="tg-modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="tg-chat-header">
          <div className="tg-chat-avatar">M</div>
          <div className="tg-chat-user">
            <span className="tg-chat-name">{title}</span>
            <span className="tg-chat-status">в сети</span>
          </div>
          <button type="button" className="tier-nav-icon-btn" onClick={onClose} title="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="tg-chat-body">
          <div className="tg-bubble">
            <div className="tg-bubble-sticker" ref={containerRef} />
            <div className="tg-bubble-meta">
              <span>{timeStr}</span>
              <CheckCheck size={13} color="#55a5ff" />
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 16px', background: '#1c2733', fontSize: '11.5px', color: '#8293a4', textAlign: 'center' }}>
          Живой предпросмотр в сообщении Telegram · 60 FPS
        </div>
      </div>
    </div>
  );
}
