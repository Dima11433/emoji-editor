import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  LayoutGrid,
  Link2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Type,
  Undo2,
  Crown,
  ArrowLeft,
} from 'lucide-react';
import type { Font } from 'opentype.js';
import { BrandPanel } from './components/BrandPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LayersPanel } from './components/LayersPanel';
import { PackLinkModal } from './components/PackLinkModal';
import { PackTray, type PackItem } from './components/PackTray';
import { PalettePanel, type BulkColorOp } from './components/PalettePanel';
import { Preview, type PreviewSticker } from './components/Preview';
import { TelegramModal } from './components/TelegramModal';
import { TemplatesModal } from './components/TemplatesModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { TmaCatalogView } from './components/TmaCatalogView';
import { TmaProfileView } from './components/TmaProfileView';
import { TmaPacksView } from './components/TmaPacksView';
import { TmaEditorView } from './components/TmaEditorView';
import { IrisAssistantView } from './components/IrisAssistantView';
import {
  getSubscription,
  SUB_CHANGE_EVENT,
  type SubscriptionState,
} from './lib/subscription';
import {
  getTelegramUser,
  getTelegramWebApp,
  haptic,
  initTelegramApp,
  isTelegramWebApp,
} from './lib/telegram';
import {
  applyBrandSlot,
  readBrandSlotInfo,
  resetBrandSlot,
  type BrandSlotOptions,
} from './lib/brandSlot';
import {
  adjustLightSat,
  applyColorTheme,
  COLOR_THEMES,
  collectColors,
  grayscale,
  invert,
  replaceColor,
  shiftHue,
  type ColorThemeId,
  type PaletteEntry,
} from './lib/colors';
import { applyShapeEffects, getEffects, type Effects } from './lib/effects';
import { loadFont, type FontId } from './lib/fonts';
import { fileToVectorLogo, type VectorLogo } from './lib/logoVector';
import {
  adjustNodeTransform,
  buildTree,
  colorScope,
  duplicateNode,
  getNode,
  moveNode,
  readNodeOpacity,
  removeNode,
  rename,
  toggleHidden,
  type NodePath,
  type TreeNode,
} from './lib/layers';
import { emptyDoc, type LottieDoc } from './lib/lottie';
import { createPackZip, importPackZip } from './lib/packZip';
import { pixelate } from './lib/pixelSample';
import { CATALOG, loadCatalogDoc, type CatalogItem } from './lib/templates';
import { formatKb, optimize, parseSticker, serialize, tgsSize, toTgsAutoFit } from './lib/tgs';
import { checkTelegram, MAX_BYTES, trimToLimit } from './lib/validate';

interface WorkspaceSnap {
  items: PackItem[];
  selectedIds: string[];
  primaryId: string;
}

interface History {
  snap: WorkspaceSnap;
  past: WorkspaceSnap[];
  future: WorkspaceSnap[];
  lastKey: string | null;
  lastAt: number;
}

type Action =
  | { type: 'apply'; next: WorkspaceSnap; key: string | null; at: number }
  | { type: 'reset'; snap: WorkspaceSnap }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 45;
const MAX_MULTI_SELECT = 60;

const shapedCache = new WeakMap<LottieDoc, LottieDoc>();
function getShapedCached(doc: LottieDoc): LottieDoc {
  const hit = shapedCache.get(doc);
  if (hit) return hit;
  const computed = applyShapeEffects(doc);
  shapedCache.set(doc, computed);
  return computed;
}

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/#/g, '')
      .replace(/·/g, '')
      .replace(/\//g, '-')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_') || 'emoji'
  );
}

function makeUid(prefix = 'stk'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSnap(snap: WorkspaceSnap): WorkspaceSnap {
  const items =
    snap.items.length > 0
      ? snap.items
      : [{ id: 'fallback-1', name: 'emoji', catalogId: null, doc: emptyDoc() }];
  const validIds = new Set(items.map((i) => i.id));
  let selectedIds = snap.selectedIds.filter((id) => validIds.has(id));
  if (!selectedIds.length) {
    selectedIds = [items[0].id];
  }
  const primaryId = selectedIds.includes(snap.primaryId) ? snap.primaryId : selectedIds[0];
  return { items, selectedIds, primaryId };
}

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'apply': {
      const next = normalizeSnap(action.next);
      const merge =
        action.key !== null && action.key === state.lastKey && action.at - state.lastAt < 1000;
      return {
        snap: next,
        past: merge ? state.past : [...state.past, state.snap].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case 'reset':
      return {
        snap: normalizeSnap(action.snap),
        past: [],
        future: [],
        lastKey: null,
        lastAt: 0,
      };
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        snap: prev,
        past: state.past.slice(0, -1),
        future: [state.snap, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        snap: next,
        past: [...state.past, state.snap],
        future: rest,
        lastKey: null,
        lastAt: 0,
      };
    }
  }
}

function collectMultiPalette(docs: LottieDoc[]): PaletteEntry[] {
  const counts = new Map<string, number>();
  for (const d of docs) {
    for (const entry of collectColors(d)) {
      counts.set(entry.hex, (counts.get(entry.hex) ?? 0) + entry.count);
    }
  }
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);
}


export default function App() {
  const [hist, dispatch] = useReducer(reducer, null, () => {
    const first = CATALOG[0];
    const initItem: PackItem = {
      id: 'init-1',
      name: sanitizeFileName(first?.name ?? 'Шаблон_001'),
      catalogId: first?.id ?? null,
      doc: emptyDoc(first?.name ?? 'Шаблон #001'),
    };
    return {
      snap: { items: [initItem], selectedIds: [initItem.id], primaryId: initItem.id },
      past: [],
      future: [],
      lastKey: null,
      lastAt: 0,
    };
  });

  const { items: pack, selectedIds, primaryId } = hist.snap;

  const selectedStickers = useMemo(() => {
    const byId = new Map(pack.map((p) => [p.id, p]));
    const list = selectedIds.map((id) => byId.get(id)).filter((x): x is PackItem => Boolean(x));
    return list.length > 0 ? list : [pack[0]];
  }, [pack, selectedIds]);

  const primarySticker = useMemo(
    () => selectedStickers.find((s) => s.id === primaryId) ?? selectedStickers[0],
    [primaryId, selectedStickers],
  );

  const doc = primarySticker.doc;
  const fileName = primarySticker.name;
  const selectedCount = selectedStickers.length;

  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [mainView, setMainView] = useState<'studio' | 'tma_catalog' | 'tma_profile' | 'tma_packs' | 'tma_editor' | 'iris_assistant'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'iris' || params.get('iris') === '1') {
        return 'iris_assistant';
      }
      if (params.get('mode') === 'tma') {
        return 'tma_catalog';
      }
      // If mobile viewport width (< 900px), use Telegram Mini App mobile catalog
      if (window.innerWidth < 900) {
        return 'tma_catalog';
      }
    }
    // Desktop / Website (wide screen >= 900px): use Glass Iris Studio Editor
    return 'iris_assistant';
  });

  const [sub, setSub] = useState<SubscriptionState>(getSubscription);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subFeaturedReason, setSubFeaturedReason] = useState<string | undefined>();
  const [mobileTab, setMobileTab] = useState<'canvas' | 'brand' | 'layers'>('canvas');
  const tgUser = useMemo(() => getTelegramUser(), []);
  const inTma = useMemo(() => isTelegramWebApp(), []);

  const [selectedNodePath, setSelectedNodePath] = useState<NodePath | null>(null);
  const [isEmptyHero, setIsEmptyHero] = useState(true);
  const [showTgModal, setShowTgModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [leftFilter, setLeftFilter] = useState<'all' | 'text' | 'shape'>('all');
  const [showPackTray, setShowPackTray] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalAddToPack, setModalAddToPack] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [fontBusy, setFontBusy] = useState(false);
  const [uploadedLogo, setUploadedLogo] = useState<VectorLogo | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fontsCacheRef = useRef<Map<FontId, Font[]>>(new Map());
  const snapRef = useRef(hist.snap);
  snapRef.current = hist.snap;

  const say = useCallback((text: string, bad = false) => setToast({ text, bad }), []);

  // TMA initialization and subscription listener
  useEffect(() => {
    initTelegramApp();

    const handleSubChange = (e: Event) => {
      const custom = e as CustomEvent<SubscriptionState>;
      if (custom.detail) {
        setSub(custom.detail);
      } else {
        setSub(getSubscription());
      }
    };
    window.addEventListener(SUB_CHANGE_EVENT, handleSubChange);
    return () => window.removeEventListener(SUB_CHANGE_EVENT, handleSubChange);
  }, []);

  // Sync Telegram BackButton with modals and TMA views
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;

    const anyModalOpen = showModal || showSubModal || showTgModal || showLinkModal;
    const isSubView = mainView !== 'tma_catalog';

    if (anyModalOpen || isSubView) {
      tg.BackButton.show();
      const onBack = () => {
        if (showSubModal) setShowSubModal(false);
        else if (showModal) setShowModal(false);
        else if (showTgModal) setShowTgModal(false);
        else if (showLinkModal) setShowLinkModal(false);
        else if (mainView !== 'tma_catalog') {
          setMainView('tma_catalog');
          haptic('light');
        }
      };
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton.offClick(onBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [showModal, showSubModal, showTgModal, showLinkModal, mainView]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const ensureFont = useCallback(async (id: FontId): Promise<Font[]> => {
    const ready = fontsCacheRef.current.get(id);
    if (ready) return ready;
    const loaded = await loadFont(id);
    fontsCacheRef.current.set(id, loaded);
    return loaded;
  }, []);

  // Preload Montserrat Black + initial template on startup
  useEffect(() => {
    ensureFont('montserrat').catch(() => {});
    const startupTargets = CATALOG.slice(0, 1);
    if (!startupTargets.length) return;

    let cancelled = false;
    Promise.all(startupTargets.map((item) => loadCatalogDoc(item)))
      .then((docs) => {
        if (cancelled) return;
        const entries: PackItem[] = startupTargets.map((item, idx) => ({
          id: `start-${idx + 1}`,
          name: sanitizeFileName(item.name),
          catalogId: item.id,
          doc: docs[idx],
        }));
        dispatch({
          type: 'reset',
          snap: {
            items: entries,
            selectedIds: entries.map((e) => e.id),
            primaryId: entries[0].id,
          },
        });
      })
      .catch(() => {
        if (!cancelled) say('Не удалось загрузить стартовые шаблоны', true);
      });
    return () => {
      cancelled = true;
    };
  }, [ensureFont, say]);

  /** Mutates ALL currently selected emojis in a single atomic Undo/Redo step. */
  const editTargets = useCallback(
    (fn: (d: LottieDoc, item: PackItem) => void, key: string | null = null) => {
      const cur = snapRef.current;
      const selSet = new Set(cur.selectedIds);
      const nextItems = cur.items.map((item) => {
        if (!selSet.has(item.id)) return item;
        const cloned = structuredClone(item.doc);
        fn(cloned, item);
        return { ...item, doc: cloned };
      });
      dispatch({
        type: 'apply',
        next: { ...cur, items: nextItems },
        key,
        at: Date.now(),
      });
    },
    [],
  );

  /** Mutates ONLY the focused primary emoji (e.g. node-specific layer tree edits). */
  const editPrimary = useCallback(
    (fn: (d: LottieDoc) => void, key: string | null = null) => {
      const cur = snapRef.current;
      const nextItems = cur.items.map((item) => {
        if (item.id !== cur.primaryId) return item;
        const cloned = structuredClone(item.doc);
        fn(cloned);
        return { ...item, doc: cloned };
      });
      dispatch({
        type: 'apply',
        next: { ...cur, items: nextItems },
        key,
        at: Date.now(),
      });
    },
    [],
  );

  const renamePrimaryFile = (nextName: string) => {
    const cur = snapRef.current;
    const nextItems = cur.items.map((item) =>
      item.id === cur.primaryId ? { ...item, name: nextName } : item,
    );
    dispatch({
      type: 'apply',
      next: { ...cur, items: nextItems },
      key: 'rename:file',
      at: Date.now(),
    });
  };

  /** Loads a single sticker on stage (preserving pack items if PackTray is open). */
  const openSingleSticker = useCallback(
    (nextDoc: LottieDoc, name: string, catalogId: string | null = null) => {
      const cleanName = sanitizeFileName(name);
      const cur = snapRef.current;

      if (showPackTray) {
        const existing = catalogId ? cur.items.find((i) => i.catalogId === catalogId) : undefined;
        if (existing) {
          dispatch({
            type: 'apply',
            next: { items: cur.items, selectedIds: [existing.id], primaryId: existing.id },
            key: null,
            at: Date.now(),
          });
        } else {
          const entry: PackItem = { id: makeUid(), name: cleanName, catalogId, doc: nextDoc };
          dispatch({
            type: 'apply',
            next: {
              items: [...cur.items, entry],
              selectedIds: [entry.id],
              primaryId: entry.id,
            },
            key: null,
            at: Date.now(),
          });
        }
      } else {
        const entry: PackItem = { id: makeUid(), name: cleanName, catalogId, doc: nextDoc };
        dispatch({
          type: 'apply',
          next: { items: [entry], selectedIds: [entry.id], primaryId: entry.id },
          key: null,
          at: Date.now(),
        });
      }
      setIsEmptyHero(false);
      setSelectedNodePath(null);
    },
    [showPackTray],
  );

  /** Opens multiple catalog emojis simultaneously for synchronized live editing. */
  const openCatalogBatchForEdit = useCallback(
    async (catItems: CatalogItem[]) => {
      if (!sub.isPro && catItems.length > 1) {
        haptic('warning');
        setSubFeaturedReason('Одновременное редактирование нескольких эмодзи сразу доступно в тарифе MAGNAT PRO.');
        setShowSubModal(true);
        return;
      }
      const capped = catItems.slice(0, MAX_MULTI_SELECT);
      if (!capped.length) return;
      try {
        if (capped.length > 4) {
          say(`Загружаю ${capped.length} эмодзи для одновременного редактирования...`);
        }
        const docs = await Promise.all(capped.map((it) => loadCatalogDoc(it)));
        const cur = snapRef.current;
        const newEntries: PackItem[] = capped.map((it, idx) => ({
          id: makeUid(`m${idx}`),
          name: sanitizeFileName(it.name),
          catalogId: it.id,
          doc: docs[idx],
        }));

        const nextItems = showPackTray ? [...cur.items, ...newEntries] : newEntries;
        const nextSel = newEntries.map((e) => e.id);
        dispatch({
          type: 'apply',
          next: {
            items: nextItems,
            selectedIds: nextSel,
            primaryId: nextSel[0],
          },
          key: null,
          at: Date.now(),
        });
        setIsEmptyHero(false);
        setSelectedNodePath(null);
        say(
          newEntries.length > 1
            ? `Выбрано ${newEntries.length} эмодзи — все изменения применяются сразу ко всем!`
            : `Выбран «${capped[0].name}»`,
        );
      } catch (e) {
        say(e instanceof Error ? e.message : 'Не удалось загрузить выбранные эмодзи', true);
      }
    },
    [say, showPackTray, sub.isPro],
  );

  
  const collapseToSingle = useCallback(() => {
    const cur = snapRef.current;
    if (cur.selectedIds.length <= 1) return;
    const keepId = cur.primaryId;
    const nextItems = showPackTray ? cur.items : cur.items.filter((i) => i.id === keepId);
    dispatch({
      type: 'apply',
      next: { items: nextItems, selectedIds: [keepId], primaryId: keepId },
      key: null,
      at: Date.now(),
    });
  }, [showPackTray]);

  const setPrimaryFocus = useCallback((id: string) => {
    const cur = snapRef.current;
    if (!cur.selectedIds.includes(id) || cur.primaryId === id) return;
    dispatch({
      type: 'apply',
      next: { ...cur, primaryId: id },
      key: 'focus',
      at: Date.now(),
    });
    setSelectedNodePath(null);
  }, []);

  const addToPack = (newDoc: LottieDoc, name: string, catId: string | null = null) => {
    const cleanName = sanitizeFileName(name);
    const cur = snapRef.current;
    const newItem: PackItem = {
      id: makeUid('pack'),
      name: cleanName,
      catalogId: catId,
      doc: structuredClone(newDoc),
    };
    dispatch({
      type: 'apply',
      next: {
        items: [...cur.items, newItem],
        selectedIds: [newItem.id],
        primaryId: newItem.id,
      },
      key: null,
      at: Date.now(),
    });
    setIsEmptyHero(false);
    setSelectedNodePath(null);
    setShowPackTray(true);
    say(`Добавлен «${name}» в пак (#${cur.items.length + 1})`);
  };

  const handleAddBatchToPack = async (catItems: CatalogItem[]) => {
    if (!catItems.length) return;
    try {
      say(`Загружаю ${catItems.length} эмодзи в пак...`);
      const docs = await Promise.all(catItems.map((it) => loadCatalogDoc(it)));
      const cur = snapRef.current;
      const newPackItems: PackItem[] = catItems.map((it, idx) => ({
        id: makeUid(`b${idx}`),
        name: sanitizeFileName(it.name),
        catalogId: it.id,
        doc: docs[idx],
      }));
      const nextItems = [...cur.items, ...newPackItems];
      const nextSel = newPackItems.slice(0, MAX_MULTI_SELECT).map((p) => p.id);
      dispatch({
        type: 'apply',
        next: {
          items: nextItems,
          selectedIds: nextSel,
          primaryId: nextSel[0],
        },
        key: null,
        at: Date.now(),
      });
      setIsEmptyHero(false);
      setShowPackTray(true);
      say(`Добавлено и выбрано ${newPackItems.length} эмодзи в паке!`);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи в пак', true);
    }
  };

  const handleAddBatchToPackItems = useCallback(
    (newItems: { doc: LottieDoc; name: string; catalogId?: string | null }[]) => {
      if (!newItems.length) return;
      const cur = snapRef.current;
      const packEntries: PackItem[] = newItems.map((it, idx) => ({
        id: makeUid(`batch${idx}`),
        name: sanitizeFileName(it.name),
        catalogId: it.catalogId ?? null,
        doc: structuredClone(it.doc),
      }));
      const nextItems = [...cur.items, ...packEntries];
      dispatch({
        type: 'apply',
        next: {
          items: nextItems,
          selectedIds: [packEntries[0].id],
          primaryId: packEntries[0].id,
        },
        key: null,
        at: Date.now(),
      });
      setIsEmptyHero(false);
      say(`Добавлено ${packEntries.length} эмодзи в ваш пак! (Всего: ${nextItems.length})`);
    },
    [say],
  );

  const handlePackSelect = (id: string, toggleMulti: boolean) => {
    const cur = snapRef.current;
    if (!toggleMulti) {
      dispatch({
        type: 'apply',
        next: { items: cur.items, selectedIds: [id], primaryId: id },
        key: null,
        at: Date.now(),
      });
      setSelectedNodePath(null);
      return;
    }

    if (cur.selectedIds.includes(id)) {
      if (cur.selectedIds.length <= 1) return;
      const nextSel = cur.selectedIds.filter((x) => x !== id);
      dispatch({
        type: 'apply',
        next: {
          items: cur.items,
          selectedIds: nextSel,
          primaryId: cur.primaryId === id ? nextSel[0] : cur.primaryId,
        },
        key: null,
        at: Date.now(),
      });
    } else {
      dispatch({
        type: 'apply',
        next: {
          items: cur.items,
          selectedIds: [...cur.selectedIds, id].slice(0, MAX_MULTI_SELECT),
          primaryId: cur.primaryId,
        },
        key: null,
        at: Date.now(),
      });
    }
  };

  const handleSelectAllInPack = () => {
    const cur = snapRef.current;
    const allIds = cur.items.slice(0, MAX_MULTI_SELECT).map((i) => i.id);
    dispatch({
      type: 'apply',
      next: { items: cur.items, selectedIds: allIds, primaryId: cur.primaryId },
      key: null,
      at: Date.now(),
    });
    say(`Выбрано ${allIds.length} эмодзи в паке для одновременного редактирования!`);
  };

  const duplicatePackSticker = (id: string) => {
    const cur = snapRef.current;
    const idx = cur.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const src = cur.items[idx];
    const clone: PackItem = {
      id: makeUid('copy'),
      name: `${src.name}_copy`,
      catalogId: src.catalogId,
      doc: structuredClone(src.doc),
    };
    const next = [...cur.items.slice(0, idx + 1), clone, ...cur.items.slice(idx + 1)];
    dispatch({
      type: 'apply',
      next: { items: next, selectedIds: [clone.id], primaryId: clone.id },
      key: null,
      at: Date.now(),
    });
    say(`Эмодзи дублирован: ${clone.name}`);
  };

  const removePackSticker = (id: string) => {
    const cur = snapRef.current;
    if (cur.items.length <= 1) return;
    const next = cur.items.filter((i) => i.id !== id);
    const nextSel = cur.selectedIds.filter((x) => x !== id);
    const validSel = nextSel.length > 0 ? nextSel : [next[0].id];
    dispatch({
      type: 'apply',
      next: {
        items: next,
        selectedIds: validSel,
        primaryId: validSel.includes(cur.primaryId) ? cur.primaryId : validSel[0],
      },
      key: null,
      at: Date.now(),
    });
    say('Эмодзи убран из пака');
  };

  const clearUnselectedPackStickers = () => {
    const cur = snapRef.current;
    const selSet = new Set(cur.selectedIds);
    const kept = cur.items.filter((i) => selSet.has(i.id));
    if (!kept.length || kept.length === cur.items.length) {
      const onlyPrimary = cur.items.filter((i) => i.id === cur.primaryId);
      if (onlyPrimary.length > 0 && onlyPrimary.length < cur.items.length) {
        dispatch({
          type: 'apply',
          next: {
            items: onlyPrimary,
            selectedIds: [onlyPrimary[0].id],
            primaryId: onlyPrimary[0].id,
          },
          key: null,
          at: Date.now(),
        });
        say('В паке оставлен только текущий эмодзи');
      }
      return;
    }
    dispatch({
      type: 'apply',
      next: { items: kept, selectedIds: cur.selectedIds, primaryId: cur.primaryId },
      key: null,
      at: Date.now(),
    });
    say(`В паке оставлено ${kept.length} выбранных эмодзи`);
  };

  const downloadZipList = async (list: PackItem[], archivePrefix: string) => {
    if (!sub.isPro && list.length > 2) {
      haptic('warning');
      setSubFeaturedReason('Скачивание полного архива .ZIP без ограничений доступно в тарифе MAGNAT PRO.');
      setShowSubModal(true);
      return;
    }
    try {
      say(`Собираю .zip архив (${list.length} эмодзи)...`);
      const blob = await createPackZip(list, archivePrefix);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${archivePrefix}_${list.length}_emojis.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      haptic('success');
      say(`Скачан архив из ${list.length} готовых эмодзи (.tgs)!`);
    } catch (err) {
      say(err instanceof Error ? err.message : 'Ошибка сборки архива', true);
    }
  };

  const openFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    try {
      if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
        say(`Распаковываю архив ${files[0].name}...`);
        const imported = await importPackZip(await files[0].arrayBuffer());
        const packItems: PackItem[] = imported.map((s, idx) => ({
          id: makeUid(`zip${idx}`),
          name: s.name,
          catalogId: null,
          doc: s.doc,
        }));
        const selIds = packItems.slice(0, MAX_MULTI_SELECT).map((p) => p.id);
        dispatch({
          type: 'apply',
          next: { items: packItems, selectedIds: selIds, primaryId: selIds[0] },
          key: null,
          at: Date.now(),
        });
        setShowPackTray(true);
        say(`Импортировано и выбрано ${packItems.length} эмодзи из ${files[0].name}!`);
        return;
      }

      if (
        files.length === 1 &&
        (/\.(svg|png|webp|jpe?g)$/i.test(files[0].name) || files[0].type.startsWith('image/'))
      ) {
        if (!sub.isPro) {
          haptic('warning');
          setSubFeaturedReason('Векторизация собственного логотипа в слои Telegram .tgs входит в тариф MAGNAT PRO.');
          setShowSubModal(true);
          return;
        }
        const imgFile = files[0];
        say(`Векторизую логотип ${imgFile.name}...`);
        const vec = await fileToVectorLogo(imgFile);
        setUploadedLogo(vec);
        const curInfo = readBrandSlotInfo(doc);
        const nextOpts: BrandSlotOptions = {
          ...curInfo.options,
          mode: curInfo.options.mode === 'logo+text' ? 'logo+text' : 'logo',
          logo: vec,
          tintLogo: false,
          hidden: false,
          useOriginalGlyphs: false,
        };
        const fonts = nextOpts.mode === 'logo+text' ? await ensureFont(nextOpts.fontId) : null;
        editTargets((d) => {
          applyBrandSlot(d, nextOpts, fonts);
        });
        setIsEmptyHero(false);
        say(
          selectedCount > 1
            ? `Логотип «${vec.name}» установлен сразу на ${selectedCount} эмодзи!`
            : `Логотип «${vec.name}» установлен на стикер!`,
        );
        return;
      }

      if (files.length === 1) {
        const file = files[0];
        const parsed = parseSticker(new Uint8Array(await file.arrayBuffer()));
        const clean = file.name.replace(/\.(tgs|json)$/i, '');
        openSingleSticker(parsed, clean, null);
        setIsEmptyHero(false);
        say(`Открыт файл ${file.name}`);
        return;
      }

      const imported: PackItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (/\.zip$/i.test(f.name)) {
          const fromZip = await importPackZip(await f.arrayBuffer());
          for (const z of fromZip) {
            imported.push({
              id: makeUid(`f${imported.length}`),
              name: z.name,
              catalogId: null,
              doc: z.doc,
            });
          }
        } else {
          const parsed = parseSticker(new Uint8Array(await f.arrayBuffer()));
          imported.push({
            id: makeUid(`f${imported.length}`),
            name: f.name.replace(/\.(tgs|json)$/i, ''),
            catalogId: null,
            doc: parsed,
          });
        }
      }

      if (imported.length > 0) {
        const cur = snapRef.current;
        const nextItems = showPackTray ? [...cur.items, ...imported] : imported;
        const selIds = imported.slice(0, MAX_MULTI_SELECT).map((i) => i.id);
        dispatch({
          type: 'apply',
          next: { items: nextItems, selectedIds: selIds, primaryId: selIds[0] },
          key: null,
          at: Date.now(),
        });
        setIsEmptyHero(false);
        setShowPackTray(true);
        say(`Загружено и выбрано ${imported.length} эмодзи!`);
      }
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось открыть файл', true);
    }
  };

  const brandInfo = useMemo(() => readBrandSlotInfo(doc), [doc]);

  const anySelectedNeedsOverlay = useMemo(
    () =>
      selectedStickers.some((s) => {
        const info = readBrandSlotInfo(s.doc);
        return info.count === 0 || info.isInjected;
      }),
    [selectedStickers],
  );

  const handleBrandChange = useCallback(
    (nextOpts: BrandSlotOptions, mergeKey?: string, keepStickerColor = false) => {
      const needsFont =
        nextOpts.mode === 'logo+text' ||
        (nextOpts.mode === 'text' && (!nextOpts.useOriginalGlyphs || anySelectedNeedsOverlay));

      if (!needsFont) {
        editTargets((d) => {
          applyBrandSlot(d, nextOpts, null, { keepStickerColor, autoCreate: true });
        }, mergeKey ?? null);
        return;
      }

      const cachedFonts = fontsCacheRef.current.get(nextOpts.fontId);
      if (cachedFonts) {
        editTargets((d) => {
          applyBrandSlot(d, nextOpts, cachedFonts, { keepStickerColor, autoCreate: true });
        }, mergeKey ?? null);
        return;
      }

      editTargets((d) => {
        d._brandState = { ...nextOpts };
      }, mergeKey ?? null);
      setFontBusy(true);
      ensureFont(nextOpts.fontId)
        .then((loadedFonts) => {
          editTargets((d) => {
            const latest = d._brandState
              ? { ...nextOpts, ...(d._brandState as Partial<BrandSlotOptions>) }
              : nextOpts;
            applyBrandSlot(d, latest, loadedFonts, { keepStickerColor, autoCreate: true });
          }, mergeKey ?? 'brand:font');
        })
        .catch(() => say('Не удалось загрузить выбранный шрифт', true))
        .finally(() => setFontBusy(false));
    },
    [anySelectedNeedsOverlay, editTargets, ensureFont, say],
  );

  const handleBrandReset = useCallback(() => {
    const wasInjected = brandInfo.isInjected;
    editTargets((d) => {
      resetBrandSlot(d);
    });
    say(
      selectedCount > 1
        ? `Бренд сброшен на всех ${selectedCount} выбранных эмодзи`
        : wasInjected
          ? 'Бренд-слот убран с шаблона'
          : `Возвращена оригинальная надпись (${brandInfo.origText})`,
    );
  }, [brandInfo.isInjected, brandInfo.origText, editTargets, say, selectedCount]);

  const handleApplyBrandToPack = useCallback(
    async (opts: BrandSlotOptions, keepStickerColor: boolean) => {
      setFontBusy(true);
      try {
        const fonts = opts.mode !== 'logo' ? await ensureFont(opts.fontId) : null;
        const cur = snapRef.current;
        let updatedCount = 0;
        const nextItems = cur.items.map((item) => {
          const cloned = structuredClone(item.doc);
          const count = applyBrandSlot(cloned, opts, fonts, {
            keepStickerColor,
            autoCreate: true,
          });
          if (count > 0) updatedCount++;
          return { ...item, doc: cloned };
        });
        dispatch({
          type: 'apply',
          next: { ...cur, items: nextItems },
          key: null,
          at: Date.now(),
        });
        say(`Бренд установлен во все ${updatedCount} эмодзи пака!`);
      } catch (e) {
        say(e instanceof Error ? e.message : 'Ошибка пакетной замены', true);
      } finally {
        setFontBusy(false);
      }
    },
    [ensureFont, say],
  );

  const selectedNode = selectedNodePath ? getNode(doc, selectedNodePath) : undefined;
  const activeSel = selectedNode ? selectedNodePath : null;
  const selectedOpacity = useMemo(
    () => (activeSel ? readNodeOpacity(doc, activeSel) : 100),
    [doc, activeSel],
  );

  const fx = useMemo(() => getEffects(doc), [doc]);
  const shaped = useMemo(() => getShapedCached(doc), [doc]);
  const [pixelOut, setPixelOut] = useState<{ doc: LottieDoc; fps: number } | null>(null);
  const [pixelBusy, setPixelBusy] = useState(false);

  useEffect(() => {
    if (!fx.pixel.on) {
      setPixelOut(null);
      return;
    }
    let cancelled = false;
    setPixelBusy(true);
    const timer = setTimeout(() => {
      pixelate(shaped, fx.pixel.grid)
        .then((res) => !cancelled && setPixelOut(res))
        .catch(() => !cancelled && say('Не получилось пикселизировать эмодзи', true))
        .finally(() => !cancelled && setPixelBusy(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shaped, fx.pixel.on, fx.pixel.grid, say]);

  const outDoc = fx.pixel.on && pixelOut ? pixelOut.doc : shaped;
  const pixelStatus = !fx.pixel.on
    ? null
    : pixelBusy
      ? 'Считаю пиксели…'
      : pixelOut
        ? `${pixelOut.fps} к/с, чтобы влезть в 64 кБ`
        : null;

  const previewStickers = useMemo<PreviewSticker[]>(
    () =>
      selectedStickers.map((s) => ({
        id: s.id,
        name: s.name,
        catalogId: s.catalogId,
        doc: s.id === primarySticker.id ? outDoc : getShapedCached(s.doc),
      })),
    [outDoc, primarySticker.id, selectedStickers],
  );

  const downloadSingle = (kind: 'tgs' | 'json') => {
    const rawTgs = kind === 'tgs' ? toTgsAutoFit(outDoc) : null;
    const data = rawTgs ?? new TextEncoder().encode(serialize(outDoc));
    const blob = new Blob([data], {
      type: kind === 'tgs' ? 'application/x-tgsticker' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.trim() || 'magnat_emoji'}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (rawTgs && tgsSize(outDoc) > MAX_BYTES && rawTgs.length <= MAX_BYTES) {
      say(`Автоматически сжато до ${formatKb(rawTgs.length)} под лимит Telegram!`);
    }
  };

  const setEffect = <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>, merge = false) =>
    editTargets(
      (d) => {
        const cur = getEffects(d);
        d.fx = { ...cur, [key]: { ...cur[key], ...patch } };
      },
      merge ? `fx:${key}` : null,
    );

  const tree = useMemo(() => buildTree(doc), [doc]);
  const palette = useMemo(
    () =>
      activeSel
        ? collectColors(colorScope(doc, activeSel))
        : selectedCount > 1
          ? collectMultiPalette(selectedStickers.map((s) => s.doc))
          : collectColors(doc),
    [activeSel, doc, selectedCount, selectedStickers],
  );

  const [size, setSize] = useState(() => tgsSize(outDoc));
  const [checks, setChecks] = useState(() => checkTelegram(outDoc, size));

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const nextSize = tgsSize(outDoc);
      setSize(nextSize);
      setChecks(checkTelegram(outDoc, nextSize));
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [outDoc]);


  const runColorMutation = (
    fn: (node: unknown, skipBrand: boolean) => void,
    mergeKey: string | null = null,
  ) => {
    if (activeSel) {
      editPrimary((d) => fn(colorScope(d, activeSel), false), mergeKey);
    } else {
      editTargets((d) => fn(d, Boolean(d._brandState)), mergeKey);
    }
  };

  const handleApplyThemeToPack = useCallback(
    (themeId: ColorThemeId) => {
      const cur = snapRef.current;
      const nextItems = cur.items.map((item) => {
        const cloned = structuredClone(item.doc);
        applyColorTheme(cloned, themeId, { skipBrandSlot: Boolean(cloned._brandState) });
        return { ...item, doc: cloned };
      });
      dispatch({
        type: 'apply',
        next: { ...cur, items: nextItems },
        key: null,
        at: Date.now(),
      });
      const label = COLOR_THEMES.find((t) => t.id === themeId)?.label ?? themeId;
      say(`Весь пак (${cur.items.length} эмодзи) перекрашен в «${label}»!`);
    },
    [say],
  );

  const handleBulkColor = (op: BulkColorOp) => {
    runColorMutation((n, skipBrand) => {
      const opts = { skipBrandSlot: skipBrand };
      if (op === 'hue-') shiftHue(n, -30, opts);
      else if (op === 'hue+') shiftHue(n, 30, opts);
      else if (op === 'sat+') adjustLightSat(n, 0.14, 0, opts);
      else if (op === 'light+') adjustLightSat(n, 0, 0.08, opts);
      else if (op === 'light-') adjustLightSat(n, 0, -0.08, opts);
      else if (op === 'gray') grayscale(n, opts);
      else if (op === 'invert') invert(n, opts);
    });
  };

  const removeSelected = useCallback(() => {
    if (!activeSel) return;
    editPrimary((d) => removeNode(d, activeSel));
    setSelectedNodePath(null);
  }, [activeSel, editPrimary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.code === 'KeyY') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (e.key === 'Delete') {
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected]);

  const tooBig = size > MAX_BYTES;

  const filteredTree = useMemo(() => {
    if (leftFilter === 'all') return tree;
    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      return nodes.flatMap((n) => {
        const children = n.children ? filterNodes(n.children) : [];
        const nmLower = n.name.toLowerCase();
        const match =
          leftFilter === 'text'
            ? n.kind === 'text' ||
              nmLower.includes('text') ||
              nmLower.includes('надпись') ||
              nmLower.includes('nik') ||
              nmLower.includes('name') ||
              nmLower.includes('plate') ||
              nmLower.includes('user') ||
              nmLower.includes('слот')
            : n.kind === 'shape' ||
              n.kind === 'group' ||
              nmLower.includes('shape') ||
              nmLower.includes('квадрат') ||
              nmLower.includes('box') ||
              nmLower.includes('фигур');
        if (match || children.length > 0) {
          return [{ ...n, children }];
        }
        return [];
      });
    }
    const res = filterNodes(tree);
    return res.length > 0 ? res : tree;
  }, [tree, leftFilter]);

  const handleImportPackLink = useCallback(
    (link: string) => {
      const q = link.toLowerCase();
      const matches = CATALOG.filter(
        (c) => c.name.toLowerCase().includes(q) || c.categoryLabel.toLowerCase().includes(q),
      );
      if (matches.length > 0) {
        setIsEmptyHero(false);
        openCatalogBatchForEdit(matches.slice(0, 15));
        say(`Загружено ${Math.min(15, matches.length)} эмодзи из пака «${link}»`);
      } else {
        say(`Ссылка «${link}» принята. Выберите шаблон из каталога:`);
        setShowModal(true);
      }
    },
    [openCatalogBatchForEdit, say],
  );

  const handleResetAll = useCallback(() => {
    if (primarySticker.catalogId) {
      const orig = CATALOG.find((c) => c.id === primarySticker.catalogId);
      if (orig) {
        loadCatalogDoc(orig).then((loaded) => {
          editPrimary((d) => Object.assign(d, loaded));
          say(`Сброшено до оригинального шаблона «${orig.name}»`);
        });
        return;
      }
    }
    handleBrandReset();
    say('Сброшено');
  }, [editPrimary, handleBrandReset, primarySticker.catalogId, say]);

  if (mainView === 'tma_catalog') {
    return (
      <>
        <TmaCatalogView
          subscription={sub}
          telegramUser={tgUser}
          onSelectTemplate={(item) => {
            loadCatalogDoc(item)
              .then((d) => {
                openSingleSticker(d, item.name, item.id);
                setSelectedCatalogItem(item);
                setMainView(inTma ? 'tma_editor' : 'iris_assistant');
                say(`Открыт #${item.num} «${item.name}»`);
              })
              .catch((err) => {
                console.error('Failed to load catalog item:', err);
                say(`Ошибка загрузки #${item.num}: ${err.message || 'файл недоступен'}`, true);
              });
          }}
          onOpenProfile={() => {
            setMainView('tma_profile');
            haptic('select');
          }}
          onOpenPacks={() => {
            setMainView('tma_packs');
            haptic('select');
          }}
          onOpenEditor={() => {
            if (!selectedCatalogItem) {
              const matched = CATALOG.find((c) => c.id === primarySticker.catalogId) || CATALOG[0];
              setSelectedCatalogItem(matched);
            }
            setMainView(inTma ? 'tma_editor' : 'iris_assistant');
            haptic('select');
          }}
          onBackToStudio={!inTma ? () => {
            setMainView('iris_assistant');
            haptic('light');
          } : undefined}
        />
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
      </>
    );
  }

  if (mainView === 'tma_editor' || (mainView === 'studio' && (inTma || (typeof window !== 'undefined' && window.innerWidth < 900)))) {
    return (
      <>
        <TmaEditorView
          initialDoc={primarySticker.doc}
          templateItem={selectedCatalogItem || CATALOG[0]}
          subscription={sub}
          onBackToCatalog={() => {
            setMainView('tma_catalog');
            haptic('select');
          }}
          onOpenAdvancedStudio={() => {
            setMainView('iris_assistant');
            haptic('light');
          }}
          onSaveSticker={(newDoc, name) => {
            addToPack(newDoc, name, selectedCatalogItem?.id ?? null);
            say(`«${name}» сохранён в ваши паки!`);
          }}
          onAddBatchItems={handleAddBatchToPackItems}
          onOpenTemplatesModal={() => {
            setModalAddToPack(false);
            setShowModal(true);
          }}
          onOpenProModal={() => {
            setSubFeaturedReason('pro_styles');
            setShowSubModal(true);
          }}
        />
        <TemplatesModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isPro={sub.isPro}
          onOpenSubscription={(reason) => {
            setSubFeaturedReason(reason);
            setShowSubModal(true);
          }}
          onSelect={(newDoc, item, isAdd) => {
            setIsEmptyHero(false);
            if (isAdd) {
              addToPack(newDoc, item.name, item.id);
            } else {
              openSingleSticker(newDoc, item.name, item.id);
              setSelectedCatalogItem(item);
              say(`Открыт «${item.name}»`);
              setShowModal(false);
            }
          }}
          onOpenMultiForEdit={(items) => {
            setIsEmptyHero(false);
            openCatalogBatchForEdit(items);
          }}
          onAddBatchToPack={(items) => {
            setIsEmptyHero(false);
            handleAddBatchToPack(items);
          }}
          defaultAddToPack={modalAddToPack}
        />
        <SubscriptionModal
          isOpen={showSubModal}
          onClose={() => setShowSubModal(false)}
          subscription={sub}
          onSubscriptionChange={(next) => {
            setSub(next);
            say(next.isPro ? '👑 Тариф MAGNAT PRO успешно активирован!' : 'Тариф изменён на Бесплатный');
          }}
          featuredReason={subFeaturedReason}
        />
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
      </>
    );
  }

  if (mainView === 'tma_profile') {
    return (
      <>
        <TmaProfileView
          subscription={sub}
          telegramUser={tgUser}
          onSubscriptionChange={(next) => {
            setSub(next);
            say(next.isPro ? '👑 Тариф активирован!' : 'Баланс обновлён');
          }}
          onBackToCatalog={() => {
            setMainView('tma_catalog');
            haptic('light');
          }}
          onOpenPacks={() => {
            setMainView('tma_packs');
            haptic('select');
          }}
          onOpenEditor={() => {
            if (!selectedCatalogItem) {
              const matched = CATALOG.find((c) => c.id === primarySticker.catalogId) || CATALOG[0];
              setSelectedCatalogItem(matched);
            }
            setMainView(inTma ? 'tma_editor' : 'iris_assistant');
            haptic('select');
          }}
          onBackToStudio={!inTma ? () => {
            setMainView('iris_assistant');
            haptic('light');
          } : undefined}
        />
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
      </>
    );
  }

  if (mainView === 'tma_packs') {
    return (
      <>
        <TmaPacksView
          pack={pack}
          subscription={sub}
          telegramUser={tgUser}
          onOpenCatalog={() => {
            setMainView('tma_catalog');
            haptic('select');
          }}
          onOpenProfile={() => {
            setMainView('tma_profile');
            haptic('select');
          }}
          onOpenEditorForSticker={(item) => {
            const catItem = CATALOG.find((c) => c.id === item.catalogId) || CATALOG[0];
            setSelectedCatalogItem(catItem);
            openSingleSticker(item.doc, item.name, item.catalogId);
            setMainView(inTma ? 'tma_editor' : 'iris_assistant');
            haptic('select');
          }}
          onOpenEditor={() => {
            if (!selectedCatalogItem) {
              const matched = CATALOG.find((c) => c.id === primarySticker.catalogId) || CATALOG[0];
              setSelectedCatalogItem(matched);
            }
            setMainView(inTma ? 'tma_editor' : 'iris_assistant');
            haptic('select');
          }}
          onBackToStudio={!inTma ? () => {
            setMainView('iris_assistant');
            haptic('light');
          } : undefined}
          onDownloadZip={() => downloadZipList(pack, 'magnat_emoji_pack')}
          onRemoveSticker={removePackSticker}
          onClearPack={clearUnselectedPackStickers}
        />
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
      </>
    );
  }

  if (mainView === 'iris_assistant') {
    return (
      <>
        <IrisAssistantView
          initialDoc={primarySticker.doc}
          templateItem={selectedCatalogItem || CATALOG[0]}
          pack={pack}
          subscription={sub}
          telegramUser={tgUser}
          onSelectTemplate={(item) => {
            loadCatalogDoc(item)
              .then((d) => {
                openSingleSticker(d, item.name, item.id);
                setSelectedCatalogItem(item);
                say(`Открыт #${item.num} «${item.name}»`);
              })
              .catch((err) => {
                console.error('Failed to load catalog item:', err);
                say(`Ошибка загрузки #${item.num}: ${err.message || 'файл недоступен'}`, true);
              });
          }}
          onSaveSticker={(newDoc, name) => {
            addToPack(newDoc, name, selectedCatalogItem?.id ?? null);
            say(`«${name}» сохранён в ваши паки!`);
          }}
          onAddBatchItems={handleAddBatchToPackItems}
          onDownloadZip={() => downloadZipList(pack, 'magnat_emoji_pack')}
          onOpenProfile={() => {
            setMainView('tma_profile');
            haptic('select');
          }}
          onOpenAdvancedStudio={() => {
            setMainView('iris_assistant');
            haptic('light');
          }}
        />
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
      </>
    );
  }

  return (
    <div className={`tier-app ${inTma ? 'in-tma' : ''}`}>
      {/* TOP NAVBAR (Screenshot 2 Replica) */}
      <header className="tier-navbar">
        <div className="tier-nav-left">
          <button
            type="button"
            className="tier-nav-btn tier-btn-back-catalog"
            onClick={() => {
              setMainView('tma_catalog');
              haptic('select');
            }}
            title="Каталог шаблонов Telegram"
          >
            <ArrowLeft size={14} /> шаблоны
          </button>
          <span
            className="tier-logo"
            onClick={() => setMainView('tma_catalog')}
            title="Каталог шаблонов MAGNAT"
          >
            MAGNAT
          </span>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            style={{ background: 'linear-gradient(135deg, rgba(47,107,255,0.25), rgba(90,76,245,0.25))', borderColor: 'rgba(47,107,255,0.4)', color: '#93C5FD' }}
            onClick={() => {
              setMainView('iris_assistant');
              haptic('select');
            }}
            title="Glass Iris AI Assistant Dashboard"
          >
            <Sparkles size={14} color="#60A5FA" /> AI Iris
          </button>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => {
              setIsEmptyHero(true);
              say('Открыт стартовый экран MAGNAT');
            }}
            title="Создать новый проект / Стартовый экран"
          >
            <Plus size={14} /> новый
          </button>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => fileInput.current?.click()}
            title="Открыть .tgs, .json, .zip или векторный логотип"
          >
            <FolderOpen size={14} /> открыть файл
          </button>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => setShowLinkModal(true)}
            title="Импортировать пак по ссылке Telegram"
          >
            <Link2 size={14} /> пак по ссылке
          </button>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => {
              setModalAddToPack(false);
              setShowModal(true);
            }}
            title={`Открыть каталог всех ${CATALOG.length} шаблонов`}
          >
            <LayoutGrid size={14} /> шаблоны
          </button>

          <div className="tier-history-group">
            <button
              type="button"
              className="tier-nav-icon-btn"
              disabled={!hist.past.length}
              onClick={() => dispatch({ type: 'undo' })}
              title="Отменить (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="tier-nav-icon-btn"
              disabled={!hist.future.length}
              onClick={() => dispatch({ type: 'redo' })}
              title="Вернуть (Ctrl+Shift+Z)"
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              className="tier-nav-icon-btn"
              onClick={handleResetAll}
              title="Сбросить изменения к оригиналу"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="tier-nav-center">
          <div className="tier-project-badge">
            <input
              className="tier-project-name"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                outline: 'none',
                width: `${Math.max(6, Math.min(16, (isEmptyHero ? 'Пустой проект' : fileName).length + 1))}ch`,
                padding: 0,
                fontSize: '12.5px',
                fontWeight: 600,
              }}
              value={isEmptyHero ? 'Пустой проект' : fileName}
              onChange={(e) => renamePrimaryFile(e.target.value)}
              disabled={isEmptyHero}
              aria-label="Имя проекта"
              title={isEmptyHero ? 'Пустой проект' : fileName}
            />
            {selectedCount > 1 && !isEmptyHero && (
              <span className="tier-project-meta">{selectedCount} эмодзи</span>
            )}
            <span
              className={`tier-project-size ${tooBig ? 'bad' : ''}`}
              title="Размер сжатого .tgs файла (лимит Telegram 64 кБ)"
            >
              {formatKb(size)} / 64 кБ
            </span>
          </div>
        </div>

        <div className="tier-nav-right">
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => setShowTgModal(true)}
            title="Посмотреть анимацию в реалистичном чате Telegram"
          >
            <Send size={13} /> как в telegram
          </button>
          <button
            type="button"
            className="tier-nav-btn tier-desktop-only"
            onClick={() => {
              setShowTgModal(true);
              say('Режим видео: предпросмотр анимации в сообщении Telegram');
            }}
            title="Предпросмотр анимации / видео"
          >
            <Play size={13} /> видео
          </button>
          {selectedCount > 1 && !isEmptyHero ? (
            <button
              type="button"
              className="tier-nav-btn tier-btn-primary"
              disabled={pixelBusy}
              onClick={() => downloadZipList(selectedStickers, 'magnat_selected')}
              title={`Скачать выбранные ${selectedCount} эмодзи готовым архивом .zip`}
            >
              <Download size={14} /> скачать ({selectedCount}) .zip
            </button>
          ) : (
            <button
              type="button"
              className="tier-nav-btn tier-btn-primary"
              disabled={pixelBusy}
              onClick={() => downloadSingle('tgs')}
              title="Скачать готовый .tgs для Telegram"
            >
              <Download size={14} /> скачать tgs
            </button>
          )}

          {/* PRO Upgrade Button */}
          <button
            type="button"
            className={`tier-nav-btn tier-btn-pro ${sub.isPro ? 'active' : ''}`}
            onClick={() => {
              haptic('medium');
              setMainView('tma_profile');
            }}
            title={sub.isPro ? 'Управление подпиской MAGNAT PRO' : 'Разблокировать все 284 шаблона и функции PRO'}
          >
            <Crown size={14} color={sub.isPro ? '#ffd700' : '#fbbf24'} />
            <span>{sub.isPro ? (sub.plan === 'lifetime' ? 'VIP 👑' : 'PRO ⚡') : 'ТАРИФЫ / PRO'}</span>
          </button>

          <div
            className="tier-profile-badge"
            onClick={() => {
              haptic('light');
              setMainView('tma_profile');
            }}
            title={tgUser ? `Telegram: @${tgUser.username || tgUser.first_name}` : 'Профиль MAGNAT Studio'}
          >
            <div className="tier-avatar">
              {tgUser?.photo_url ? (
                <img
                  src={tgUser.photo_url}
                  alt=""
                  style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                />
              ) : tgUser?.first_name ? (
                tgUser.first_name[0].toUpperCase()
              ) : (
                'M'
              )}
            </div>
            <span className="tier-username">
              {tgUser ? `@${tgUser.username || tgUser.first_name}` : 'MAGNAT'}
            </span>
            {sub.isPro && <span className="tier-pro-pill">PRO</span>}
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".tgs,.json,.zip,.svg,.png,.webp,.jpg,.jpeg,application/json,application/zip,image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              setIsEmptyHero(false);
              openFiles(e.target.files);
            }
            e.target.value = '';
          }}
        />
      </header>

      {/* 3-PANEL STUDIO GRID (Screenshot 2 Replica) */}
      <div className={`tier-studio mobile-tab-${mobileTab}`}>
        {/* LEFT PANEL: ЧАСТИ ЭМОДЗИ */}
        <aside className={`tier-panel tier-panel-left ${mobileTab === 'layers' ? 'mobile-visible' : ''}`}>
          <div className="tier-panel-header">
            <div className="tier-panel-title-row">
              <h3 className="tier-panel-title">части эмодзи</h3>
              {tree.length > 0 && !isEmptyHero && (
                <span className="muted tiny">{tree.length} слоёв</span>
              )}
            </div>
            <div className="tier-filter-pills">
              <button
                type="button"
                className={`tier-filter-pill ${leftFilter === 'text' ? 'active' : ''}`}
                onClick={() => setLeftFilter((f) => (f === 'text' ? 'all' : 'text'))}
              >
                <Type size={11} /> надпись
              </button>
              <button
                type="button"
                className={`tier-filter-pill ${leftFilter === 'shape' ? 'active' : ''}`}
                onClick={() => setLeftFilter((f) => (f === 'shape' ? 'all' : 'shape'))}
              >
                <Square size={11} /> квадрат
              </button>
              <button
                type="button"
                className={`tier-filter-pill ${leftFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLeftFilter('all')}
              >
                все
              </button>
            </div>
          </div>

          <div className="tier-panel-body">
            {isEmptyHero || !tree.length ? (
              <div className="tier-layers-empty">
                здесь появятся части эмодзи: каждую можно выделить, подвинуть, перекрасить и анимировать
              </div>
            ) : (
              <>
                {selectedCount > 1 && (
                  <div className="layers-focus-note" style={{ marginBottom: 10 }}>
                    Слои для <strong>«{primarySticker.name}»</strong> (кликните по другому эмодзи для смены)
                  </div>
                )}
                <LayersPanel
                  tree={filteredTree}
                  selected={activeSel}
                  selectedOpacity={selectedOpacity}
                  onSelect={setSelectedNodePath}
                  onToggle={(p) => editPrimary((d) => toggleHidden(d, p))}
                  onRename={(p, name) => editPrimary((d) => rename(d, p, name))}
                  onMove={(dir) => {
                    if (!activeSel) return;
                    let moved = activeSel;
                    editPrimary((d) => {
                      moved = moveNode(d, activeSel, dir);
                    });
                    setSelectedNodePath(moved);
                  }}
                  onDuplicate={() => activeSel && editPrimary((d) => duplicateNode(d, activeSel))}
                  onDelete={removeSelected}
                  onTransform={(delta, mergeKey) => {
                    if (!activeSel) return;
                    editPrimary((d) => adjustNodeTransform(d, activeSel, delta), mergeKey ?? null);
                  }}
                />
              </>
            )}
          </div>

          <div className="tier-left-footer">
            <span className="tier-access-label">доступ к редактору</span>
            <span className="tier-access-date">
              {sub.isPro
                ? sub.plan === 'lifetime'
                  ? 'VIP навсегда 👑'
                  : 'PRO активен ⚡'
                : 'Free тариф'}
            </span>
          </div>
        </aside>

        {/* CENTER CANVAS & PLAYER (Screenshot 2 Replica) */}
        <main
          className={`tier-center ${dragging ? 'drop' : ''} ${mobileTab === 'canvas' ? 'mobile-visible' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) {
              setIsEmptyHero(false);
              openFiles(e.dataTransfer.files);
            }
          }}
        >
          {isEmptyHero ? (
            <div className="tier-canvas-area">
              <div className="tier-empty-hero">
                <div className="tier-hero-circle">
                  <span className="tier-hero-circle-text">MAGNAT</span>
                </div>
                <h2 className="tier-hero-title">редактор эмодзи</h2>
                <div className="tier-hero-actions">
                  <button
                    type="button"
                    className="tier-hero-btn tier-btn-primary"
                    onClick={() => {
                      setModalAddToPack(false);
                      setShowModal(true);
                    }}
                  >
                    шаблоны MAGNAT
                  </button>
                  <button
                    type="button"
                    className="tier-hero-btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    открыть .tgs
                  </button>
                  <button
                    type="button"
                    className="tier-hero-btn"
                    onClick={() => setShowLinkModal(true)}
                  >
                    пак по ссылке
                  </button>
                  <button
                    type="button"
                    className="tier-hero-btn"
                    onClick={() => {
                      setIsEmptyHero(false);
                      openSingleSticker(emptyDoc(), 'новый_эмодзи', null);
                      say('Создан чистый холст 512×512');
                    }}
                  >
                    пустой холст
                  </button>
                </div>
                <span className="tier-hero-drag">или перетащи файлы сюда</span>
              </div>
            </div>
          ) : (
            <Preview
              doc={outDoc}
              selectedStickers={previewStickers}
              primaryId={primarySticker.id}
              onSelectPrimary={setPrimaryFocus}
              onCollapseToSingle={collapseToSingle}
            />
          )}
        </main>

        {/* RIGHT PANEL: 3 SECTIONS (Screenshot 2 Replica) */}
        <aside className={`tier-panel tier-right-panel tier-panel-right ${mobileTab === 'brand' ? 'mobile-visible' : ''}`}>
          {/* SECTION 1: T НАДПИСЬ */}
          <section className="tier-section">
            <div className="tier-section-title">
              <Type size={16} color="#93c5fd" />
              <span>T надпись</span>
              {selectedCount > 1 && !isEmptyHero && (
                <span className="pill accent-pill">на {selectedCount} эмодзи</span>
              )}
            </div>
            <BrandPanel
              slotCount={brandInfo.count}
              isInjected={brandInfo.isInjected}
              origText={brandInfo.origText}
              hasPlateSlot={brandInfo.hasPlateSlot}
              origPlateText={brandInfo.origPlateText}
              options={brandInfo.options}
              selectedCount={selectedCount}
              anyNeedsOverlay={anySelectedNeedsOverlay}
              packCount={pack.length}
              busy={fontBusy}
              uploadedLogo={uploadedLogo}
              onUploadedLogoChange={setUploadedLogo}
              onChange={(opts, mergeKey, keepCol) => {
                setIsEmptyHero(false);
                handleBrandChange(opts, mergeKey, keepCol);
              }}
              onReset={handleBrandReset}
              onApplyToPack={handleApplyBrandToPack}
              onSay={say}
            />
          </section>

          {/* SECTION 2: ⊚ ВСЕ ЦВЕТА */}
          <section className="tier-section">
            <div className="tier-section-title">
              <Sparkles size={16} color="#fbbf24" />
              <span>⊚ все цвета</span>
            </div>
            <PalettePanel
              entries={palette}
              scopeName={activeSel ? selectedNode?.nm || 'выбранный слой' : null}
              selectedCount={selectedCount}
              packCount={pack.length}
              onClearScope={() => setSelectedNodePath(null)}
              onChange={(from, to) => {
                setIsEmptyHero(false);
                runColorMutation(
                  (n) => replaceColor(n, from, to),
                  `color:${activeSel?.join('.') ?? 'multi'}`,
                );
              }}
              onTheme={(themeId) => {
                setIsEmptyHero(false);
                runColorMutation(
                  (n, skipBrand) => applyColorTheme(n, themeId, { skipBrandSlot: skipBrand }),
                  `theme:${activeSel?.join('.') ?? 'multi'}`,
                );
              }}
              onThemeToPack={handleApplyThemeToPack}
              onBulk={handleBulkColor}
            />
          </section>

          {/* SECTION 3: ✦ ЭФФЕКТЫ */}
          <section className="tier-section">
            <div className="tier-section-title">
              <Sparkles size={16} color="#ec4899" />
              <span>✦ эффекты</span>
            </div>
            <EffectsPanel
              fx={fx}
              layers={doc.layers
                .filter((l) => l.ind !== undefined)
                .map((l, i) => ({ ind: l.ind!, name: l.nm || `Слой ${i + 1}` }))}
              selectedCount={selectedCount}
              pixelStatus={pixelStatus}
              onChange={(k, p, m) => {
                setIsEmptyHero(false);
                setEffect(k, p, m);
              }}
            />
            <ChecksPanel
              checks={checks}
              onTrim={() => editTargets(trimToLimit)}
              onOptimize={() => {
                let saved = 0;
                editTargets((d) => {
                  const before = tgsSize(applyShapeEffects(d));
                  const opt = { ...optimize(d), fx: d.fx };
                  saved += Math.max(0, before - tgsSize(applyShapeEffects(opt)));
                  Object.assign(d, opt);
                });
                say(saved > 0 ? `Сжато суммарно на ${formatKb(saved)}` : 'Файлы уже оптимальны');
              }}
            />
          </section>
        </aside>
      </div>

      {/* DRAWERS & MODALS */}
      <PackTray
        pack={pack}
        selectedIds={selectedIds}
        primaryId={primarySticker.id}
        onSelect={(id, toggleMulti) => {
          setIsEmptyHero(false);
          handlePackSelect(id, toggleMulti);
        }}
        onSelectAll={handleSelectAllInPack}
        onCollapseSelection={collapseToSingle}
        onAdd={() => {
          setModalAddToPack(true);
          setShowModal(true);
        }}
        onImportFiles={() => fileInput.current?.click()}
        onDuplicate={duplicatePackSticker}
        onRemove={removePackSticker}
        onClearOther={clearUnselectedPackStickers}
        onDownloadZip={() => downloadZipList(pack, 'magnat_emoji_pack')}
        isOpen={showPackTray}
        onToggle={() => setShowPackTray((v) => !v)}
      />

      {/* TMA / MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="tma-bottom-bar">
        <button
          type="button"
          className={`tma-tab-btn ${mobileTab === 'canvas' ? 'active' : ''}`}
          onClick={() => {
            setMobileTab('canvas');
            haptic('select');
          }}
        >
          <Sparkles size={18} />
          <span>Холст</span>
        </button>
        <button
          type="button"
          className="tma-tab-btn"
          onClick={() => {
            setModalAddToPack(false);
            setShowModal(true);
            haptic('select');
          }}
        >
          <LayoutGrid size={18} />
          <span>Шаблоны</span>
        </button>
        <button
          type="button"
          className={`tma-tab-btn ${mobileTab === 'brand' ? 'active' : ''}`}
          onClick={() => {
            setMobileTab('brand');
            haptic('select');
          }}
        >
          <Type size={18} />
          <span>Бренд</span>
        </button>
        <button
          type="button"
          className={`tma-tab-btn ${mobileTab === 'layers' ? 'active' : ''}`}
          onClick={() => {
            setMobileTab('layers');
            haptic('select');
          }}
        >
          <Square size={18} />
          <span>Слои</span>
        </button>
        <button
          type="button"
          className={`tma-tab-btn tma-tab-pro ${sub.isPro ? 'is-pro' : ''}`}
          onClick={() => {
            setSubFeaturedReason(undefined);
            setShowSubModal(true);
            haptic('medium');
          }}
        >
          <Crown size={18} color="#ffd700" />
          <span>{sub.isPro ? 'VIP' : 'PRO'}</span>
        </button>
      </nav>

      <TemplatesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isPro={sub.isPro}
        onOpenSubscription={(reason) => {
          setSubFeaturedReason(reason);
          setShowSubModal(true);
        }}
        onSelect={(newDoc, item, isAdd) => {
          setIsEmptyHero(false);
          if (isAdd) {
            addToPack(newDoc, item.name, item.id);
          } else {
            openSingleSticker(newDoc, item.name, item.id);
            say(`Открыт «${item.name}». Отменить — Ctrl+Z.`);
            setShowModal(false);
          }
        }}
        onOpenMultiForEdit={(items) => {
          setIsEmptyHero(false);
          openCatalogBatchForEdit(items);
        }}
        onAddBatchToPack={(items) => {
          setIsEmptyHero(false);
          handleAddBatchToPack(items);
        }}
        defaultAddToPack={modalAddToPack}
      />

      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        subscription={sub}
        onSubscriptionChange={(next) => {
          setSub(next);
          say(next.isPro ? '👑 Тариф MAGNAT PRO успешно активирован!' : 'Тариф изменён на Бесплатный');
        }}
        featuredReason={subFeaturedReason}
      />

      <TelegramModal
        isOpen={showTgModal}
        onClose={() => setShowTgModal(false)}
        doc={outDoc}
        title="MAGNAT"
      />

      <PackLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onImport={handleImportPackLink}
      />

      {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
    </div>
  );
}
