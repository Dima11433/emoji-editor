import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Download, FilePlus2, FolderArchive, FolderOpen, Layers, LayoutGrid, Redo2, Sparkles, Type, Undo2 } from 'lucide-react';
import type { Font } from 'opentype.js';
import { ChecksPanel } from './components/ChecksPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LayersPanel } from './components/LayersPanel';
import { PackTray, type PackItem } from './components/PackTray';
import { PalettePanel } from './components/PalettePanel';
import { Preview, Thumb } from './components/Preview';
import { TemplatesModal } from './components/TemplatesModal';
import { TextPanel, type TextRequest } from './components/TextPanel';
import { applyShapeEffects, getEffects, type Effects } from './lib/effects';
import { collectColors, grayscale, invert, replaceColor, shiftHue } from './lib/colors';
import { loadFont } from './lib/fonts';
import {
  buildTree,
  colorScope,
  duplicateNode,
  getNode,
  moveNode,
  removeNode,
  rename,
  toggleHidden,
  type NodePath,
} from './lib/layers';
import { emptyDoc, reindexLayers, type LottieDoc } from './lib/lottie';
import { createPackZip } from './lib/packZip';
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from './lib/templates';
import { pixelate } from './lib/pixelSample';
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
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 60;

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'apply': {
      // Rapid edits with the same key (dragging a color picker) become one undo step.
      const merge = action.key !== null && action.key === state.lastKey && action.at - state.lastAt < 1000;
      return {
        doc: action.next,
        past: merge ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future], lastKey: null, lastAt: 0 };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { doc: next, past: [...state.past, state.doc], future: rest, lastKey: null, lastAt: 0 };
    }
  }
}

type Tab = 'templates' | 'layers' | 'text';

export default function App() {
  const [hist, dispatch] = useReducer(reducer, null, () => ({
    doc: TEMPLATES[0].build(null),
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
  }));
  const doc = hist.doc;
  const [fileName, setFileName] = useState('sticker');
  const [selected, setSelected] = useState<NodePath | null>(null);
  const [tab, setTab] = useState<Tab>('templates');
  const [tplCategory, setTplCategory] = useState<'all' | TemplateCategory>('all');
  const [tplSearch, setTplSearch] = useState('');
  const [pack, setPack] = useState<PackItem[]>(() => [
    { id: '1', name: 'Сердце', doc: TEMPLATES[0].build(null) },
  ]);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [showPackTray, setShowPackTray] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalAddToPack, setModalAddToPack] = useState(false);

  // Keep active pack item in sync with current doc & fileName
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

  const selectPackSticker = (idx: number) => {
    if (idx < 0 || idx >= pack.length) return;
    setActivePackIndex(idx);
    const target = pack[idx];
    load(structuredClone(target.doc), target.name);
    say(`Стикер #${idx + 1}: ${target.name}`);
  };

  const addToPack = (newDoc: LottieDoc, name: string) => {
    const newItem: PackItem = {
      id: String(Date.now()),
      name,
      doc: newDoc,
    };
    setPack((prev) => [...prev, newItem]);
    setActivePackIndex(pack.length);
    load(newDoc, name);
    setShowPackTray(true);
    say(`Добавлен стикер «${name}» в пак (#${pack.length + 1})`);
  };

  const duplicatePackSticker = (idx: number) => {
    const src = pack[idx];
    if (!src) return;
    const clone: PackItem = {
      id: String(Date.now()),
      name: `${src.name}_copy`,
      doc: structuredClone(src.doc),
    };
    const next = [...pack.slice(0, idx + 1), clone, ...pack.slice(idx + 1)];
    setPack(next);
    setActivePackIndex(idx + 1);
    load(clone.doc, clone.name);
    say(`Стикер скопирован: ${clone.name}`);
  };

  const removePackSticker = (idx: number) => {
    if (pack.length <= 1) return;
    const next = pack.filter((_, i) => i !== idx);
    const nextActive = Math.min(activePackIndex, next.length - 1);
    setPack(next);
    setActivePackIndex(nextActive);
    load(structuredClone(next[nextActive].doc), next[nextActive].name);
    say('Стикер удалён из пака');
  };

  const downloadPackZip = async () => {
    try {
      say('Формирую .zip архив пака...');
      const blob = await createPackZip(pack, 'telegram_emoji_pack');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emoji_pack_${pack.length}_stickers.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`Пак из ${pack.length} стикеров скачан!`);
    } catch (err) {
      say(err instanceof Error ? err.message : 'Ошибка создания архива', true);
    }
  };
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [templateFonts, setTemplateFonts] = useState<Font[] | null>(null);
  const [fontBusy, setFontBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const say = useCallback((text: string, bad = false) => setToast({ text, bad }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    loadFont('rubik').then(setTemplateFonts, () => say('Не удалось загрузить шрифт для шаблонов', true));
  }, [say]);

  const edit = useCallback(
    (fn: (d: LottieDoc) => void, key: string | null = null) => {
      const next = structuredClone(doc);
      fn(next);
      dispatch({ type: 'apply', next, key, at: Date.now() });
    },
    [doc],
  );

  const load = (next: LottieDoc, name: string) => {
    dispatch({ type: 'apply', next, key: null, at: Date.now() });
    setFileName(name);
    setSelected(null);
  };

  const openFile = async (file: File) => {
    try {
      const next = parseSticker(new Uint8Array(await file.arrayBuffer()));
      load(next, file.name.replace(/\.(tgs|json)$/i, ''));
      setTab('layers');
      say(`Открыт файл ${file.name}`);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Не удалось открыть файл', true);
    }
  };

  const download = (kind: 'tgs' | 'json') => {
    const data = kind === 'tgs' ? toTgs(outDoc) : new TextEncoder().encode(serialize(outDoc));
    const blob = new Blob([data], { type: kind === 'tgs' ? 'application/x-tgsticker' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.trim() || 'sticker'}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // A stale selection (after undo, say) falls back to the whole sticker.
  const selectedNode = selected ? getNode(doc, selected) : undefined;
  const activeSel = selectedNode ? selected : null;

  // Effects are applied on top of the edited document; layers stay untouched.
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
        .catch(() => !cancelled && say('Не получилось пикселизировать стикер', true))
        .finally(() => !cancelled && setPixelBusy(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shaped, fx.pixel.on, fx.pixel.grid, say]);
  const outDoc = fx.pixel.on && pixelOut ? pixelOut.doc : shaped;
  const pixelStatus = !fx.pixel.on ? null : pixelBusy ? 'Считаю пиксели…' : pixelOut ? `${pixelOut.fps} к/с, чтобы влезть в 64 кБ` : null;

  const setEffect = <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>, merge = false) =>
    edit((d) => {
      const cur = getEffects(d);
      d.fx = { ...cur, [key]: { ...cur[key], ...patch } };
    }, merge ? `fx:${key}` : null);

  const tree = useMemo(() => buildTree(doc), [doc]);
  const palette = useMemo(() => collectColors(colorScope(doc, activeSel)), [doc, activeSel]);
  const size = useMemo(() => tgsSize(outDoc), [outDoc]);
  const checks = useMemo(() => checkTelegram(outDoc, size), [outDoc, size]);
  const thumbs = useMemo(
    () => TEMPLATES.map((t) => ({ t, doc: t.needsFont && !templateFonts ? null : t.build(templateFonts) })),
    [templateFonts],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEMPLATES.length };
    for (const t of TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredThumbs = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return thumbs.filter(({ t }) => {
      if (tplCategory !== 'all' && t.category !== tplCategory) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [thumbs, tplCategory, tplSearch]);

  const inScope = (fn: (node: unknown) => void) => (d: LottieDoc) => fn(colorScope(d, activeSel));

  const addText = async (req: TextRequest) => {
    setFontBusy(true);
    try {
      const fonts = await loadFont(req.fontId);
      const layer = textToLayer({ ...DEFAULT_TEXT, ...req, fonts });
      edit((d) => {
        d.layers.unshift(layer);
        reindexLayers(d.layers);
      });
      setSelected([0]);
      say('Текст добавлен. Его цвета теперь в палитре справа.');
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

  const tooBig = size > MAX_BYTES;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Sparkles size={20} />
          <span>Мастерская эмодзи</span>
        </div>
        <button
          type="button"
          className="topbar-btn"
          onClick={() => {
            setModalAddToPack(false);
            setShowModal(true);
          }}
          title="Каталог готовых шаблонов (модальное окно)"
        >
          <LayoutGrid size={15} /> Шаблоны
        </button>
        <button
          type="button"
          className={`topbar-btn ${showPackTray ? 'active' : ''}`}
          onClick={() => setShowPackTray((v) => !v)}
          title="Стикерпак: открыть/скрыть панель пака"
        >
          <FolderArchive size={15} /> Пак ({pack.length})
        </button>
        <button
          type="button"
          className="topbar-btn"
          onClick={() => {
            load(emptyDoc(), 'новый_стикер');
            say('Создан чистый холст');
          }}
          title="Создать новый пустой стикер"
        >
          <FilePlus2 size={15} /> Новый
        </button>
        <input className="file-name" value={fileName} onChange={(e) => setFileName(e.target.value)} aria-label="Имя файла" />
        <div className="top-actions">
          <button onClick={() => fileInput.current?.click()} title="Открыть .tgs или Lottie .json">
            <FolderOpen size={16} /> Открыть
          </button>
          <button className="icon-btn" disabled={!hist.past.length} onClick={() => dispatch({ type: 'undo' })} title="Отменить (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button className="icon-btn" disabled={!hist.future.length} onClick={() => dispatch({ type: 'redo' })} title="Вернуть (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
          <span className={`size-badge ${tooBig ? 'bad' : ''}`} title="Размер .tgs после сжатия">
            {formatKb(size)} / 64 кБ
          </span>
          <button className="zip-btn" onClick={downloadPackZip} title="Скачать весь пак архивом .zip">
            <Download size={15} /> Пак (.zip)
          </button>
          <button disabled={pixelBusy} onClick={() => download('json')} title="Lottie JSON для других редакторов">
            JSON
          </button>
          <button className="primary" disabled={pixelBusy} onClick={() => download('tgs')}>
            <Download size={16} /> Скачать .tgs
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".tgs,.json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openFile(f);
            e.target.value = '';
          }}
        />
      </header>

      <aside className="left">
        <nav className="tabs">
          <button className={tab === 'templates' ? 'on' : ''} onClick={() => setTab('templates')}>
            <LayoutGrid size={15} /> Шаблоны
          </button>
          <button className={tab === 'layers' ? 'on' : ''} onClick={() => setTab('layers')}>
            <Layers size={15} /> Слои
          </button>
          <button className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>
            <Type size={15} /> Текст
          </button>
        </nav>
        <div className="tab-body">
          {tab === 'templates' && (
            <div className="templates-panel pad">
              <div className="tpl-search-wrap">
                <input
                  type="text"
                  className="tpl-search-input"
                  placeholder="Поиск шаблонов..."
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                />
                {tplSearch && (
                  <button className="tpl-search-clear" onClick={() => setTplSearch('')} title="Очистить">
                    ×
                  </button>
                )}
              </div>
              <div className="tpl-categories">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`tpl-chip ${tplCategory === cat.id ? 'on' : ''}`}
                    onClick={() => setTplCategory(cat.id)}
                  >
                    <span>{cat.label}</span>
                    <span className="count">{categoryCounts[cat.id] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="templates">
                {filteredThumbs.map(({ t, doc: tdoc }) => (
                  <button
                    key={t.id}
                    className="template"
                    disabled={!tdoc}
                    onClick={() => {
                      if (!tdoc) return;
                      load(structuredClone(tdoc), t.id);
                      say(`Шаблон «${t.name}». Отменить — Ctrl+Z.`);
                    }}
                  >
                    {tdoc ? <Thumb doc={tdoc} /> : <div className="thumb" />}
                    <span>{t.name}</span>
                  </button>
                ))}
                {filteredThumbs.length === 0 && (
                  <div className="tpl-empty">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}
          {tab === 'layers' && (
            <LayersPanel
              tree={tree}
              selected={activeSel}
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
          const f = e.dataTransfer.files[0];
          if (f) openFile(f);
        }}
      >
        <Preview doc={outDoc} />
        <p className="muted small hint">Перетащите сюда .tgs или Lottie .json, чтобы открыть</p>
      </main>

      <aside className="right">
        <PalettePanel
          entries={palette}
          scopeName={activeSel ? (selectedNode?.nm ?? 'выбранное') : null}
          onClearScope={() => setSelected(null)}
          onChange={(from, to) => edit(inScope((n) => replaceColor(n, from, to)), `color:${activeSel?.join('.')}`)}
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
          layers={doc.layers.filter((l) => l.ind !== undefined).map((l, i) => ({ ind: l.ind!, name: l.nm || `Слой ${i + 1}` }))}
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
            say(saved > 0 ? `Файл стал меньше на ${formatKb(saved)}` : 'Файл уже сжат');
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
        onDuplicate={duplicatePackSticker}
        onRemove={removePackSticker}
        onDownloadZip={downloadPackZip}
        isOpen={showPackTray}
        onToggle={() => setShowPackTray((v) => !v)}
      />

      <TemplatesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(newDoc, tpl, isAdd) => {
          if (isAdd) {
            addToPack(newDoc, tpl.name);
          } else {
            load(newDoc, tpl.name);
            say(`Шаблон «${tpl.name}». Отменить — Ctrl+Z.`);
          }
          setShowModal(false);
        }}
        templateFonts={templateFonts}
        defaultAddToPack={modalAddToPack}
      />

      {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
    </div>
  );
}
