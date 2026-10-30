/**
 * Subscription & Monetization Engine
 * Manages Free vs PRO vs Lifetime tiers, promo codes, and feature gating.
 */

import type { CatalogItem } from './catalog';

export type SubscriptionPlan = 'free' | 'pro' | 'lifetime';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  isPro: boolean;
  activatedAt: number | null;
  expiresAt: number | null; // null for lifetime or free
  promoCode: string | null;
  userId?: number | string;
}

const STORAGE_KEY = 'magnat_subscription_state_v1';
export const SUB_CHANGE_EVENT = 'magnat:sub_changed';

/** Free tier allowed template IDs */
export const FREE_TEMPLATE_IDS = new Set<string>([
  'shablony1_012', // Баннер 1/3
  'shablony1_013', // Баннер 2/3
  'shablony1_014', // Баннер 3/3
  'shablony1_001', // Шаблон Ракета
  'shablony1_002', // Шаблон Корона
  'shablony1_003', // Шаблон Огонь
  'shablony1_004', // Шаблон Ссылка
  'shablony1_005', // Шаблон Карта
  'classic_001',
  'classic_002',
  'classic_003',
  'classic_004',
  'classic_005',
  'classic_006',
  'classic_007',
  'classic_008',
  'classic_009',
  'classic_010',
]);

/** Pricing table */
export const PRICING = {
  pro: {
    title: 'MAGNAT PRO · Месяц',
    badge: 'ПОПУЛЯРНЫЙ',
    stars: 290,
    rub: 390,
    ton: 1.5,
    usdt: 4.9,
    durationDays: 30,
    features: [
      'Все 284 анимированных Telegram шаблона',
      'Мульти-редактирование до 60 эмодзи в 1 клик',
      'Загрузка своего SVG логотипа в слои',
      'Экспорт готового ZIP архива для @Stickers',
      'Все премиум шрифты (Unbounded, Pacifico и др.)',
      'Экспорт без водяных знаков и ограничений',
      'Приоритетный рендер 60 FPS',
    ],
  },
  lifetime: {
    title: 'LIFETIME VIP · Навсегда',
    badge: 'ВЫГОДА -60%',
    stars: 890,
    rub: 1290,
    ton: 4.5,
    usdt: 14.9,
    durationDays: null, // infinite
    features: [
      'Доступ навсегда ко всем 284 шаблонам',
      'Все будущие обновления и новые паки бесплатно',
      'Мульти-редактирование без ограничений',
      'Загрузка векторных логотипов и фирменных цветов',
      'Экспорт для @Stickers и прямая отправка в Telegram',
      'Закрытый чат резидентов и поддержка создателя',
      'Статус VIP MAGNAT в профиле',
    ],
  },
};

/** Load active subscription from localStorage */
export function getSubscription(): SubscriptionState {
  if (typeof window === 'undefined') {
    return { plan: 'free', isPro: false, activatedAt: null, expiresAt: null, promoCode: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { plan: 'free', isPro: false, activatedAt: null, expiresAt: null, promoCode: null };
    }
    const data: SubscriptionState = JSON.parse(raw);

    // Check expiration for time-limited PRO
    if (data.plan === 'pro' && data.expiresAt && Date.now() > data.expiresAt) {
      const expired: SubscriptionState = {
        plan: 'free',
        isPro: false,
        activatedAt: null,
        expiresAt: null,
        promoCode: null,
      };
      saveSubscription(expired);
      return expired;
    }

    return {
      ...data,
      isPro: data.plan === 'pro' || data.plan === 'lifetime',
    };
  } catch {
    return { plan: 'free', isPro: false, activatedAt: null, expiresAt: null, promoCode: null };
  }
}

/** Save subscription to localStorage and broadcast event */
export function saveSubscription(state: SubscriptionState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(SUB_CHANGE_EVENT, { detail: state }));
  } catch (err) {
    console.error('Failed to save subscription:', err);
  }
}

/** Grant a plan */
export function activateSubscription(
  plan: 'pro' | 'lifetime',
  durationDays: number | null = 30,
  promoCode: string | null = null,
): SubscriptionState {
  const expiresAt = durationDays ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : null;
  const state: SubscriptionState = {
    plan,
    isPro: true,
    activatedAt: Date.now(),
    expiresAt,
    promoCode,
  };
  saveSubscription(state);
  return state;
}

/** Reset to free */
export function resetSubscription(): SubscriptionState {
  const state: SubscriptionState = {
    plan: 'free',
    isPro: false,
    activatedAt: null,
    expiresAt: null,
    promoCode: null,
  };
  saveSubscription(state);
  return state;
}

/** Check if a template requires PRO */
export function isTemplateLocked(item: CatalogItem, isProUser: boolean): boolean {
  if (isProUser) return false;
  return !FREE_TEMPLATE_IDS.has(item.id);
}

/** Promo code redemption */
export function redeemPromoCode(rawCode: string): { success: boolean; message: string; state?: SubscriptionState } {
  const code = rawCode.trim().toUpperCase();

  if (code === 'MAGNAT' || code === 'MAGNAT_VIP' || code === 'FOUNDER' || code === 'ADMIN') {
    const next = activateSubscription('lifetime', null, code);
    return {
      success: true,
      message: '🎉 Промокод активирован! Вам предоставлен пожизненный доступ MAGNAT VIP!',
      state: next,
    };
  }

  if (code === 'CRYPTO2026' || code === 'PROPASS' || code === 'START2026' || code === 'TGSTARS') {
    const next = activateSubscription('pro', 30, code);
    return {
      success: true,
      message: '🎉 Промокод активирован! Доступ MAGNAT PRO на 30 дней разблокирован!',
      state: next,
    };
  }

  if (code === 'DEMO' || code === 'TEST' || code === 'FREEWEEK') {
    const next = activateSubscription('pro', 7, code);
    return {
      success: true,
      message: '🎉 Промокод активирован! Пробный период PRO на 7 дней включён!',
      state: next,
    };
  }

  return {
    success: false,
    message: 'Неверный промокод. Проверьте правильность ввода.',
  };
}
