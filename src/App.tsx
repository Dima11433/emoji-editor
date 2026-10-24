import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
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
} from 'lucide-react';
import type { Font } from 'opentype.js';
import { BrandPanel } from './components/BrandPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LayersPanel } from './components/LayersPanel';
import { LazyThumb } from './components/LazyThumb';
import { PackTray, type PackItem } from './components/PackTray';
import { PalettePanel } from './components/PalettePanel';
import { Preview } from './components/Preview';
import { TemplatesModal } from './components/TemplatesModal';
import { TextPanel, type TextRequest } from './components/TextPanel';
import {
  applyBrandSlot,
  readBrandSlotInfo,
  resetBrandSlot,
  type BrandSlotOptions,
} from './lib/brandSlot';
import { collectColors, grayscale, invert, replaceColor, shiftHue } from './lib/colors';
import { applyShapeEffects, getEffects, type Effects } from './lib/effects';
import { loadFont, type FontId } from './lib/fonts';
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
import { formatKb, optimize, parseSticker, serialize, tgsSize, toTgs } from './lib/tgs';
import { checkTelegram, MAX_BYTES, trimToLimit } from './lib/validate';

interface History {
  doc: LottieDoc;
  past: LottieDoc[];
  future: LottieDoc[];
  lastKey: string | null;
  lastAt: number;
}

type Action =
  | { type: 'apply'; next: LottieDoc; key: string | null; at: number }
  | { type: 'reset'; doc: LottieDoc }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 60;

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'apply': {
      const merge =
        action.key !== null && action.key === state.lastKey && action.at - state.lastAt < 1000;
      return {
        doc: action.next,
        past: merge ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case 'reset':
      return {
        doc: action.doc,
        past: [],
        future: [],
        lastKey: null,
        lastAt: 0,
      };
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        doc: next,
        past: [...state.past, state.doc],
        future: rest,
        lastKey: null,
        lastAt: 0,
      };
    }
  }
}

type Tab = 'templates' | 'brand' | 'layers' | 'text';

export default function App() {
  const [hist, dispatch] = useReducer(reducer, null, () => ({
    doc: emptyDoc('MAGNAT #001'),
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
  }));
  const doc = hist.doc;
  const [fileName, setFileName] = useState('MAGNAT_001');
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(CATALOG[0]?.id ?? null);
  const [selected, setSelected] = useState<NodePath | null>(null);
  const [tab, setTab] = useState<Tab>('brand');
  const [tplCategory, setTplCategory] = useState<'all' | TemplateCategory>('all');
  const [tplSearch, setTplSearch] = useState('');
  const [pack, setPack] = useState<PackItem[]>(() => [
    { id: 'init-1', name: 'MAGNAT_001', doc: emptyDoc('MAGNAT #001') },
  ]);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [showPackTray, setShowPackTray] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalAddToPack, setModalAddToPack] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [fontBusy, setFontBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fontsCacheRef = useRef<Map<FontId, Font[]>>(new Map());

  const say = useCallback((text: string, bad = false) => setToast({ text, bad }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const ensureFont = useCallback(async (id: FontId): Promise<Font[]> => {
    const ready = fontsCacheRef.current.get(id);
    if (ready) return ready;
    const loaded = await loadFont(id);
    fontsCacheRef.current.set(id, loaded);
    return loaded;
  }, []);

  // Preload Montserrat Black + initial MAGNAT #001 sticker on startup
  useEffect(() => {
    ensureFont('montserrat').catch(() => {});
    const first = CATALOG[0];
    if (!first) return;
    let cancelled = false;
    loadCatalogDoc(first)
      .then((firstDoc) => {
        if (cancelled) return;
        dispatch({ type: 'reset', doc: firstDoc });
        setPack([{ id: '1', name: 'MAGNAT_001', doc: structuredClone(firstDoc) }]);
        setActivePackIndex(0);
      })
      .catch(() => {
        if (!cancelled) say('Не удалось загрузить стартовый эмодзи', true);
      });
    return () => {
      cancelled = true;
    };
  }, [ensureFont, say]);

  // Keep active pack item synced with current canvas edits
  useEffect(() => {
    setPack((prev) => {
      if (!prev[activePackIndex]) return prev;
      if (prev[activePackIndex].doc === doc && prev[activePackIndex].name === fileName) return prev;
      const next = [...prev];
      next[activePackIndex] = {
        ...next[activePackIndex],
        doc,
        name: fileName,
      };
      return next;
    });
  }, [doc, fileName, activePackIndex]);

  const edit = useCallback(
    (fn: (d: LottieDoc) => void, key: string | null = null) => {
      const next = structuredClone(doc);
      fn(next);
      dispatch({ type: 'apply', next, key, at: Date.now() });
    },
    [doc],
  );

  const load = useCallback((next: LottieDoc, name: string, catId: string | null = null) => {
    const cleanName = name.replace(/\s+/g, '_').replace(/#/g, '');
    dispatch({ type: 'apply', next, key: null, at: Date.now() });
    setFileName(cleanName);
    setActiveCatalogId(catId);
    setSelected(null);
  }, []);

  const selectPackSticker = (idx: number) => {
    if (idx < 0 || idx >= pack.length) return;
    setActivePackIndex(idx);
    const target = pack[idx];
    dispatch({ type: 'reset', doc: structuredClone(target.doc) });
    setFileName(target.name);
    setSelected(null);
  };

  const addToPack = (newDoc: LottieDoc, name: string, catId: string | null = null) => {
    const cleanName = name.replace(/\s+/g, '_').replace(/#/g, '');
    const newItem: PackItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      doc: structuredClone(newDoc),
    };
    const nextIdx = pack.length;
    setPack((prev) => [...prev, newItem]);
    setActivePackIndex(nextIdx);
    dispatch({ type: 'reset', doc: newDoc });
    setFileName(cleanName);
    setActiveCatalogId(catId);
    setSelected(null);
    setShowPackTray(true);
    say(`Добавлен «${name}» в пак (#${nextIdx + 1})`);
  };

  const handleAddBatchToPack = async (items: CatalogItem[]) => {
    if (!items.length) return;
    try {
      say(`Загружаю ${items.length} эмодзи в пак...`);
      const docs = await Promise.all(items.map((it) => loadCatalogDoc(it)));
      const newPackItems: PackItem[] = items.map((it, idx) => ({
        id: `${Date.now()}-${idx}-${it.id}`,
        name: it.name.replace(/\s+/g, '_').replace(/#/g, ''),
        doc: docs[idx],
      }));
      setPack((prev) => [...prev, ...newPackItems]);
      setShowPackTray(true);
      say(`Добавлено ${newPackItems.length} эмодзи в пак!`);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи в пак', true);
    }
  };

  const duplicatePackSticker = (idx: number) => {
    const src = pack[idx];
    if (!src) return;
    const clone: PackItem = {
      id: `${Date.now()}-copy`,
      name: `${src.name}_copy`,
      doc: structuredClone(src.doc),
    };
    const next = [...pack.slice(0, idx + 1), clone, ...pack.slice(idx + 1)];
    setPack(next);
    setActivePackIndex(idx + 1);
    dispatch({ type: 'reset', doc: structuredClone(clone.doc) });
    setFileName(clone.name);
    say(`Эмодзи дублирован: ${clone.name}`);
  };

  const removePackSticker = (idx: number) => {
    if (pack.length <= 1) return;
    const next = pack.filter((_, i) => i !== idx);
    const nextActive = Math.min(activePackIndex, next.length - 1);
    setPack(next);
    setActivePackIndex(nextActive);
    dispatch({ type: 'reset', doc: structuredClone(next[nextActive].doc) });
    setFileName(next[nextActive].name);
    say('Эмодзи убран из пака');
  };

  const clearOtherPackStickers = () => {
    const current = pack[activePackIndex];
    if (!current) return;
    setPack([current]);
    setActivePackIndex(0);
    say('В паке оставлен только текущий эмодзи');
  };

  const downloadPackZip = async () => {
    try {
      say('Собираю .zip архив пака...');
      const blob = await createPackZip(pack, 'magnat_emoji_pack');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `magnat_pack_${pack.length}_emojis.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`Скачан архив из ${pack.length} эмодзи (.tgs)!`);
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
          id: `${Date.now()}-zip-${idx}`,
          name: s.name,
          doc: s.doc,
        }));
        setPack(packItems);
        setActivePackIndex(0);
        dispatch({ type: 'reset', doc: structuredClone(packItems[0].doc) });
        setFileName(packItems[0].name);
        setActiveCatalogId(null);
        setShowPackTray(true);
        setTab('brand');
        say(`Импортировано ${packItems.length} эмодзи из ${files[0].name}!`);
        return;
      }

      if (files.length === 1) {
        const file = files[0];
        const parsed = parseSticker(new Uint8Array(await file.arrayBuffer()));
        const clean = file.name.replace(/\.(tgs|json)$/i, '');
        load(parsed, clean, null);
        say(`Открыт файл ${file.name}`);
        return;
      }

      const imported: PackItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (/\.zip$/i.test(f.name)) {
          const fromZip = await importPackZip(await f.arrayBuffer());
          for (const z of fromZip) {
            imported.push({ id: `${Date.now()}-${imported.length}`, name: z.name, doc: z.doc });
          }
        } else {
          const parsed = parseSticker(new Uint8Array(await f.arrayBuffer()));
          imported.push({
            id: `${Date.now()}-${imported.length}`,
            name: f.name.replace(/\.(tgs|json)$/i, ''),
            doc: parsed,
          });
        }
      }

      if (imported.length > 0) {
        setPack((prev) => [...prev, ...imported]);
        setShowPackTray(true);
        say(`Добавлено ${imported.length} файлов в пак!`);
      }
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось открыть файл', true);
    }
  };

  const brandInfo = useMemo(() => readBrandSlotInfo(doc), [doc]);

  const handleBrandChange = useCallback(
    (nextOpts: BrandSlotOptions, mergeKey?: string) => {
      if (nextOpts.useOriginalGlyphs) {
        edit((d) => {
          applyBrandSlot(d, nextOpts, null);
        }, mergeKey ?? null);
        return;
      }

      const cachedFonts = fontsCacheRef.current.get(nextOpts.fontId);
      if (cachedFonts) {
        edit((d) => {
          applyBrandSlot(d, nextOpts, cachedFonts);
        }, mergeKey ?? null);
        return;
      }

      // Optimistic state update while font downloads
      edit((d) => {
        d._brandState = { ...nextOpts };
      }, mergeKey ?? null);
      setFontBusy(true);
      ensureFont(nextOpts.fontId)
        .then((loadedFonts) => {
          dispatch({
            type: 'apply',
            next: (() => {
              const cloned = structuredClone(doc);
              applyBrandSlot(cloned, nextOpts, loadedFonts);
              return cloned;
            })(),
            key: mergeKey ?? 'brand:font',
            at: Date.now(),
          });
        })
        .catch(() => say('Не удалось загрузить выбранный шрифт', true))
        .finally(() => setFontBusy(false));
    },
    [doc, edit, ensureFont, say],
  );

  const handleBrandReset = useCallback(() => {
    edit((d) => {
      resetBrandSlot(d);
    });
    say('Возвращена оригинальная надпись MAGNAT');
  }, [edit, say]);

  const handleApplyBrandToPack = useCallback(
    async (opts: BrandSlotOptions, keepStickerColor: boolean) => {
      setFontBusy(true);
      try {
        const fonts = opts.useOriginalGlyphs ? null : await ensureFont(opts.fontId);
        let updatedCount = 0;
        const nextPack = pack.map((item) => {
          const cloned = structuredClone(item.doc);
          const count = applyBrandSlot(cloned, opts, fonts, { keepStickerColor });
          if (count > 0) updatedCount++;
          return { ...item, doc: cloned };
        });
        setPack(nextPack);
        if (nextPack[activePackIndex]) {
          dispatch({
            type: 'apply',
            next: structuredClone(nextPack[activePackIndex].doc),
            key: null,
            at: Date.now(),
          });
        }
        say(`Надпись обновлена в ${updatedCount} из ${pack.length} эмодзи пака!`);
      } catch (e) {
        say(e instanceof Error ? e.message : 'Ошибка пакетной замены текста', true);
      } finally {
        setFontBusy(false);
      }
    },
    [activePackIndex, ensureFont, pack, say],
  );

  const selectedNode = selected ? getNode(doc, selected) : undefined;
  const activeSel = selectedNode ? selected : null;
  const selectedOpacity = useMemo(
    () => (activeSel ? readNodeOpacity(doc, activeSel) : 100),
    [doc, activeSel],
  );

  const fx = useMemo(() => getEffects(doc), [doc]);
  const shaped = useMemo(() => applyShapeEffects(doc), [doc]);
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

  const download = (kind: 'tgs' | 'json') => {
    const data = kind === 'tgs' ? toTgs(outDoc) : new TextEncoder().encode(serialize(outDoc));
    const blob = new Blob([data], {
      type: kind === 'tgs' ? 'application/x-tgsticker' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.trim() || 'magnat_emoji'}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const setEffect = <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>, merge = false) =>
    edit(
      (d) => {
        const cur = getEffects(d);
        d.fx = { ...cur, [key]: { ...cur[key], ...patch } };
      },
      merge ? `fx:${key}` : null,
    );

  const tree = useMemo(() => buildTree(doc), [doc]);
  const palette = useMemo(() => collectColors(colorScope(doc, activeSel)), [doc, activeSel]);
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

  const inScope = (fn: (node: unknown) => void) => (d: LottieDoc) => fn(colorScope(d, activeSel));

  const addText = async (req: TextRequest) => {
    setFontBusy(true);
    try {
      const fonts = await ensureFont(req.fontId);
      const layer = textToLayer({ ...DEFAULT_TEXT, ...req, fonts });
      edit((d) => {
        d.layers.unshift(layer);
        reindexLayers(d.layers);
      });
      setSelected([0]);
      say('Текстовый слой добавлен поверх эмодзи');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не получилось добавить текст', true);
    } finally {
      setFontBusy(false);
    }
  };

  const removeSelected = useCallback(() => {
    if (!activeSel) return;
    edit((d) => removeNode(d, activeSel));
    setSelected(null);
  }, [activeSel, edit]);

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
        load(loaded, item.name, item.id);
        say(`Выбран «${item.name}»`);
      }
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось загрузить эмодзи', true);
    }
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
          title="Открыть большой каталог всех 263 эмодзи MAGNAT"
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
            load(emptyDoc(), 'новый_эмодзи', null);
            say('Создан чистый холст 512×512');
          }}
          title="Создать пустой холст 512×512"
        >
          <FilePlus2 size={15} /> Пустой
        </button>

        <input
          className="file-name"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          aria-label="Имя файла"
        />

        <div className="top-actions">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Открыть .tgs, Lottie .json или архив пака .zip"
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
          <button
            type="button"
            className="zip-btn"
            onClick={downloadPackZip}
            title="Скачать весь пак готовых .tgs эмодзи в .zip"
          >
            <Download size={15} /> Пак .zip ({pack.length})
          </button>
          <button
            type="button"
            disabled={pixelBusy}
            onClick={() => download('json')}
            title="Скачать исходник Lottie JSON"
          >
            JSON
          </button>
          <button
            type="button"
            className="primary"
            disabled={pixelBusy}
            onClick={() => download('tgs')}
          >
            <Download size={15} /> Скачать .tgs
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".tgs,.json,.zip,application/json,application/zip"
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
            title="Все 263 эмодзи MAGNAT"
          >
            <LayoutGrid size={14} /> Паки
          </button>
          <button
            type="button"
            className={tab === 'brand' ? 'on' : ''}
            onClick={() => setTab('brand')}
            title="Замена и настройка надписи MAGNAT"
          >
            <Tag size={14} /> Надпись
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
              {brandInfo.count > 0 && (
                <button
                  type="button"
                  className="goto-brand-cta"
                  onClick={() => setTab('brand')}
                >
                  <Sparkles size={14} />
                  <span>Изменить надпись «{brandInfo.options.text || 'MAGNAT'}»</span>
                </button>
              )}

              <div className="tpl-search-wrap">
                <input
                  type="text"
                  className="tpl-search-input"
                  placeholder="Номер (#001, 45...) или раздел"
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
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    className={`template-card ${activeCatalogId === item.id ? 'active' : ''}`}
                    onClick={() => pickCatalogSidebar(item, false)}
                  >
                    <LazyThumb item={item} />
                    <div className="template-card-foot">
                      <span className="template-card-title">#{String(item.num).padStart(3, '0')}</span>
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
                ))}
                {filteredCatalog.length === 0 && (
                  <div className="tpl-empty">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}

          {tab === 'brand' && (
            <BrandPanel
              slotCount={brandInfo.count}
              options={brandInfo.options}
              packCount={pack.length}
              busy={fontBusy}
              onChange={handleBrandChange}
              onReset={handleBrandReset}
              onApplyToPack={handleApplyBrandToPack}
              onSwitchToAddText={() => setTab('text')}
            />
          )}

          {tab === 'layers' && (
            <LayersPanel
              tree={tree}
              selected={activeSel}
              selectedOpacity={selectedOpacity}
              onSelect={setSelected}
              onToggle={(p) => edit((d) => toggleHidden(d, p))}
              onRename={(p, name) => edit((d) => rename(d, p, name))}
              onMove={(dir) => {
                if (!activeSel) return;
                let moved = activeSel;
                edit((d) => {
                  moved = moveNode(d, activeSel, dir);
                });
                setSelected(moved);
              }}
              onDuplicate={() => activeSel && edit((d) => duplicateNode(d, activeSel))}
              onDelete={removeSelected}
              onTransform={(delta, mergeKey) => {
                if (!activeSel) return;
                edit((d) => adjustNodeTransform(d, activeSel, delta), mergeKey ?? null);
              }}
            />
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
        <Preview doc={outDoc} />
        <p className="muted small hint">
          Перетащите сюда <code>.tgs</code>, <code>.json</code> или целый архив пака <code>.zip</code>
        </p>
      </main>

      <aside className="right">
        <PalettePanel
          entries={palette}
          scopeName={activeSel ? (selectedNode?.nm || 'выбранный слой') : null}
          onClearScope={() => setSelected(null)}
          onChange={(from, to) =>
            edit(
              inScope((n) => replaceColor(n, from, to)),
              `color:${activeSel?.join('.')}`,
            )
          }
          onBulk={(op) =>
            edit(
              inScope((n) => {
                if (op === 'hue-') shiftHue(n, -30);
                if (op === 'hue+') shiftHue(n, 30);
                if (op === 'gray') grayscale(n);
                if (op === 'invert') invert(n);
              }),
            )
          }
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
          onTrim={() => edit(trimToLimit)}
          onOptimize={() => {
            const next = { ...optimize(doc), fx: doc.fx };
            const saved = tgsSize(applyShapeEffects(doc)) - tgsSize(applyShapeEffects(next));
            dispatch({ type: 'apply', next, key: null, at: Date.now() });
            say(saved > 0 ? `Файл сжат на ${formatKb(saved)}` : 'Файл уже оптимален');
          }}
        />
      </aside>

      <PackTray
        pack={pack}
        activeIndex={activePackIndex}
        onSelect={selectPackSticker}
        onAdd={() => {
          setModalAddToPack(true);
          setShowModal(true);
        }}
        onImportFiles={() => fileInput.current?.click()}
        onDuplicate={duplicatePackSticker}
        onRemove={removePackSticker}
        onClearOther={clearOtherPackStickers}
        onDownloadZip={downloadPackZip}
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
            load(newDoc, item.name, item.id);
            say(`Открыт «${item.name}». Отменить — Ctrl+Z.`);
            setShowModal(false);
          }
        }}
        onAddBatchToPack={handleAddBatchToPack}
        defaultAddToPack={modalAddToPack}
      />

      {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
    </div>
  );
}
