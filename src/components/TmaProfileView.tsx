import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  KeyRound,
  LayoutGrid,
  Minus,
  Plus,
  Sparkles,
  Star,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  activateSubscription,
  addGenerations,
  redeemPromoCode,
  TIER_PLANS,
  type BillingPeriod,
  type PlanId,
  type SubscriptionState,
} from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';
import { getTelegramWebApp, haptic } from '../lib/telegram';

interface TmaProfileViewProps {
  subscription: SubscriptionState;
  telegramUser: TelegramUser | null;
  onSubscriptionChange: (next: SubscriptionState) => void;
  onBackToCatalog: () => void;
  onOpenPacks: () => void;
}

export function TmaProfileView({
  subscription,
  telegramUser,
  onSubscriptionChange,
  onBackToCatalog,
  onOpenPacks,
}: TmaProfileViewProps) {
  const [periodKey, setPeriodKey] = useState<BillingPeriod>('month');
  const [pieceCount, setPieceCount] = useState<number>(20);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{
    type: 'piece' | 'plan';
    planId?: PlanId;
    title: string;
    rubPrice: number;
    starsPrice: number;
  } | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'stars' | 'sbp' | 'crypto' | 'promo'>('stars');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoFeedback, setPromoFeedback] = useState<{ text: string; bad?: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const userName = telegramUser?.first_name || 'magnat';
  const userHandle = telegramUser?.username ? `@${telegramUser.username}` : '@ggg468q';

  // Calculate piece price: 9 ₽ per unit, >= 50 is 7 ₽
  const unitRate = pieceCount >= 50 ? 7 : 9;
  const pieceRubTotal = pieceCount * unitRate;
  const pieceStarsTotal = Math.max(10, Math.round(pieceRubTotal * 0.75));

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    haptic('light');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenPieceCheckout = () => {
    haptic('medium');
    setCheckoutTarget({
      type: 'piece',
      title: `${pieceCount} генераций`,
      rubPrice: pieceRubTotal,
      starsPrice: pieceStarsTotal,
    });
    setShowCheckoutModal(true);
  };

  const handleOpenPlanCheckout = (planId: PlanId) => {
    if (planId === 'free') return;
    haptic('medium');
    const cfg = TIER_PLANS[planId];
    const p = cfg.prices[periodKey];
    setCheckoutTarget({
      type: 'plan',
      planId,
      title: `${cfg.name} (${cfg.prices[periodKey].label})`,
      rubPrice: p.rub,
      starsPrice: p.stars,
    });
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = () => {
    if (!checkoutTarget) return;
    haptic('success');

    if (checkoutTarget.type === 'piece') {
      const next = addGenerations(pieceCount);
      onSubscriptionChange(next);
    } else if (checkoutTarget.planId) {
      const next = activateSubscription(checkoutTarget.planId, periodKey, 'DIRECT_PAY');
      onSubscriptionChange(next);
    }

    const tg = getTelegramWebApp();
    if (tg?.showAlert) {
      tg.showAlert(`🎉 Оплата успешна! Тариф «${checkoutTarget.title}» активирован.`);
    }

    setShowCheckoutModal(false);
  };

  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) return;
    const res = redeemPromoCode(promoCodeInput);
    if (res.success && res.state) {
      haptic('success');
      setPromoFeedback({ text: res.message, bad: false });
      onSubscriptionChange(res.state);
      setTimeout(() => {
        setShowCheckoutModal(false);
      }, 1500);
    } else {
      haptic('error');
      setPromoFeedback({ text: res.message, bad: true });
    }
  };

  return (
    <div className="tma-view-container tma-profile-view">
      {/* TOP HEADER (Matching Screenshot 2) */}
      <div className="tma-top-bar">
        <button type="button" className="tma-nav-back-btn" onClick={onBackToCatalog}>
          <ArrowLeft size={18} />
          <span>tier</span>
        </button>

        <div className="tma-balance-pill">
          <Sparkles size={14} color="#ffd700" />
          <span>{subscription.generationsBalance}</span>
        </div>
      </div>

      <div className="tma-profile-scroll-body">
        {/* TITLE */}
        <h1 className="tma-page-title">профиль</h1>

        {/* HERO AVATAR WITH VERTICAL GLOW LINES (Matching Screenshot 2) */}
        <div className="tma-profile-hero">
          <div className="tma-hero-glow-lines" />
          <div className="tma-hero-avatar-ring">
            {telegramUser?.photo_url ? (
              <img src={telegramUser.photo_url} alt="User" className="tma-hero-avatar-img" />
            ) : (
              <div className="tma-hero-avatar-placeholder">
                <User size={46} color="#ffffff" />
              </div>
            )}
          </div>
          <h2 className="tma-profile-name">{userName}</h2>
          <div className="tma-profile-handle-pill">{userHandle}</div>
        </div>

        {/* CARD 1: БАЛАНС ГЕНЕРАЦИЙ (Matching Screenshot 2) */}
        <div className="tma-card-box tma-balance-card">
          <div className="tma-balance-left">
            <div className="tma-card-sublabel">
              <CreditCard size={14} className="tma-icon-muted" />
              <span>баланс генераций</span>
            </div>
            <div className="tma-balance-number">{subscription.generationsBalance}</div>
          </div>
          <button
            type="button"
            className="tma-btn-blue tma-btn-buy"
            onClick={handleOpenPieceCheckout}
          >
            купить
          </button>
        </div>

        {/* CARD 2: КУПИТЬ ГЕНЕРАЦИИ (Matching Screenshot 2) */}
        <div className="tma-card-box tma-stepper-card">
          <div className="tma-stepper-head">
            <h3 className="tma-card-heading">купить генерации</h3>
            <span className="tma-card-subtext">9 ₽ за штуку · -10% · от 50 по 7 ₽</span>
          </div>

          <div className="tma-stepper-row">
            <div className="tma-counter-control">
              <button
                type="button"
                className="tma-counter-btn"
                onClick={() => {
                  setPieceCount((c) => Math.max(5, c - 5));
                  haptic('select');
                }}
              >
                <Minus size={15} />
              </button>
              <span className="tma-counter-val">{pieceCount}</span>
              <button
                type="button"
                className="tma-counter-btn"
                onClick={() => {
                  setPieceCount((c) => c + 5);
                  haptic('select');
                }}
              >
                <Plus size={15} />
              </button>
            </div>

            <button
              type="button"
              className="tma-btn-blue tma-btn-pay-stepper"
              onClick={handleOpenPieceCheckout}
            >
              оплатить {pieceRubTotal} ₽
            </button>
          </div>
        </div>

        {/* SECTION 3: ПОДПИСКА (Matching Screenshots 2, 3, 4, 5) */}
        <div className="tma-subs-section">
          <div className="tma-subs-head">
            <h3 className="tma-section-title">подписка</h3>
            <span className="tma-subs-subtext">
              генерации каждый месяц дешевле, чем поштучно
            </span>
          </div>

          {/* PERIOD TABS: месяц | 3 месяца -15% | год -30% */}
          <div className="tma-period-tabs">
            <button
              type="button"
              className={`tma-period-tab ${periodKey === 'month' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('month');
                haptic('select');
              }}
            >
              месяц
            </button>
            <button
              type="button"
              className={`tma-period-tab ${periodKey === '3months' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('3months');
                haptic('select');
              }}
            >
              3 месяца <span className="tma-discount-tag">-15%</span>
            </button>
            <button
              type="button"
              className={`tma-period-tab ${periodKey === 'year' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('year');
                haptic('select');
              }}
            >
              год <span className="tma-discount-tag">-30%</span>
            </button>
          </div>

          {/* PLAN CARDS */}
          {/* 1. PRO */}
          <div
            className={`tma-plan-card ${subscription.plan === 'pro' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('pro')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <span className="tma-plan-title">Pro</span>
                <span className="tma-plan-subtitle">{TIER_PLANS.pro.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.pro.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 мес' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.pro.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.pro.badges.map((b, idx) => (
                <span key={idx} className="tma-badge-chip">
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* 2. PRO+ */}
          <div
            className={`tma-plan-card ${subscription.plan === 'pro_plus' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('pro_plus')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tma-plan-title">Pro+</span>
                  <span className="tma-badge-pill-cyan">выгодно</span>
                </div>
                <span className="tma-plan-subtitle">{TIER_PLANS.pro_plus.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.pro_plus.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 мес' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.pro_plus.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.pro_plus.badges.map((b, idx) => (
                <span key={idx} className="tma-badge-chip">
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* 3. MAX */}
          <div
            className={`tma-plan-card ${subscription.plan === 'max' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('max')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tma-plan-title">Max</span>
                  <span className="tma-badge-pill-cyan">популярный</span>
                </div>
                <span className="tma-plan-subtitle">{TIER_PLANS.max.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.max.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 мес' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.max.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.max.badges.map((b, idx) => (
                <span key={idx} className="tma-badge-chip">
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* 4. РЕДАКТОР */}
          <div
            className={`tma-plan-card ${subscription.plan === 'editor' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('editor')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <span className="tma-plan-title">Редактор</span>
                <span className="tma-plan-subtitle">{TIER_PLANS.editor.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.editor.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 мес' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.editor.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.editor.badges.map((b, idx) => (
                <span key={idx} className="tma-badge-chip">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: АККАУНТ (Matching Screenshot 4) */}
        <div className="tma-account-section">
          <div className="tma-section-title">аккаунт</div>

          <div className="tma-card-box tma-account-current-card">
            <div>
              <div className="tma-account-status-name">текущий</div>
              <div className="tma-account-status-desc">
                {subscription.plan === 'free'
                  ? 'бесплатный · 1 пробный экспорт'
                  : `активен тариф ${subscription.plan.toUpperCase()}`}
              </div>
            </div>
            <div className="tma-account-gens-count">
              {subscription.plan === 'max' || subscription.plan === 'lifetime'
                ? '∞ генераций'
                : `${subscription.generationsBalance} генераций`}
            </div>
          </div>

          <div
            className="tma-card-box tma-account-link-row"
            onClick={() => {
              handleOpenPlanCheckout('pro');
            }}
          >
            <span>бесплатно и проба</span>
            <ChevronRight size={18} className="tma-icon-muted" />
          </div>
        </div>

        {/* SECTION 5: ПОЛЕЗНОЕ И ПРОМОКОД */}
        <div className="tma-useful-section">
          <div className="tma-section-title">полезное</div>

          <div className="tma-card-box tma-promo-inline-card">
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Ввести промокод</span>
            <div className="tma-promo-row">
              <input
                type="text"
                className="tma-promo-input"
                placeholder="MAGNAT_VIP или MAX"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
              />
              <button type="button" className="tma-btn-blue" onClick={handleApplyPromo}>
                Применить
              </button>
            </div>
            {promoFeedback && (
              <div className={`tma-feedback ${promoFeedback.bad ? 'bad' : 'good'}`}>
                {promoFeedback.text}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* FLOATING BOTTOM DOCK (Matching Screenshot 2) */}
      <div className="tma-dock-wrapper">
        <nav className="tma-floating-dock">
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onBackToCatalog();
              haptic('select');
            }}
          >
            <LayoutGrid size={17} />
            <span>шаблоны</span>
          </button>
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onOpenPacks();
              haptic('select');
            }}
          >
            <Trash2 size={17} />
            <span>мои паки</span>
          </button>
          <button type="button" className="tma-dock-btn active">
            <User size={17} />
            <span>профиль</span>
          </button>
        </nav>
        <div className="tma-dock-footer">@tierubot</div>
      </div>

      {/* CHECKOUT MODAL (STARS / SBP / TON / DEMO) */}
      {showCheckoutModal && checkoutTarget && (
        <div className="sub-modal-backdrop" onClick={() => setShowCheckoutModal(false)}>
          <div className="sub-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="sub-modal-header">
              <div className="sub-badge-pro">
                <Sparkles size={14} color="#ffd700" />
                <span>ОПЛАТА ТАРИФА</span>
              </div>
              <button
                type="button"
                className="sub-close-btn"
                onClick={() => setShowCheckoutModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ textAlign: 'center', margin: '14px 0 20px 0' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800 }}>
                {checkoutTarget.title}
              </h2>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Выберите удобный способ оплаты без комиссий
              </div>
            </div>

            {/* PAYMENT TABS */}
            <div className="sub-payment-tabs" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={`sub-tab-btn ${paymentMethod === 'stars' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('stars')}
              >
                <Star size={14} fill="#fbbf24" color="#fbbf24" /> Stars
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${paymentMethod === 'sbp' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('sbp')}
              >
                <Zap size={14} /> СБП / Карты
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${paymentMethod === 'crypto' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('crypto')}
              >
                <Wallet size={14} /> TON Crypto
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${paymentMethod === 'promo' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('promo')}
              >
                <KeyRound size={14} /> Промокод
              </button>
            </div>

            {paymentMethod === 'stars' && (
              <div className="sub-tab-content">
                <div className="sub-stars-promo">
                  <div className="sub-stars-icon-large">⭐️</div>
                  <div className="sub-stars-text">
                    <strong>Оплата через Telegram Stars</strong>
                    <p>Мгновенно списывается с баланса Telegram в 1 клик</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="sub-primary-pay-btn"
                  onClick={handleConfirmPayment}
                >
                  <Star size={16} fill="#000" color="#000" />
                  Оплатить {checkoutTarget.starsPrice} Stars ({checkoutTarget.rubPrice} ₽)
                </button>
              </div>
            )}

            {paymentMethod === 'sbp' && (
              <div className="sub-tab-content">
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#cbd5e1' }}>
                  Прямой перевод по СБП (0% комиссий):
                </p>
                <div className="sub-address-group">
                  <div className="sub-address-label">
                    <span>Номер телефона:</span>
                    <span className="sub-crypto-amount">{checkoutTarget.rubPrice} ₽</span>
                  </div>
                  <div className="sub-address-row">
                    <code>+7 (900) 000-00-00 (Тинькофф / Сбер)</code>
                    <button
                      type="button"
                      className="sub-copy-btn"
                      onClick={() => handleCopy('+79000000000', 'phone')}
                    >
                      {copiedKey === 'phone' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="sub-primary-pay-btn" onClick={handleConfirmPayment}>
                    Я оплатил {checkoutTarget.rubPrice} ₽
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'crypto' && (
              <div className="sub-tab-content">
                <div className="sub-address-group">
                  <div className="sub-address-label">
                    <span>TON Кошелёк:</span>
                    <span className="sub-crypto-amount">
                      {(checkoutTarget.rubPrice / 250).toFixed(2)} TON
                    </span>
                  </div>
                  <div className="sub-address-row">
                    <code>UQDFN_EXAMPLE_TON_MAGNAT_WALLET_ADDRESS_PRO_2026</code>
                    <button
                      type="button"
                      className="sub-copy-btn"
                      onClick={() => handleCopy('UQDFN_EXAMPLE_TON_MAGNAT_WALLET_ADDRESS_PRO_2026', 'ton')}
                    >
                      {copiedKey === 'ton' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="sub-primary-pay-btn" onClick={handleConfirmPayment}>
                    Подтвердить перевод
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'promo' && (
              <div className="sub-tab-content">
                <div className="sub-promo-input-row">
                  <input
                    type="text"
                    className="sub-promo-input"
                    placeholder="MAGNAT_VIP, MAX или DEMO"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                  />
                  <button type="button" className="sub-promo-submit-btn" onClick={handleApplyPromo}>
                    Активировать
                  </button>
                </div>
                {promoFeedback && (
                  <div className={`sub-promo-feedback ${promoFeedback.bad ? 'bad' : 'good'}`}>
                    {promoFeedback.text}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                type="button"
                className="sub-link-btn"
                onClick={handleConfirmPayment}
              >
                ⚡ Быстрая тестовая активация
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
