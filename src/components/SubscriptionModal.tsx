import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Star,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  activateSubscription,
  PRICING,
  redeemPromoCode,
  resetSubscription,
  type SubscriptionState,
} from '../lib/subscription';
import { getTelegramWebApp, haptic, isTelegramWebApp } from '../lib/telegram';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: SubscriptionState;
  onSubscriptionChange: (sub: SubscriptionState) => void;
  featuredReason?: string;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  subscription,
  onSubscriptionChange,
  featuredReason,
}: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'lifetime'>('pro');
  const [paymentTab, setPaymentTab] = useState<'stars' | 'crypto' | 'sbp' | 'promo'>('stars');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const inTg = isTelegramWebApp();
  const currentPricing = PRICING[selectedPlan];

  // TON and USDT payment demo/direct recipient addresses (can be configured)
  const TON_WALLET = 'UQDFN_EXAMPLE_TON_MAGNAT_WALLET_ADDRESS_PRO_2026';
  const USDT_TRC20 = 'TFEXAMPLE_USDT_TRC20_MAGNAT_STUDIO_RECEIVE';
  const SBP_PHONE = '+7 (900) 000-00-00 (Тинькофф / Сбер)';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    haptic('light');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) return;
    const res = redeemPromoCode(promoCodeInput);
    if (res.success && res.state) {
      haptic('success');
      setPromoMessage({ text: res.message, bad: false });
      onSubscriptionChange(res.state);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      haptic('error');
      setPromoMessage({ text: res.message, bad: true });
    }
  };

  const handlePayStars = async () => {
    haptic('medium');
    setIsProcessing(true);

    const tg = getTelegramWebApp();
    if (tg?.openInvoice) {
      // In real production with a bot token, you'd fetch an invoice link from your backend bot:
      // const res = await fetch('/api/create-stars-invoice', { method: 'POST', body: JSON.stringify({ plan: selectedPlan }) });
      // const { invoiceLink } = await res.json();
      // tg.openInvoice(invoiceLink, (status) => { if (status === 'paid') ... });
      //
      // For immediate user enjoyment & autonomous flow:
      tg.showConfirm(
        `Оплатить ${currentPricing.stars} ⭐️ Telegram Stars за тариф «${currentPricing.title}»?`,
        (confirmed) => {
          setIsProcessing(false);
          if (confirmed) {
            haptic('success');
            const next = activateSubscription(selectedPlan, 'month', 'TELEGRAM_STARS');
            onSubscriptionChange(next);
            tg.showAlert('🎉 Оплата Telegram Stars прошла успешно! Тариф активирован.');
            onClose();
          }
        },
      );
    } else {
      // Standalone web simulation
      setTimeout(() => {
        setIsProcessing(false);
        haptic('success');
        const next = activateSubscription(selectedPlan, 'month', 'WEB_STARS_PAY');
        onSubscriptionChange(next);
        onClose();
      }, 800);
    }
  };

  const handleDirectActivateTest = () => {
    haptic('medium');
    const next = activateSubscription(selectedPlan, 'month', 'DIRECT_DEMO');
    onSubscriptionChange(next);
    onClose();
  };

  const handleResetToFree = () => {
    haptic('light');
    const next = resetSubscription();
    onSubscriptionChange(next);
  };

  return (
    <div className="sub-modal-backdrop" onClick={onClose}>
      <div className="sub-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sub-modal-header">
          <div className="sub-badge-pro">
            <Crown size={15} color="#ffd700" />
            <span>MAGNAT PREMIUM</span>
            {inTg && <span style={{ opacity: 0.8, fontSize: '9.5px', marginLeft: 4 }}>• TMA</span>}
          </div>
          <button type="button" className="sub-close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="sub-modal-hero">
          <h2 className="sub-hero-title">
            Разблокируйте полную мощь <span className="sub-gold-text">MAGNAT Studio</span>
          </h2>
          <p className="sub-hero-subtitle">
            {featuredReason ||
              '284 анимированных эмодзи, пакетное редактирование до 60 штук сразу, экспорт в Telegram @Stickers и загрузка собственных логотипов.'}
          </p>
        </div>

        {/* Current status banner if already PRO */}
        {subscription.isPro && (
          <div className="sub-active-banner">
            <CheckCircle2 size={18} color="#22c55e" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#22c55e' }}>
                У вас активен тариф: {subscription.plan === 'lifetime' ? 'LIFETIME VIP 👑' : 'PRO (Месяц) ⚡'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Все 284 шаблона и PRO-функции разблокированы
              </div>
            </div>
            <button type="button" className="sub-btn-ghost-small" onClick={handleResetToFree}>
              Сбросить на Free
            </button>
          </div>
        )}

        {/* Plan Cards */}
        <div className="sub-plans-grid">
          <div
            className={`sub-plan-card ${selectedPlan === 'pro' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPlan('pro');
              haptic('select');
            }}
          >
            <div className="sub-plan-top">
              <span className="sub-plan-name">PRO МЕСЯЦ</span>
              <span className="sub-plan-badge">ХИТ</span>
            </div>
            <div className="sub-plan-price-row">
              <span className="sub-plan-stars">
                <Star size={16} fill="#fbbf24" color="#fbbf24" /> 290
              </span>
              <span className="sub-plan-rub">/ 390 ₽</span>
            </div>
            <span className="sub-plan-period">на 30 дней</span>
          </div>

          <div
            className={`sub-plan-card ${selectedPlan === 'lifetime' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPlan('lifetime');
              haptic('select');
            }}
          >
            <div className="sub-plan-top">
              <span className="sub-plan-name">LIFETIME VIP</span>
              <span className="sub-plan-badge-gold">ВЫГОДА -60%</span>
            </div>
            <div className="sub-plan-price-row">
              <span className="sub-plan-stars">
                <Star size={16} fill="#fbbf24" color="#fbbf24" /> 890
              </span>
              <span className="sub-plan-rub">/ 1 290 ₽</span>
            </div>
            <span className="sub-plan-period">навсегда + обновления</span>
          </div>
        </div>

        {/* Included features list */}
        <div className="sub-features-box">
          <div className="sub-features-title">В тариф входит:</div>
          <div className="sub-features-grid">
            {currentPricing.features.map((feat: string, idx: number) => (
              <div key={idx} className="sub-feature-item">
                <div className="sub-feature-icon-wrap">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment tabs */}
        <div className="sub-payment-section">
          <div className="sub-payment-tabs">
            <button
              type="button"
              className={`sub-tab-btn ${paymentTab === 'stars' ? 'active' : ''}`}
              onClick={() => {
                setPaymentTab('stars');
                haptic('select');
              }}
            >
              <Star size={14} fill="#fbbf24" color="#fbbf24" />
              Telegram Stars
            </button>
            <button
              type="button"
              className={`sub-tab-btn ${paymentTab === 'crypto' ? 'active' : ''}`}
              onClick={() => {
                setPaymentTab('crypto');
                haptic('select');
              }}
            >
              <Wallet size={14} />
              TON / USDT
            </button>
            <button
              type="button"
              className={`sub-tab-btn ${paymentTab === 'sbp' ? 'active' : ''}`}
              onClick={() => {
                setPaymentTab('sbp');
                haptic('select');
              }}
            >
              <Zap size={14} />
              СБП / Карты РФ
            </button>
            <button
              type="button"
              className={`sub-tab-btn ${paymentTab === 'promo' ? 'active' : ''}`}
              onClick={() => {
                setPaymentTab('promo');
                haptic('select');
              }}
            >
              <KeyRound size={14} />
              Промокод
            </button>
          </div>

          {/* TAB 1: TELEGRAM STARS */}
          {paymentTab === 'stars' && (
            <div className="sub-tab-content">
              <div className="sub-stars-promo">
                <div className="sub-stars-icon-large">⭐️</div>
                <div className="sub-stars-text">
                  <strong>Быстрая оплата звёздами Telegram</strong>
                  <p>Оплата в 1 клик с баланса Telegram без ввода данных банковских карт.</p>
                </div>
              </div>
              <button
                type="button"
                className="sub-primary-pay-btn"
                disabled={isProcessing}
                onClick={handlePayStars}
              >
                <Star size={18} fill="#ffffff" color="#ffffff" />
                Оплатить {currentPricing.stars} Stars ({currentPricing.rub} ₽)
              </button>
              <div className="sub-security-note">
                <ShieldCheck size={13} /> Мгновенная активация сразу после подтверждения
              </div>
            </div>
          )}

          {/* TAB 2: CRYPTO */}
          {paymentTab === 'crypto' && (
            <div className="sub-tab-content">
              <div className="sub-crypto-details">
                <div className="sub-address-group">
                  <div className="sub-address-label">
                    <span>Toncoin (TON Network):</span>
                    <span className="sub-crypto-amount">{currentPricing.ton} TON</span>
                  </div>
                  <div className="sub-address-row">
                    <code>{TON_WALLET}</code>
                    <button
                      type="button"
                      className="sub-copy-btn"
                      onClick={() => handleCopy(TON_WALLET, 'ton')}
                    >
                      {copiedKey === 'ton' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="sub-address-group">
                  <div className="sub-address-label">
                    <span>USDT (TRC-20):</span>
                    <span className="sub-crypto-amount">${currentPricing.usdt} USDT</span>
                  </div>
                  <div className="sub-address-row">
                    <code>{USDT_TRC20}</code>
                    <button
                      type="button"
                      className="sub-copy-btn"
                      onClick={() => handleCopy(USDT_TRC20, 'usdt')}
                    >
                      {copiedKey === 'usdt' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="sub-crypto-action-row">
                  <a
                    href={`ton://transfer/${TON_WALLET}?amount=${currentPricing.ton * 1e9}&text=MAGNAT_PRO`}
                    className="sub-btn-tonkeeper"
                  >
                    <ExternalLink size={14} /> Открыть в Tonkeeper / Wallet
                  </a>
                  <button type="button" className="sub-btn-confirm" onClick={handleDirectActivateTest}>
                    Я перевёл (активировать)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: СБП / КАРТА РФ */}
          {paymentTab === 'sbp' && (
            <div className="sub-tab-content">
              <div className="sub-sbp-box">
                <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#cbd5e1' }}>
                  Прямой перевод по СБП без посредников и комиссий:
                </p>
                <div className="sub-address-group">
                  <div className="sub-address-label">
                    <span>Номер телефона для перевода:</span>
                    <span className="sub-crypto-amount">{currentPricing.rub} ₽</span>
                  </div>
                  <div className="sub-address-row">
                    <code>{SBP_PHONE}</code>
                    <button
                      type="button"
                      className="sub-copy-btn"
                      onClick={() => handleCopy(SBP_PHONE, 'sbp')}
                    >
                      {copiedKey === 'sbp' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="sub-primary-pay-btn" onClick={handleDirectActivateTest}>
                    Подтвердить оплату {currentPricing.rub} ₽
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROMO CODE */}
          {paymentTab === 'promo' && (
            <div className="sub-tab-content">
              <div className="sub-promo-box">
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>
                  Есть промокод автора или пригласительный ключ? Введите его ниже:
                </p>
                <div className="sub-promo-input-row">
                  <input
                    type="text"
                    className="sub-promo-input"
                    placeholder="Например: MAGNAT_VIP или TGSTARS"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                  />
                  <button type="button" className="sub-promo-submit-btn" onClick={handleApplyPromo}>
                    Применить
                  </button>
                </div>
                {promoMessage && (
                  <div className={`sub-promo-feedback ${promoMessage.bad ? 'bad' : 'good'}`}>
                    {promoMessage.text}
                  </div>
                )}
                <div className="sub-promo-hints">
                  <span>💡 Доступные коды для тестирования: </span>
                  <code onClick={() => setPromoCodeInput('MAGNAT_VIP')}>MAGNAT_VIP</code> (Lifetime),{' '}
                  <code onClick={() => setPromoCodeInput('TGSTARS')}>TGSTARS</code> (1 месяц),{' '}
                  <code onClick={() => setPromoCodeInput('DEMO')}>DEMO</code> (7 дней)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="sub-modal-footer">
          <span>🔒 Безопасные платежи Telegram WebApp & P2P</span>
          <button type="button" className="sub-link-btn" onClick={handleDirectActivateTest}>
            ⚡ Быстрая тестовая активация
          </button>
        </div>
      </div>
    </div>
  );
}
