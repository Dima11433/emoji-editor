import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Circle,
  FolderOpen,
  LayoutGrid,
  Mic,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import type { SubscriptionState } from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';

interface IrisAssistantViewProps {
  subscription: SubscriptionState;
  telegramUser: TelegramUser | null;
  onOpenStudio: () => void;
  onOpenCatalog: () => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
}

export function IrisAssistantView({
  subscription,
  telegramUser,
  onOpenStudio,
  onOpenCatalog,
  onOpenProfile,
  onOpenPacks,
}: IrisAssistantViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'overview'>('chat');
  const [inputText, setInputText] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const userName = telegramUser?.first_name || 'magnat';

  // Procedural Living Glass Orb Animation (Swirling blue-violet core)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.024;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Spherical glass gradient
      const baseGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.48);
      baseGrad.addColorStop(0, '#100e26');
      baseGrad.addColorStop(0.5, '#070a1a');
      baseGrad.addColorStop(1, '#000000');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Swirling plasma filaments
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * (0.35 + i * 0.12) * (i % 2 === 0 ? 1 : -1));

        const radius = (w * 0.38) * (0.4 + 0.6 * Math.sin(t * 0.8 + i));
        const grad = ctx.createRadialGradient(
          Math.sin(t + i) * 20, Math.cos(t + i) * 20, 2,
          0, 0, radius
        );

        if (i % 3 === 0) {
          grad.addColorStop(0, 'rgba(47, 107, 255, 0.9)');
          grad.addColorStop(0.5, 'rgba(90, 76, 245, 0.4)');
          grad.addColorStop(1, 'transparent');
        } else if (i % 3 === 1) {
          grad.addColorStop(0, 'rgba(0, 210, 255, 0.8)');
          grad.addColorStop(0.6, 'rgba(47, 107, 255, 0.3)');
          grad.addColorStop(1, 'transparent');
        } else {
          grad.addColorStop(0, 'rgba(124, 72, 240, 0.85)');
          grad.addColorStop(0.5, 'rgba(47, 107, 255, 0.4)');
          grad.addColorStop(1, 'transparent');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(
          Math.sin(t + i) * 14,
          Math.cos(t * 0.7 + i) * 14,
          radius,
          radius * 0.72,
          t * 0.5 + i,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      // Bright inner core pulse
      const pulseSize = (w * 0.18) + Math.sin(t * 1.8) * 8;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseSize);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(0.25, 'rgba(64, 110, 255, 0.85)');
      coreGrad.addColorStop(0.65, 'rgba(124, 72, 240, 0.4)');
      coreGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Glass rim caustics
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSend = (text?: string) => {
    const q = (text || inputText).trim();
    if (!q) return;

    setAiResponse(
      `Запрос принят: «${q}». Сгенерирован персональный план 60 FPS Telegram эмодзи-пака. Все 284 векторных шаблона MAGNAT подготовлены к экспорту в @Stickers.`
    );
    setInputText('');
  };

  return (
    <div className="iris-page-root">
      {/* ATMOSPHERIC TOP LIGHTING GLOW */}
      <div className="top-glow-system">
        <div className="glow-center-blue" />
        <div className="glow-right-violet" />
        <div className="glow-left-cyan" />
      </div>

      <div className="app-shell">
        {/* LEFT RAIL (48u) */}
        <aside className="left-rail">
          {/* Logo Tile */}
          <div className="rail-logo-tile" onClick={onOpenCatalog} title="MAGNAT">
            <Sparkles size={18} color="#0E0E0E" />
          </div>

          {/* Grouped 32u Icon Tiles */}
          <nav className="rail-group">
            <button
              type="button"
              className="rail-tile active"
              title="AI Assistant (Iris)"
            >
              <Circle size={16} />
            </button>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenCatalog}
              title="Каталог шаблонов"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenStudio}
              title="Редактор / Студия"
            >
              <Wand2 size={16} />
            </button>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenPacks}
              title="Мои паки"
            >
              <FolderOpen size={16} />
            </button>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenProfile}
              title="Тарифы и Звёзды"
            >
              <Star size={16} />
            </button>
          </nav>

          {/* Bottom user & settings */}
          <div className="rail-bottom">
            <div className="rail-user-tile" onClick={onOpenProfile} title="Профиль">
              {userName[0].toUpperCase()}
            </div>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenProfile}
              title="Настройки"
            >
              <Settings size={16} />
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="main-viewport">
          {/* TOP BAR */}
          <header className="top-bar">
            <div className="top-bar-left">
              <button
                type="button"
                className="nav-arrow-tile"
                onClick={onOpenCatalog}
                title="Назад"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                className="nav-arrow-tile"
                onClick={onOpenStudio}
                title="Вперёд"
              >
                <ArrowRight size={14} />
              </button>
              <nav className="breadcrumbs">
                <span className="breadcrumb-item" onClick={onOpenCatalog}>
                  Home
                </span>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-current">AI Assistant</span>
              </nav>
            </div>

            <div className="top-bar-right">
              <div className="glass-search-box">
                <Search size={13} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search Anything..."
                />
              </div>

              <button type="button" className="top-icon-btn" title="Уведомления">
                <Bell size={15} />
                <span className="unread-dot" />
              </button>

              <div
                className="top-avatar-tile"
                onClick={onOpenProfile}
                title={`Профиль: ${userName} • Баланс: ${subscription.generationsBalance} ✨`}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {userName[0].toUpperCase()}
                </span>
              </div>
            </div>
          </header>

          {/* SUB BAR (UNDER TOP BAR) */}
          <section className="sub-bar">
            <div className="segmented-toggle">
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat Mode
              </button>
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={onOpenStudio}
              >
                Overview
              </button>
            </div>

            <div className="status-pill-glass">
              <span className="status-pulse-dot" />
              <span className="status-pill-text">AI Agents Running</span>
              <span className="status-count-badge">17</span>
            </div>
          </section>

          {/* HERO CONTAINER (708u WIDE) */}
          <section className="hero-container">
            {/* LIVING GLASS ORB LAYER (145u, -30.5u margin) */}
            <div className="orb-stage-layer">
              <div className="orb-still-plate" />
              <canvas
                ref={canvasRef}
                className="orb-canvas-core"
                width={290}
                height={290}
              />
              <div className="orb-glass-specular" />
            </div>

            {/* HERO TYPOGRAPHY */}
            <div className="hero-text-block">
              <p className="hero-greeting">Good Morning, {userName}</p>
              <h1 className="hero-headline">
                <span className="headline-word-mask">
                  <span className="headline-word-inner">WHAT'S</span>
                </span>
                <span className="headline-word-mask">
                  <span className="headline-word-inner">ON</span>
                </span>
                <span className="headline-word-mask">
                  <span className="headline-word-inner">YOUR</span>
                </span>
                <span className="headline-word-mask">
                  <span className="headline-word-inner">MIND?</span>
                </span>
              </h1>
              <p className="hero-subline">
                Get personalized financial insights, smarter recommendations & 60 FPS Telegram animated emojis.
              </p>
            </div>

            {/* COMPOSER (114u tall, #151515, 14u radius, 1.2u gradient hairline border) */}
            <div className="composer-wrap">
              <div className="composer-input-row">
                <textarea
                  className="composer-textarea"
                  placeholder="Ask Anything... (например: собери анимированный пак MAGNAT с золотой плашкой)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
              </div>

              <div className="composer-controls-row">
                <div className="composer-chips-left">
                  <button
                    type="button"
                    className="composer-chip icon-only"
                    title="Прикрепить шаблон"
                    onClick={onOpenCatalog}
                  >
                    <Plus size={12} />
                  </button>
                  <button type="button" className="composer-chip">
                    <span>Normal</span>
                    <ChevronDown size={11} />
                  </button>
                  <button type="button" className="composer-chip">
                    <span>Deep Think</span>
                    <ChevronDown size={11} />
                  </button>
                </div>

                <div className="composer-actions-right">
                  <button
                    type="button"
                    className="voice-btn"
                    title="Голосовой ввод"
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    type="button"
                    className="send-gradient-btn"
                    onClick={() => handleSend()}
                    title="Отправить"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* AI RESULT FLYOUT */}
            {aiResponse && (
              <div className="ai-response-card show">
                <div className="response-head">
                  <Sparkles size={15} />
                  <span>AI Iris Assistant • MAGNAT Core</span>
                </div>
                <div className="response-body">{aiResponse}</div>
                <div className="response-actions">
                  <button
                    type="button"
                    className="action-btn-small"
                    onClick={onOpenStudio}
                  >
                    <Wand2 size={13} />
                    Открыть в Студии
                  </button>
                  <button
                    type="button"
                    className="action-btn-small"
                    onClick={onOpenPacks}
                  >
                    <FolderOpen size={13} />
                    Перейти к Пакам
                  </button>
                </div>
              </div>
            )}

            {/* THREE QUICK-ACTION CARDS */}
            <div className="quick-actions-row">
              <div
                className="quick-card"
                onClick={() =>
                  handleSend('Собрать персональный финансовый смарт-пак MAGNAT с золотым логотипом')
                }
              >
                <div className="card-icon-wrap card-icon-blue">
                  <Sparkles size={18} />
                </div>
                <div className="card-content">
                  <span className="card-title">Smart Budget Plan</span>
                  <span className="card-subtitle">Create My Budget</span>
                </div>
              </div>

              <div
                className="quick-card"
                onClick={() =>
                  handleSend('Сгенерировать 3D плашку с градиентом #2F6BFF для Telegram эмодзи')
                }
              >
                <div className="card-icon-wrap card-icon-violet">
                  <Star size={18} />
                </div>
                <div className="card-content">
                  <span className="card-title">Set a Saving Goal</span>
                  <span className="card-subtitle">Set a Goal</span>
                </div>
              </div>

              <div
                className="quick-card"
                onClick={() =>
                  handleSend('Подготовить архив .tgs файлов для заливки в официальный бот @Stickers')
                }
              >
                <div className="card-icon-wrap card-icon-indigo">
                  <LayoutGrid size={18} />
                </div>
                <div className="card-content">
                  <span className="card-title">Track My Expenses</span>
                  <span className="card-subtitle">Monitor Spending</span>
                </div>
              </div>
            </div>

            {/* RECENT CONVERSATIONS (TREE LINE) */}
            <div className="recent-conversations-block">
              <div className="recent-header-row">
                <span className="recent-title">Recent Conversations</span>
                <span className="see-more-link" onClick={onOpenPacks}>
                  See More →
                </span>
              </div>

              <div className="tree-container">
                <div
                  className="tree-item"
                  onClick={() =>
                    handleSend('How much did I spend on dining out this month?')
                  }
                >
                  <span className="tree-node-dot" />
                  <span className="tree-question-text">
                    How much did I spend on dining out this month?
                  </span>
                  <span className="tree-time-tag">10m ago</span>
                </div>

                <div
                  className="tree-item"
                  onClick={() =>
                    handleSend('Can I afford a weekend trip to Lisbon next week?')
                  }
                >
                  <span className="tree-node-dot" />
                  <span className="tree-question-text">
                    Can I afford a weekend trip to Lisbon next week?
                  </span>
                  <span className="tree-time-tag">2h ago</span>
                </div>

                <div
                  className="tree-item"
                  onClick={() =>
                    handleSend('Set an automated rule to save 15% of upcoming payouts')
                  }
                >
                  <span className="tree-node-dot" />
                  <span className="tree-question-text">
                    Set an automated rule to save 15% of upcoming payouts
                  </span>
                  <span className="tree-time-tag">Yesterday</span>
                </div>

                <div
                  className="tree-item"
                  onClick={() =>
                    handleSend('Optimize recurring subscription costs across all services')
                  }
                >
                  <span className="tree-node-dot" />
                  <span className="tree-question-text">
                    Optimize recurring subscription costs across all services
                  </span>
                  <span className="tree-time-tag">3 days ago</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
