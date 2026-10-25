import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  Columns3,
  Download,
  FilePlus2,
  FolderArchive,
  FolderOpen,
  Layers,
  LayoutGrid,
  Plus,
  Redo2,
  Sparkles,
  Tag,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import type { Font } from 'opentype.js';
import { BrandPanel } from './components/BrandPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LayersPanel } from './components/LayersPanel';
import { LazyThumb } from './components/LazyThumb';
import { PackTray, type PackItem } from './components/PackTray';
import { PalettePanel, type BulkColorOp } from './components/PalettePanel';
import { Preview, type PreviewSticker } from './components/Preview';
import { TemplatesModal } from './components/TemplatesModal';
import { TextPanel, type TextRequest } from './components/TextPanel';
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
} from './lib/layers';
import { emptyDoc, reindexLayers, type LottieDoc } from './lib/lottie';
import { createPackZip, importPackZip } from './lib/packZip';
import { pixelate } from './lib/pixelSample';
import {
  CATALOG,
  loadCatalogDoc,
  TEMPLATE_CATEGORIES,
  type CatalogItem,
  type TemplateCategory,
} from './lib/templates';
import { DEFAULT_TEXT, textToLayer } from './lib/text';
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

type Tab = 'templates' | 'brand' | 'layers' | 'text';

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

  const [selectedNodePath, setSelectedNodePath] = useState<NodePath | null>(null);
  const [tab, setTab] = useState<Tab>('templates');
  const [tplCategory, setTplCategory] = useState<'all' | TemplateCategory>('shablony1');
  const [tplSearch, setTplSearch] = useState('');
  const [multiMode, setMultiMode] = useState(false);
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

  // Preload Montserrat Black + initial 3-tile banner trio (or first sticker) on startup
  useEffect(() => {
    ensureFont('montserrat').catch(() => {});
    const bannerTrio = CATALOG.filter((c) =>
      ['shablony1_012', 'shablony1_013', 'shablony1_014'].includes(c.id),
    );
    const startupTargets = bannerTrio.length === 3 ? bannerTrio : CATALOG.slice(0, 1);
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
      setSelectedNodePath(null);
    },
    [showPackTray],
  );

  /** Opens multiple catalog emojis simultaneously for synchronized live editing. */
  const openCatalogBatchForEdit = useCallback(
    async (catItems: CatalogItem[]) => {
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
    [say, showPackTray],
  );

  /** Toggles a catalog item in/out of the active multi-selection. */
  const toggleCatalogMulti = useCallback(
    async (catItem: CatalogItem) => {
      const cur = snapRef.current;
      const existingInSel = cur.items.find(
        (i) => i.catalogId === catItem.id && cur.selectedIds.includes(i.id),
      );

      if (existingInSel) {
        if (cur.selectedIds.length === 1) {
          setMultiMode(true);
          say('Режим мультивыбора включён — кликайте по другим эмодзи, чтобы выбрать несколько!');
          return;
        }
        const nextSel = cur.selectedIds.filter((id) => id !== existingInSel.id);
        const nextItems = showPackTray
          ? cur.items
          : cur.items.filter((i) => nextSel.includes(i.id));
        dispatch({
          type: 'apply',
          next: {
            items: nextItems,
            selectedIds: nextSel,
            primaryId: cur.primaryId === existingInSel.id ? nextSel[0] : cur.primaryId,
          },
          key: null,
          at: Date.now(),
        });
        return;
      }

      if (cur.selectedIds.length >= MAX_MULTI_SELECT) {
        say(`Максимум ${MAX_MULTI_SELECT} эмодзи в одном мультивыборе`, true);
        return;
      }

      const existingInPack = cur.items.find((i) => i.catalogId === catItem.id);
      if (existingInPack) {
        dispatch({
          type: 'apply',
          next: {
            items: cur.items,
            selectedIds: [...cur.selectedIds, existingInPack.id],
            primaryId: cur.primaryId,
          },
          key: null,
          at: Date.now(),
        });
        return;
      }

      try {
        const loadedDoc = await loadCatalogDoc(catItem);
        const latest = snapRef.current;
        const entry: PackItem = {
          id: makeUid(),
          name: sanitizeFileName(catItem.name),
          catalogId: catItem.id,
          doc: loadedDoc,
        };
        dispatch({
          type: 'apply',
          next: {
            items: [...latest.items, entry],
            selectedIds: [...latest.selectedIds, entry.id],
            primaryId: latest.primaryId,
          },
          key: null,
          at: Date.now(),
        });
      } catch (e) {
        say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи', true);
      }
    },
    [say, showPackTray],
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
    setMultiMode(false);
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
      setShowPackTray(true);
      say(`Добавлено и выбрано ${newPackItems.length} эмодзи в паке!`);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи в пак', true);
    }
  };

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
    try {
      say(`Собираю .zip архив (${list.length} эмодзи)...`);
      const blob = await createPackZip(list, archivePrefix);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${archivePrefix}_${list.length}_emojis.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        setTab('brand');
        say(`Импортировано и выбрано ${packItems.length} эмодзи из ${files[0].name}!`);
        return;
      }

      if (
        files.length === 1 &&
        (/\.(svg|png|webp|jpe?g)$/i.test(files[0].name) || files[0].type.startsWith('image/'))
      ) {
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
        setTab('brand');
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
            applyBrandSlot(d, nextOpts, loadedFonts, { keepStickerColor, autoCreate: true });
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

  const size = useMemo(() => tgsSize(outDoc), [outDoc]);
  const checks = useMemo(() => checkTelegram(outDoc, size), [outDoc, size]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: CATALOG.length };
    for (const item of CATALOG) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredCatalog = useMemo(() => {
    const q = tplSearch.trim().toLowerCase().replace(/^#/, '');
    return CATALOG.filter((item) => {
      if (tplCategory !== 'all' && item.category !== tplCategory) return false;
      if (!q) return true;
      const numStr = String(item.num);
      const padStr = String(item.num).padStart(3, '0');
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        numStr === q ||
        padStr.includes(q)
      );
    });
  }, [tplCategory, tplSearch]);

  /** Maps catalogId -> 1-based selection index for checked badges in sidebar. */
  const selectedCatalogOrder = useMemo(() => {
    const map = new Map<string, number>();
    selectedStickers.forEach((s, idx) => {
      if (s.catalogId && !map.has(s.catalogId)) {
        map.set(s.catalogId, idx + 1);
      }
    });
    return map;
  }, [selectedStickers]);

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

  const addText = async (req: TextRequest) => {
    setFontBusy(true);
    try {
      const fonts = await ensureFont(req.fontId);
      editTargets((d) => {
        const layer = textToLayer({
          ...DEFAULT_TEXT,
          ...req,
          fonts,
          ip: d.ip,
          op: d.op,
        });
        d.layers.unshift(layer);
        reindexLayers(d.layers);
      });
      setSelectedNodePath([0]);
      say(
        selectedCount > 1
          ? `Текстовый слой добавлен сразу на ${selectedCount} эмодзи`
          : 'Текстовый слой добавлен поверх эмодзи',
      );
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не получилось добавить текст', true);
    } finally {
      setFontBusy(false);
    }
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

  const pickCatalogSidebar = async (item: CatalogItem, toPack = false) => {
    try {
      const loaded = await loadCatalogDoc(item);
      if (toPack) {
        addToPack(loaded, item.name, item.id);
      } else {
        openSingleSticker(loaded, item.name, item.id);
        say(`Выбран «${item.name}»`);
      }
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи', true);
    }
  };

  const selectPresetByIds = (ids: string[]) => {
    const byId = new Map(CATALOG.map((c) => [c.id, c]));
    const items = ids.map((id) => byId.get(id)).filter((x): x is CatalogItem => Boolean(x));
    openCatalogBatchForEdit(items);
  };

  const tooBig = size > MAX_BYTES;

  return (
    <div className={`app ${showPackTray ? 'with-tray' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Sparkles size={20} />
          <span>MAGNAT Emoji Studio</span>
        </div>

        <button
          type="button"
          className="topbar-btn"
          onClick={() => {
            setModalAddToPack(false);
            setShowModal(true);
          }}
          title={`Открыть большой каталог всех ${CATALOG.length} шаблонов и эмодзи`}
        >
          <LayoutGrid size={15} /> Каталог ({CATALOG.length})
        </button>

        <button
          type="button"
          className={`topbar-btn ${showPackTray ? 'active' : ''}`}
          onClick={() => setShowPackTray((v) => !v)}
          title="Открыть/скрыть панель пака"
        >
          <FolderArchive size={15} /> Пак ({pack.length})
        </button>

        <button
          type="button"
          className="topbar-btn"
          onClick={() => {
            openSingleSticker(emptyDoc(), 'новый_эмодзи', null);
            say('Создан чистый холст 512×512');
          }}
          title="Создать пустой холст 512×512"
        >
          <FilePlus2 size={15} /> Пустой
        </button>

        <input
          className="file-name"
          value={fileName}
          onChange={(e) => renamePrimaryFile(e.target.value)}
          aria-label="Имя файла"
        />

        <div className="top-actions">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Открыть .tgs, Lottie .json, логотип .svg/.png или архив пака .zip"
          >
            <FolderOpen size={15} /> Открыть
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!hist.past.length}
            onClick={() => dispatch({ type: 'undo' })}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!hist.future.length}
            onClick={() => dispatch({ type: 'redo' })}
            title="Вернуть (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
          <span className={`size-badge ${tooBig ? 'bad' : ''}`} title="Размер сжатого .tgs файла">
            {formatKb(size)} / 64 кБ
          </span>

          {selectedCount > 1 ? (
            <>
              <button
                type="button"
                disabled={pixelBusy}
                onClick={() => downloadSingle('tgs')}
                title="Скачать только активный .tgs файл"
              >
                <Download size={14} /> 1 .tgs
              </button>
              <button
                type="button"
                className="primary"
                disabled={pixelBusy}
                onClick={() => downloadZipList(selectedStickers, 'magnat_selected')}
                title={`Скачать все ${selectedCount} выбранных эмодзи готовым архивом .zip`}
              >
                <Download size={15} /> Скачать выбранные ({selectedCount}) .zip
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="zip-btn"
                onClick={() => downloadZipList(pack, 'magnat_emoji_pack')}
                title="Скачать весь пак готовых .tgs эмодзи в .zip"
              >
                <Download size={15} /> Пак .zip ({pack.length})
              </button>
              <button
                type="button"
                disabled={pixelBusy}
                onClick={() => downloadSingle('json')}
                title="Скачать исходник Lottie JSON"
              >
                JSON
              </button>
              <button
                type="button"
                className="primary"
                disabled={pixelBusy}
                onClick={() => downloadSingle('tgs')}
              >
                <Download size={15} /> Скачать .tgs
              </button>
            </>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".tgs,.json,.zip,.svg,.png,.webp,.jpg,.jpeg,application/json,application/zip,image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) openFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </header>

      <aside className="left">
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'templates' ? 'on' : ''}
            onClick={() => setTab('templates')}
            title="Шаблоны и мультивыбор эмодзи"
          >
            <LayoutGrid size={14} /> Паки
          </button>
          <button
            type="button"
            className={tab === 'brand' ? 'on' : ''}
            onClick={() => setTab('brand')}
            title="Брендирование: никнейм, логотип или плашка сразу на все выбранные эмодзи"
          >
            <Tag size={14} /> Бренд{selectedCount > 1 ? ` (${selectedCount})` : ''}
          </button>
          <button
            type="button"
            className={tab === 'layers' ? 'on' : ''}
            onClick={() => setTab('layers')}
            title="Слои, вложенные композиции и трансформация"
          >
            <Layers size={14} /> Слои
          </button>
          <button
            type="button"
            className={tab === 'text' ? 'on' : ''}
            onClick={() => setTab('text')}
            title="Добавить дополнительный текстовый слой"
          >
            <Type size={14} /> +Текст
          </button>
        </nav>

        <div className="tab-body">
          {tab === 'templates' && (
            <div className="templates-panel pad">
              <button
                type="button"
                className="goto-brand-cta"
                onClick={() => setTab('brand')}
              >
                <Sparkles size={14} />
                <span>
                  {selectedCount > 1
                    ? `Изменить бренд сразу на ${selectedCount} эмодзи`
                    : brandInfo.count > 0
                      ? `Настроить бренд «${brandInfo.options.text || 'ЛОГО'}»`
                      : 'Добавить ник / логотип на этот шаблон'}
                </span>
              </button>

              {/* Multi-Select Toolbar */}
              <div className="multi-select-box">
                <div className="multi-select-top">
                  <button
                    type="button"
                    className={`multi-toggle-btn ${multiMode || selectedCount > 1 ? 'on' : ''}`}
                    onClick={() => setMultiMode((v) => !v)}
                    title="Когда включено, клик по карточкам выбирает сразу много эмодзи для одновременной переделки"
                  >
                    <CheckSquare size={14} />
                    <span>
                      {selectedCount > 1
                        ? `Мультивыбор: ${selectedCount} шт.`
                        : multiMode
                          ? 'Кликайте по эмодзи…'
                          : 'Выбрать несколько'}
                    </span>
                  </button>

                  {selectedCount > 1 && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={collapseToSingle}
                      title="Оставить только 1 эмодзи"
                    >
                      <X size={12} /> Сброс
                    </button>
                  )}
                </div>

                <div className="multi-quick-row">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() =>
                      selectPresetByIds(['shablony1_012', 'shablony1_013', 'shablony1_014'])
                    }
                    title="Выбрать 3 части широкого баннера XXX SHOP вместе"
                  >
                    <Columns3 size={12} /> Баннер 3 шт.
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() =>
                      selectPresetByIds([
                        'shablony1_012',
                        'shablony1_013',
                        'shablony1_014',
                        'shablony1_015',
                      ])
                    }
                    title="Выбрать весь набор XXX (баннер 3 шт. + 3D-значок XXX)"
                  >
                    Набор XXX (4)
                  </button>
                  {filteredCatalog.length > 1 && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => openCatalogBatchForEdit(filteredCatalog)}
                      title="Выбрать все показанные ниже эмодзи (до 60 шт.) для одновременного редактирования"
                    >
                      Все ({Math.min(MAX_MULTI_SELECT, filteredCatalog.length)})
                    </button>
                  )}
                </div>
              </div>

              <div className="tpl-search-wrap">
                <input
                  type="text"
                  className="tpl-search-input"
                  placeholder="Поиск (Баннер, Корона, Щит, #001...)"
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                />
                {tplSearch && (
                  <button
                    type="button"
                    className="tpl-search-clear"
                    onClick={() => setTplSearch('')}
                    title="Очистить"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="tpl-categories">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`tpl-chip ${tplCategory === cat.id ? 'on' : ''}`}
                    onClick={() => setTplCategory(cat.id)}
                  >
                    <span>{cat.label}</span>
                    <span className="count">{categoryCounts[cat.id] ?? 0}</span>
                  </button>
                ))}
              </div>

              <div className="templates">
                {filteredCatalog.map((item) => {
                  const selOrder = selectedCatalogOrder.get(item.id) ?? 0;
                  const isSel = selOrder > 0;
                  return (
                    <div
                      key={item.id}
                      className={`template-card ${isSel ? 'active' : ''}`}
                      onClick={(e) => {
                        if (multiMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                          toggleCatalogMulti(item);
                        } else {
                          setMultiMode(false);
                          pickCatalogSidebar(item, false);
                        }
                      }}
                      title={`${item.name} (галочка в углу — выбрать сразу несколько)`}
                    >
                      <div className="template-card-thumb-wrap">
                        <LazyThumb item={item} />
                        <button
                          type="button"
                          className={`card-check-btn ${isSel ? 'checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCatalogMulti(item);
                          }}
                          title={
                            isSel
                              ? 'Убрать из мультивыбора'
                              : 'Добавить этот эмодзи к мультивыбору'
                          }
                        >
                          {isSel ? (
                            selectedCount > 1 ? (
                              <span>{selOrder}</span>
                            ) : (
                              <Check size={11} strokeWidth={3} />
                            )
                          ) : null}
                        </button>
                      </div>
                      <div className="template-card-foot">
                        <span className="template-card-title">
                          {item.category === 'shablony1'
                            ? item.name
                                .replace(/^Баннер\s+(\d\/3)\s*·\s*/, '$1 ')
                                .replace(/^Значок\s+3D\s*·\s*/, '3D ')
                                .replace(/^Шаблон\s*(?:#\d+\s*)?·?\s*/, '')
                            : `#${String(item.num).padStart(3, '0')}`}
                        </span>
                        <button
                          type="button"
                          className="template-card-plus"
                          title="Добавить в пак"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickCatalogSidebar(item, true);
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <div className="tpl-empty">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}

          {tab === 'brand' && (
            <BrandPanel
              slotCount={brandInfo.count}
              isInjected={brandInfo.isInjected}
              origText={brandInfo.origText}
              options={brandInfo.options}
              selectedCount={selectedCount}
              anyNeedsOverlay={anySelectedNeedsOverlay}
              packCount={pack.length}
              busy={fontBusy}
              uploadedLogo={uploadedLogo}
              onUploadedLogoChange={setUploadedLogo}
              onChange={handleBrandChange}
              onReset={handleBrandReset}
              onApplyToPack={handleApplyBrandToPack}
              onSay={say}
            />
          )}

          {tab === 'layers' && (
            <>
              {selectedCount > 1 && (
                <div className="layers-focus-note">
                  Слои открыты для <strong>«{primarySticker.name}»</strong> (кликните по другому эмодзи на холсте для смены)
                </div>
              )}
              <LayersPanel
                tree={tree}
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

          {tab === 'text' && <TextPanel onAdd={addText} busy={fontBusy} />}
        </div>
      </aside>

      <main
        className={`center ${dragging ? 'drop' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) openFiles(e.dataTransfer.files);
        }}
      >
        <Preview
          doc={outDoc}
          selectedStickers={previewStickers}
          primaryId={primarySticker.id}
          onSelectPrimary={setPrimaryFocus}
          onCollapseToSingle={collapseToSingle}
        />
        <p className="muted small hint">
          Перетащите сюда <code>.svg</code> / <code>.png</code> логотип, несколько <code>.tgs</code> или архив <code>.zip</code>
        </p>
      </main>

      <aside className="right">
        <PalettePanel
          entries={palette}
          scopeName={activeSel ? (selectedNode?.nm || 'выбранный слой') : null}
          selectedCount={selectedCount}
          packCount={pack.length}
          onClearScope={() => setSelectedNodePath(null)}
          onChange={(from, to) =>
            runColorMutation(
              (n) => replaceColor(n, from, to),
              `color:${activeSel?.join('.') ?? 'multi'}`,
            )
          }
          onTheme={(themeId) =>
            runColorMutation(
              (n, skipBrand) => applyColorTheme(n, themeId, { skipBrandSlot: skipBrand }),
              `theme:${activeSel?.join('.') ?? 'multi'}`,
            )
          }
          onThemeToPack={handleApplyThemeToPack}
          onBulk={handleBulkColor}
        />

        <EffectsPanel
          fx={fx}
          layers={doc.layers
            .filter((l) => l.ind !== undefined)
            .map((l, i) => ({ ind: l.ind!, name: l.nm || `Слой ${i + 1}` }))}
          pixelStatus={pixelStatus}
          onChange={setEffect}
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
      </aside>

      <PackTray
        pack={pack}
        selectedIds={selectedIds}
        primaryId={primarySticker.id}
        onSelect={handlePackSelect}
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

      <TemplatesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(newDoc, item, isAdd) => {
          if (isAdd) {
            addToPack(newDoc, item.name, item.id);
          } else {
            openSingleSticker(newDoc, item.name, item.id);
            say(`Открыт «${item.name}». Отменить — Ctrl+Z.`);
            setShowModal(false);
          }
        }}
        onOpenMultiForEdit={openCatalogBatchForEdit}
        onAddBatchToPack={handleAddBatchToPack}
        defaultAddToPack={modalAddToPack}
      />

      {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
    </div>
  );
}
