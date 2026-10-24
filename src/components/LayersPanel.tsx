import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { samePath, type NodePath, type TreeNode } from '../lib/layers';

const KIND_LABEL: Record<TreeNode['kind'], string> = {
  shape: 'фигуры',
  precomp: 'вложенная анимация',
  null: 'пустой',
  solid: 'заливка',
  text: 'текст',
  image: 'картинка',
  layer: 'слой',
  group: 'группа',
};

interface Props {
  tree: TreeNode[];
  selected: NodePath | null;
  onSelect: (path: NodePath | null) => void;
  onToggle: (path: NodePath) => void;
  onRename: (path: NodePath, name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function LayersPanel(props: Props) {
  const { tree, selected } = props;
  if (!tree.length) return <p className="muted pad">Слоёв пока нет. Выберите шаблон или добавьте текст.</p>;
  return (
    <div className="layers">
      <div className="layer-actions">
        <span className="muted small">{selected ? 'Выбрано:' : 'Выберите слой или группу'}</span>
        <button className="icon-btn" disabled={!selected} onClick={() => props.onMove(-1)} title="Выше">
          <ArrowUp size={16} />
        </button>
        <button className="icon-btn" disabled={!selected} onClick={() => props.onMove(1)} title="Ниже">
          <ArrowDown size={16} />
        </button>
        <button className="icon-btn" disabled={!selected} onClick={props.onDuplicate} title="Дублировать">
          <Copy size={16} />
        </button>
        <button className="icon-btn danger" disabled={!selected} onClick={props.onDelete} title="Удалить (Delete)">
          <Trash2 size={16} />
        </button>
      </div>
      <ul className="tree">
        {tree.map((node) => (
          <Row key={node.path.join('.')} node={node} depth={0} {...props} />
        ))}
      </ul>
    </div>
  );
}

function Row({ node, depth, ...props }: Props & { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0 && node.children.length < 6);
  const [editing, setEditing] = useState(false);
  const isSel = samePath(node.path, props.selected);

  return (
    <li>
      <div
        className={`row ${isSel ? 'sel' : ''} ${node.hidden ? 'hidden' : ''}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={() => props.onSelect(isSel ? null : node.path)}
      >
        <button
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
            {node.name}
            {depth === 0 && <em className="kind">{KIND_LABEL[node.kind]}</em>}
          </span>
        )}
        <button
          className="icon-btn eye"
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle(node.path);
          }}
          title={node.hidden ? 'Показать' : 'Скрыть'}
        >
          {node.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <Row key={child.path.join('.')} node={child} depth={depth + 1} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}
