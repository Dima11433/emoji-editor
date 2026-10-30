/**
 * Telegram Mini App (TMA) SDK Bridge & Helpers
 * Supports Telegram WebApp API 6.0+
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramWebAppObject {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    show(): void;
    hide(): void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText(text: string): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setParams(params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  showPopup(params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }> }, callback?: (buttonId: string) => void): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebAppObject;
    };
  }
}

/** Check if running inside Telegram WebApp */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  // If ?tma=1 or ?tg=1 in URL, treat as TMA simulation mode
  if (window.location.search.includes('tma=1') || window.location.search.includes('tg=1')) {
    return true;
  }
  return Boolean(window.Telegram?.WebApp?.initData);
}

/** Get Telegram WebApp singleton */
export function getTelegramWebApp(): TelegramWebAppObject | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** Get Telegram User details if available */
export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user;
  }
  // Fallback demo user if simulated
  if (typeof window !== 'undefined' && (window.location.search.includes('tma=1') || window.location.search.includes('tg=1'))) {
    return {
      id: 7770001,
      first_name: 'Magnat',
      last_name: 'VIP',
      username: 'magnat_holder',
      is_premium: true,
    };
  }
  return null;
}

/** Trigger Haptic Vibration */
export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select' = 'light') {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;
  try {
    if (type === 'select') {
      tg.HapticFeedback.selectionChanged();
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch {
    // Ignore unsupported
  }
}

/** Initialize TMA options */
export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#0b0d13');
    tg.setBackgroundColor?.('#0b0d13');
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }
  } catch (err) {
    console.warn('Telegram WebApp init warning:', err);
  }
}

/** Open external or telegram link */
export function openSafeLink(url: string) {
  const tg = getTelegramWebApp();
  if (tg) {
    if (url.startsWith('https://t.me/') || url.startsWith('tg://')) {
      tg.openTelegramLink(url);
    } else {
      tg.openLink(url);
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
