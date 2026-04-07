export type InspectorNodeType =
  | 'scene'
  | 'sceneConfig'
  | 'layer'
  | 'texture'
  | 'mesh'
  | 'puppet'
  | 'effect'
  | 'effectPass'
  | 'properties'
  | 'json';

export interface InspectorTreeNode<T = unknown> {
  id: string;
  label: string;
  type: InspectorNodeType;
  meta?: string;
  toggleable?: boolean;
  toggled?: boolean;
  payload: T;
  children?: InspectorTreeNode<T>[];
}

export class SceneTreeView<T = unknown> {
  private readonly _root: HTMLElement;
  private readonly _onSelect: (node: InspectorTreeNode<T>) => void;
  private readonly _onToggle?: (node: InspectorTreeNode<T>, newValue: boolean) => void;
  private _selectedId: string | null = null;
  private _nodes: InspectorTreeNode<T>[] = [];
  private readonly _expanded = new Set<string>();
  private readonly _expandInitialized = new Set<string>();

  constructor(
    root: HTMLElement,
    onSelect: (node: InspectorTreeNode<T>) => void,
    onToggle?: (node: InspectorTreeNode<T>, newValue: boolean) => void,
  ) {
    this._root = root;
    this._onSelect = onSelect;
    this._onToggle = onToggle;
  }

  setSelected(id: string | null): void {
    this._selectedId = id;
  }

  render(nodes: InspectorTreeNode<T>[]): void {
    this._nodes = nodes;
    this._root.innerHTML = '';
    if (nodes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = '当前没有可展示的数据模型';
      this._root.appendChild(empty);
      return;
    }

    this._ensureDefaultExpandState(nodes);

    const list = document.createElement('div');
    list.className = 'inspector-tree';
    nodes.forEach((node) => list.appendChild(this._renderNode(node, 0)));
    this._root.appendChild(list);
  }

  private _renderNode(node: InspectorTreeNode<T>, depth: number): HTMLElement {
    const container = document.createElement('div');
    container.className = 'inspector-tree-node';
    container.style.paddingLeft = `${depth * 14}px`;

    const row = document.createElement('button');
    row.className = 'inspector-tree-row';
    if (this._selectedId === node.id) row.classList.add('selected');
    if (node.toggleable && node.toggled === false) row.classList.add('dimmed');

    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const arrow = document.createElement('span');
    arrow.className = 'inspector-tree-arrow';
    if (!hasChildren) {
      arrow.textContent = '·';
      arrow.classList.add('leaf');
    } else {
      const expanded = this._expanded.has(node.id);
      arrow.textContent = expanded ? '▾' : '▸';
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleExpand(node.id);
      });
    }

    const badge = document.createElement('span');
    badge.className = `inspector-tree-badge ${node.type}`;
    badge.textContent = this._getBadgeText(node.type);

    const label = document.createElement('span');
    label.className = 'inspector-tree-label';
    label.textContent = node.label;

    row.appendChild(arrow);
    row.appendChild(badge);
    row.appendChild(label);
    if (node.meta) {
      const meta = document.createElement('span');
      meta.className = 'inspector-tree-meta';
      meta.textContent = node.meta;
      row.appendChild(meta);
    }

    if (node.toggleable) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'inspector-tree-toggle';
      const isEnabled = node.toggled !== false;
      toggle.textContent = isEnabled ? 'ON' : 'OFF';
      if (!isEnabled) toggle.classList.add('off');
      toggle.title = isEnabled ? '点击禁用' : '点击启用';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onToggle?.(node, !isEnabled);
      });
      row.appendChild(toggle);
    }

    row.addEventListener('click', () => this._onSelect(node));
    container.appendChild(row);

    if (hasChildren && this._expanded.has(node.id)) {
      for (const child of children) {
        container.appendChild(this._renderNode(child, depth + 1));
      }
    }
    return container;
  }

  private _toggleExpand(id: string): void {
    if (this._expanded.has(id)) {
      this._expanded.delete(id);
    } else {
      this._expanded.add(id);
    }
    this.render(this._nodes);
  }

  private _ensureDefaultExpandState(nodes: InspectorTreeNode<T>[]): void {
    const walk = (list: InspectorTreeNode<T>[]) => {
      for (const node of list) {
        const hasChildren = !!node.children?.length;
        if (!this._expandInitialized.has(node.id) && hasChildren) {
          if (node.type === 'scene' && node.children?.length) {
            this._expanded.add(node.id);
          }
          this._expandInitialized.add(node.id);
        }
        if (node.children?.length) walk(node.children);
      }
    };
    walk(nodes);
  }

  private _getBadgeText(type: InspectorNodeType): string {
    switch (type) {
      case 'scene':
        return 'Scene';
      case 'sceneConfig':
        return 'Config';
      case 'layer':
        return 'Layer';
      case 'texture':
        return 'Tex';
      case 'mesh':
        return 'Mesh';
      case 'puppet':
        return 'Puppet';
      case 'effect':
        return 'FX';
      case 'effectPass':
        return 'Pass';
      case 'properties':
        return 'Data';
      case 'json':
        return 'JSON';
      default:
        return 'Node';
    }
  }
}
