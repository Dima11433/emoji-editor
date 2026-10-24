import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  findBrandNodePath,
  samePath,
  type NodePath,
  type TransformDelta,
  type TreeNode,
} from '../lib/layers';

const KIND_LABEL: Record<TreeNode['kind'], string> = {
  shape: 'фигуры',
  precomp: 'композиция',
  null: 'контроллер',
  solid: 'заливка',
  text: 'текст',
  image: 'картинка',
  layer: 'слой',
  group: 'группа',
};

interface Props {
  tree: TreeNode[];
  selected: NodePath | null;
  selectedOpacity: number;
  onSelect: (path: NodePath | null) => void;
  onToggle: (path: NodePath) => void;
  onRename: (path: NodePath, name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTransform: (delta: TransformDelta, mergeKey?: string) => void;
}

function isPrefixOf(prefix: NodePath, target: NodePath | null): boolean {
  if (!target || prefix.length >= target.length) return false;
  return prefix.every((v, i) => v === target[i]);
}

export function LayersPanel(props: Props) {
  const { tree, selected, selectedOpacity } = props;
  if (!tree.length) {
    return <p className="muted pad">Слоёв пока нет. Выберите эмодзи MAGNAT в каталоге или добавьте текст.</p>;
  }

  const brandPath = findBrandNodePath(tree);

  return (
    <div className="layers">
      <div className="layer-actions">
        <span className="muted small">{selected ? 'Выбран слой' : 'Слои и композиции'}</span>
        {brandPath && (
          <button
            type="button"
            className="mini-btn accent-outline"
            onClick={() => props.onSelect(brandPath)}
            title="Выделить слой с надписью MAGNAT"
          >
            <Sparkles size={12} /> Надпись
          </button>
        )}
        <button type="button" className="icon-btn" disabled={!selected} onClick={() => props.onMove(-1)} title="Выше">
          <ArrowUp size={15} />
        </button>
        <button type="button" className="icon-btn" disabled={!selected} onClick={() => props.onMove(1)} title="Ниже">
          <ArrowDown size={15} />
        </button>
        <button type="button" className="icon-btn" disabled={!selected} onClick={props.onDuplicate} title="Дублировать">
          <Copy size={15} />
        </button>
        <button type="button" className="icon-btn danger" disabled={!selected} onClick={props.onDelete} title="Удалить (Delete)">
          <Trash2 size={15} />
        </button>
      </div>

      {selected && (
        <div className="layer-inspector">
          <div className="inspector-grid">
            <div className="inspector-group">
              <span className="muted small">Позиция</span>
              <div className="inspector-btns">
                <button
                  type="button"
                  className="icon-btn"
                  title="Влево (Shift = ×3)"
                  onClick={(e) => props.onTransform({ dx: e.shiftKey ? -24 : -8 }, 'tr:pos')}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Вверх (Shift = ×3)"
                  onClick={(e) => props.onTransform({ dy: e.shiftKey ? -24 : -8 }, 'tr:pos')}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Вниз (Shift = ×3)"
                  onClick={(e) => props.onTransform({ dy: e.shiftKey ? 24 : 8 }, 'tr:pos')}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Вправо (Shift = ×3)"
                  onClick={(e) => props.onTransform({ dx: e.shiftKey ? 24 : 8 }, 'tr:pos')}
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className="inspector-group">
              <span className="muted small">Масштаб и поворот</span>
              <div className="inspector-btns">
                <button
                  type="button"
                  className="icon-btn"
                  title="Уменьшить (−10%)"
                  onClick={() => props.onTransform({ scaleFactorX: 0.9, scaleFactorY: 0.9 }, 'tr:scale')}
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Увеличить (+10%)"
                  onClick={() => props.onTransform({ scaleFactorX: 1.1, scaleFactorY: 1.1 }, 'tr:scale')}
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Отразить по горизонтали"
                  onClick={() => props.onTransform({ scaleFactorX: -1, scaleFactorY: 1 })}
                >
                  <FlipHorizontal2 size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Повернуть −15°"
                  onClick={() => props.onTransform({ rotateDeg: -15 }, 'tr:rot')}
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Повернуть +15°"
                  onClick={() => props.onTransform({ rotateDeg: 15 }, 'tr:rot')}
                >
                  <RotateCw size={14} />
                </button>
              </div>
            </div>
          </div>

          <label className="inspector-opacity">
            <span className="muted small">Прозрачность · {selectedOpacity}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={selectedOpacity}
              onChange={(e) => props.onTransform({ opacity: Number(e.target.value) }, 'tr:op')}
            />
          </label>
        </div>
      )}

      <ul className="tree">
        {tree.map((node, i) => (
          <Row key={`${node.path.join('.')}:${i}`} node={node} depth={0} {...props} />
        ))}
      </ul>
    </div>
  );
}

function Row({ node, depth, ...props }: Props & { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(
    () => (depth === 0 && node.children.length > 0 && node.children.length <= 5) || node.isBrand,
  );
  const [editing, setEditing] = useState(false);
  const isSel = samePath(node.path, props.selected);

  useEffect(() => {
    if (isPrefixOf(node.path, props.selected)) {
      setOpen(true);
    }
  }, [node.path, props.selected]);

  return (
    <li>
      <div
        className={`row ${isSel ? 'sel' : ''} ${node.hidden ? 'hidden' : ''} ${node.isBrand ? 'brand-row' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => props.onSelect(isSel ? null : node.path)}
      >
        <button
          type="button"
          className="twisty"
          style={{ visibility: node.children.length ? 'visible' : 'hidden' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {editing ? (
          <input
            className="rename"
            autoFocus
            defaultValue={node.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              setEditing(false);
              if (e.target.value.trim()) props.onRename(node.path, e.target.value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span className="name" onDoubleClick={() => setEditing(true)} title="Двойной клик — переименовать">
            {node.isBrand && <span className="brand-dot" title="Содержит надпись MAGNAT">★ </span>}
            {node.name}
            <em className="kind">{KIND_LABEL[node.kind]}</em>
          </span>
        )}

        <button
          type="button"
          className="icon-btn eye"
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle(node.path);
          }}
          title={node.hidden ? 'Показать' : 'Скрыть'}
        >
          {node.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child, idx) => (
            <Row key={`${child.path.join('.')}:${idx}`} node={child} depth={depth + 1} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}
