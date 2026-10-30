/**
 * Subscription & Monetization Engine (Matching tier / tierapp reference)
 * Manages Generation Balance, Subscriptions (Pro, Pro+, Max, Редактор),
 * Period selection (Month, 3 Months, Year), Telegram Stars & Promo codes.
 */

import type { CatalogItem } from './catalog';

export type PlanId = 'free' | 'pro' | 'pro_plus' | 'max' | 'editor' | 'lifetime';
export type BillingPeriod = 'month' | '3months' | 'year';

export interface SubscriptionState {
  plan: PlanId;
  isPro: boolean;
  generationsBalance: number;
  billingPeriod: BillingPeriod;
  activatedAt: number | null;
  expiresAt: number | null;
  promoCode: string | null;
  userId?: number | string;
}

const STORAGE_KEY = 'magnat_subscription_state_v2';
export const SUB_CHANGE_EVENT = 'magnat:sub_changed';

/** Free tier allowed template IDs */
export const FREE_TEMPLATE_IDS = new Set<string>([
  'shablony1_001', // Шаблон Ракета
  'shablony1_002', // Шаблон Корона
  'shablony1_003', // Шаблон Огонь
  'shablony1_004', // Шаблон Ссылка
  'shablony1_005', // Шаблон Карта
  'shablony1_006', // Шаблон Алмаз
  'shablony1_007', // Шаблон Звезда
  'shablony1_008', // Шаблон Чат
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

export interface PlanConfig {
  id: PlanId;
  name: string;
  badge?: string;
  subtitle: string;
  highlight: string;
  prices: {
    month: { rub: number; stars: number; label: string };
    '3months': { rub: number; stars: number; label: string };
    year: { rub: number; stars: number; label: string };
  };
  badges: string[];
}

export const TIER_PLANS: Record<Exclude<PlanId, 'free'>, PlanConfig> = {
  pro: {
    id: 'pro',
    name: 'Pro',
    subtitle: 'свой логотип на каждом эмодзи',
    highlight: '150 генераций ✨ в месяц',
    prices: {
      month: { rub: 200, stars: 150, label: '200 ₽ в месяц' },
      '3months': { rub: 510, stars: 380, label: '510 ₽ за 3 месяца' },
      year: { rub: 1680, stars: 1200, label: '1680 ₽ за год' },
    },
    badges: [
      '150 эмодзи в паке',
      '120 стикеров в паке',
      '335 шаблонов',
      '1 сохранённый стиль',
      'свой логотип',
      'весь веб-редактор',
    ],
  },
  pro_plus: {
    id: 'pro_plus',
    name: 'Pro+',
    badge: 'выгодно',
    subtitle: 'редактор для каждого эмодзи отдельно',
    highlight: '400 генераций ✨ в месяц',
    prices: {
      month: { rub: 350, stars: 250, label: '350 ₽ в месяц' },
      '3months': { rub: 890, stars: 640, label: '890 ₽ за 3 месяца' },
      year: { rub: 2940, stars: 2100, label: '2940 ₽ за год' },
    },
    badges: [
      '200 эмодзи в паке',
      '120 стикеров в паке',
      '335 шаблонов',
      '5 сохранённых стилей',
      'свой логотип',
      'весь веб-редактор',
      'редактор каждого эмодзи',
    ],
  },
  max: {
    id: 'max',
    name: 'Max',
    badge: 'популярный',
    subtitle: 'сборки без месячного лимита',
    highlight: 'без месячного лимита ✨',
    prices: {
      month: { rub: 700, stars: 500, label: '700 ₽ в месяц' },
      '3months': { rub: 1780, stars: 1280, label: '1780 ₽ за 3 месяца' },
      year: { rub: 5880, stars: 4200, label: '5880 ₽ за год' },
    },
    badges: [
      '200 эмодзи в паке',
      '120 стикеров в паке',
      '335 шаблонов',
      '∞ сохранённых стилей',
      'свой логотип',
      'весь веб-редактор',
      'редактор каждого эмодзи',
      '1 сборка за раз',
    ],
  },
  editor: {
    id: 'editor',
    name: 'Редактор',
    subtitle: 'весь веб-редактор editor.tierapp.top',
    highlight: 'веб-редактор ✨',
    prices: {
      month: { rub: 200, stars: 150, label: '200 ₽ в месяц' },
      '3months': { rub: 510, stars: 380, label: '510 ₽ за 3 месяца' },
      year: { rub: 1680, stars: 1200, label: '1680 ₽ за год' },
    },
    badges: [
      'все шаблоны',
      'эффекты',
      'экспорт и заливка в telegram',
      'брифы для клиентов',
    ],
  },
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime VIP',
    badge: 'навсегда',
    subtitle: 'пожизненный безлимит ко всему сервису',
    highlight: 'навсегда без лимитов 👑',
    prices: {
      month: { rub: 1490, stars: 990, label: '1490 ₽ навсегда' },
      '3months': { rub: 1490, stars: 990, label: '1490 ₽ навсегда' },
      year: { rub: 1490, stars: 990, label: '1490 ₽ навсегда' },
    },
    badges: [
      'все 284 шаблона навсегда',
      'все будущие обновления',
      '∞ генераций',
      'прямая публикация в @Stickers',
      'VIP поддержка',
    ],
  },
};

export const PRICING = {
  pro: {
    title: 'MAGNAT PRO · Месяц',
    badge: 'ПОПУЛЯРНЫЙ',
    stars: 150,
    rub: 200,
    ton: 0.9,
    usdt: 2.5,
    durationDays: 30,
    features: TIER_PLANS.pro.badges,
  },
  lifetime: {
    title: 'LIFETIME VIP · Навсегда',
    badge: 'ВЫГОДА -60%',
    stars: 990,
    rub: 1490,
    ton: 5.5,
    usdt: 16.9,
    durationDays: null,
    features: TIER_PLANS.lifetime.badges,
  },
};

const DEFAULT_STATE: SubscriptionState = {
  plan: 'free',
  isPro: false,
  generationsBalance: 1, // 1 free trial generation
  billingPeriod: 'month',
  activatedAt: null,
  expiresAt: null,
  promoCode: null,
};

/** Load active state */
export function getSubscription(): SubscriptionState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const data: SubscriptionState = JSON.parse(raw);

    // Expiration check
    if (data.plan !== 'free' && data.plan !== 'lifetime' && data.expiresAt && Date.now() > data.expiresAt) {
      const expired: SubscriptionState = {
        ...DEFAULT_STATE,
        generationsBalance: data.generationsBalance,
      };
      saveSubscription(expired);
      return expired;
    }

    return {
      ...data,
      isPro: data.plan !== 'free',
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** Save and broadcast */
export function saveSubscription(state: SubscriptionState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(SUB_CHANGE_EVENT, { detail: state }));
  } catch (err) {
    console.error('Failed to save subscription:', err);
  }
}

/** Purchase piece-rate generations */
export function addGenerations(count: number): SubscriptionState {
  const cur = getSubscription();
  const next: SubscriptionState = {
    ...cur,
    generationsBalance: cur.generationsBalance + count,
  };
  saveSubscription(next);
  return next;
}

/** Consume 1 generation if available */
export function consumeGeneration(): { ok: boolean; remaining: number } {
  const cur = getSubscription();
  // Max and lifetime have unlimited generations
  if (cur.plan === 'max' || cur.plan === 'lifetime') {
    return { ok: true, remaining: 999999 };
  }
  if (cur.generationsBalance > 0) {
    const next: SubscriptionState = {
      ...cur,
      generationsBalance: cur.generationsBalance - 1,
    };
    saveSubscription(next);
    return { ok: true, remaining: next.generationsBalance };
  }
  return { ok: false, remaining: 0 };
}

/** Activate a subscription plan */
export function activateSubscription(
  plan: PlanId,
  period: BillingPeriod = 'month',
  promoCode: string | null = null,
): SubscriptionState {
  const cur = getSubscription();
  let days = 30;
  if (period === '3months') days = 90;
  if (period === 'year') days = 365;

  let addedGenerations = 150;
  if (plan === 'pro') addedGenerations = 150;
  if (plan === 'pro_plus') addedGenerations = 400;
  if (plan === 'max') addedGenerations = 99999;
  if (plan === 'editor') addedGenerations = 50;
  if (plan === 'lifetime') addedGenerations = 999999;

  const expiresAt = plan === 'lifetime' ? null : Date.now() + days * 24 * 60 * 60 * 1000;

  const next: SubscriptionState = {
    plan,
    isPro: plan !== 'free',
    generationsBalance: cur.generationsBalance + addedGenerations,
    billingPeriod: period,
    activatedAt: Date.now(),
    expiresAt,
    promoCode,
  };
  saveSubscription(next);
  return next;
}

/** Reset to free */
export function resetSubscription(): SubscriptionState {
  const cur = getSubscription();
  const next: SubscriptionState = {
    ...DEFAULT_STATE,
    generationsBalance: cur.generationsBalance,
  };
  saveSubscription(next);
  return next;
}

/** Check if template is locked */
export function isTemplateLocked(item: CatalogItem, isProUser: boolean): boolean {
  if (isProUser) return false;
  return !FREE_TEMPLATE_IDS.has(item.id);
}

/** Redeem Promo Code */
export function redeemPromoCode(rawCode: string): { success: boolean; message: string; state?: SubscriptionState } {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return {
      success: false,
      message: 'Введите промокод.',
    };
  }

  // No hardcoded free bonus loopholes
  return {
    success: false,
    message: 'Промокод не найден или срок его действия истёк.',
  };
}
