import './inspector.css';
import type { Engine } from 'moyu-engine';
import type { ImageLayer, Layer } from 'moyu-engine/scenario/layers';
import type { WEScene } from 'formats/we';
import type { LayerDescriptor, WallpaperDescriptor } from 'moyu-engine/scenario/scene-model';
import { SceneTreeView, type InspectorTreeNode } from './SceneTreeView';
import {
  DetailPanel,
  type InspectorSelectionPayload,
  type JsonPayload,
  type LayerSelectionPayload,
  type MeshPayload,
  type PropertiesPayload,
  type SceneConfigPayload,
  type SceneSelectionPayload,
  type TexturePayload,
  type EffectPayload,
  type EffectPassPayload,
} from './DetailPanel';

interface InspectorState {
  selectedId: string | null;
  visible: boolean;
}

export class DataModelInspector {
  private static readonly _PREVIEW_BG_KEY = 'we.inspector.previewBg';
  private static readonly _PREVIEW_BG_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '#0b1020', label: '深色-午夜蓝' },
    { value: '#1a0f2e', label: '深色-深紫' },
    { value: '#f8fafc', label: '浅色-冷白' },
    { value: '#22d3ee', label: '亮色-青蓝' },
    { value: '#f43f5e', label: '亮色-玫红' },
    { value: '#f59e0b', label: '亮色-琥珀橙' },
    { value: '#a3e635', label: '亮色-荧光绿' },
    { value: '#c084fc', label: '亮色-紫罗兰' },
    { value: '#60a5fa', label: '亮色-天蓝' },
  ];
  private readonly _root: HTMLElement;
  private readonly _treeHost: HTMLElement;
  private readonly _detailHost: HTMLElement;
  private readonly _tree: SceneTreeView<InspectorSelectionPayload>;
  private readonly _detail: DetailPanel;
  private _toggleButton: HTMLElement | null = null;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _isDragging = false;
  private readonly _state: InspectorState = {
    selectedId: null,
    visible: false,
  };
  private _nodes: InspectorTreeNode<InspectorSelectionPayload>[] = [];
  private _engine: Engine | null = null;
  private _sceneAdapter: WEScene | null = null;
  private _onExport: (() => void | Promise<void>) | null = null;
  private _debugSelectedLayer: ImageLayer | null = null;

  constructor(root: HTMLElement) {
    this._root = root;
    this._root.innerHTML = '';
    this._root.classList.add('inspector-root');

    const header = document.createElement('div');
    header.className = 'inspector-header';
    const headerTop = document.createElement('div');
    headerTop.className = 'inspector-header-top';
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = '中间数据模型查看器';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'inspector-close-button';
    closeButton.textContent = '关闭';
    closeButton.setAttribute('aria-label', '关闭数据查看器');
    closeButton.addEventListener('click', () => this.setVisible(false));
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'inspector-export-button';
    exportButton.textContent = '导出数据';
    exportButton.setAttribute('aria-label', '导出当前壁纸数据');
    exportButton.addEventListener('click', () => {
      void this._onExport?.();
    });
    const headerActions = document.createElement('div');
    headerActions.className = 'inspector-header-actions';
    headerActions.appendChild(exportButton);
    headerActions.appendChild(closeButton);
    const headerSubtitle = document.createElement('div');
    headerSubtitle.className = 'inspector-subtitle';
    headerSubtitle.textContent = 'Parsed Model + Runtime';
    const headerToolbar = document.createElement('div');
    headerToolbar.className = 'inspector-toolbar';
    const previewBgLabel = document.createElement('div');
    previewBgLabel.className = 'inspector-toolbar-label';
    const previewBgText = document.createElement('span');
    previewBgText.className = 'inspector-toolbar-text';
    previewBgText.textContent = '预览背景';
    const previewBgSwatches = document.createElement('div');
    previewBgSwatches.className = 'inspector-bg-swatches';
    const swatchButtons: Array<{ value: string; button: HTMLButtonElement }> = [];

    DataModelInspector._PREVIEW_BG_OPTIONS.forEach((option) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'inspector-bg-swatch';
      swatch.style.backgroundColor = option.value;
      swatch.title = `${option.label} (${option.value})`;
      swatch.setAttribute('aria-label', option.label);
      swatchButtons.push({ value: option.value, button: swatch });
      previewBgSwatches.appendChild(swatch);
    });

    const previewBgPickerWrap = document.createElement('label');
    previewBgPickerWrap.className = 'inspector-bg-picker';
    previewBgPickerWrap.title = '自定义颜色';
    previewBgPickerWrap.textContent = '调色盘';
    const previewBgPicker = document.createElement('input');
    previewBgPicker.type = 'color';
    previewBgPicker.className = 'inspector-bg-picker-input';
    previewBgPickerWrap.appendChild(previewBgPicker);

    const initialPreviewBg = this._getInitialPreviewBg();
    this._applyPreviewBg(initialPreviewBg);
    if (this._isHexColor(initialPreviewBg)) {
      previewBgPicker.value = initialPreviewBg;
    }

    const syncPreviewBgSelectionState = (color: string): void => {
      const normalized = color.toLowerCase();
      let matchedPreset = false;
      swatchButtons.forEach(({ value, button }) => {
        const active = value.toLowerCase() === normalized;
        button.classList.toggle('active', active);
        if (active) matchedPreset = true;
      });
      previewBgPickerWrap.classList.toggle('active', !matchedPreset);
      if (this._isHexColor(color)) {
        previewBgPicker.value = color;
      }
    };

    const applyPreviewBg = (value: string): void => {
      this._applyPreviewBg(value);
      syncPreviewBgSelectionState(value);
      try {
        window.localStorage.setItem(DataModelInspector._PREVIEW_BG_KEY, value);
      } catch {
        // 忽略本地存储不可用场景
      }
    };

    swatchButtons.forEach(({ value, button }) => {
      button.addEventListener('click', () => applyPreviewBg(value));
    });
    previewBgPicker.addEventListener('input', () => applyPreviewBg(previewBgPicker.value));

    syncPreviewBgSelectionState(initialPreviewBg);
    previewBgLabel.appendChild(previewBgText);
    previewBgLabel.appendChild(previewBgSwatches);
    previewBgLabel.appendChild(previewBgPickerWrap);
    headerToolbar.appendChild(previewBgLabel);
    headerTop.appendChild(headerTitle);
    headerTop.appendChild(headerActions);
    header.appendChild(headerTop);
    header.appendChild(headerSubtitle);
    header.appendChild(headerToolbar);

    const body = document.createElement('div');
    body.className = 'inspector-body';
    this._treeHost = document.createElement('div');
    this._treeHost.className = 'inspector-pane inspector-tree-pane';
    this._detailHost = document.createElement('div');
    this._detailHost.className = 'inspector-pane inspector-detail-pane';
    body.appendChild(this._treeHost);
    body.appendChild(this._detailHost);
    this._root.appendChild(header);
    this._root.appendChild(body);

    this._tree = new SceneTreeView(this._treeHost, (node) => {
      this._state.selectedId = node.id;
      this._tree.setSelected(node.id);
      this._tree.render(this._nodes);
      this._syncSelectedDebugCapture(node.payload);
      this._detail.render(node.payload, this._engine);
    }, (node, newValue) => {
      if (!this._engine) return;
      if (node.type === 'layer') {
        const payload = node.payload as LayerSelectionPayload;
        if (payload.runtimeLayer) {
          payload.runtimeLayer.visible = newValue;
          this.refresh(this._sceneAdapter, this._engine);
        }
        return;
      }
      if (node.type === 'effectPass') {
        const payload = node.payload as EffectPassPayload;
        this._setPassEnabled(payload.runtimeLayer ?? null, payload.passIndex, newValue);
      }
    });
    this._detail = new DetailPanel(this._detailHost, (runtimeLayer, passIndex, enabled) => {
      this._setPassEnabled(runtimeLayer, passIndex, enabled);
    });
    this._detail.render(null, this._engine);
    this._bindDrag(header);
  }

  setExportHandler(handler: (() => void | Promise<void>) | null): void {
    this._onExport = handler;
  }

  bindToggleButton(button: HTMLElement): void {
    this._toggleButton = button;
    button.addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    this.setVisible(!this._state.visible);
  }

  setVisible(visible: boolean): void {
    this._state.visible = visible;
    this._root.classList.toggle('inspector-visible', visible);
    if (this._toggleButton) {
      this._toggleButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    }
    if (!visible) {
      this._syncSelectedDebugCapture(null);
    }
  }

  get isVisible(): boolean {
    return this._state.visible;
  }

  private _bindDrag(handle: HTMLElement): void {
    const onMouseMove = (event: MouseEvent): void => {
      if (!this._isDragging) return;
      const maxLeft = Math.max(0, window.innerWidth - this._root.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - this._root.offsetHeight);
      const left = Math.min(maxLeft, Math.max(0, event.clientX - this._dragOffsetX));
      const top = Math.min(maxTop, Math.max(0, event.clientY - this._dragOffsetY));
      this._root.style.left = `${left}px`;
      this._root.style.top = `${top}px`;
      this._root.style.right = 'auto';
    };

    const endDrag = (): void => {
      if (!this._isDragging) return;
      this._isDragging = false;
      this._root.classList.remove('inspector-dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
    };

    handle.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea, label, a')) return;
      const rect = this._root.getBoundingClientRect();
      this._dragOffsetX = event.clientX - rect.left;
      this._dragOffsetY = event.clientY - rect.top;
      this._isDragging = true;
      this._root.classList.add('inspector-dragging');
      this._root.style.left = `${rect.left}px`;
      this._root.style.top = `${rect.top}px`;
      this._root.style.right = 'auto';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', endDrag);
      event.preventDefault();
    });
  }

  refresh(sceneAdapter: WEScene | null, engine: Engine | null): void {
    this._sceneAdapter = sceneAdapter;
    this._engine = engine;
    const loadResult = sceneAdapter?.lastLoadResult;
    const inspector = loadResult?.inspector;
    const descriptor = (inspector?.descriptor ?? null) as WallpaperDescriptor | null;
    const scenePayload: SceneSelectionPayload = {
      kind: 'scene',
      descriptor,
      projectJson: sceneAdapter?.projectJson ?? null,
      sceneJson: inspector?.sceneJson ?? null,
      originalSceneJson: inspector?.originalSceneJson ?? null,
    };

    const sceneNode: InspectorTreeNode<InspectorSelectionPayload> = {
      id: 'scene-root',
      label: descriptor?.meta.title || 'Current Scene',
      type: 'scene',
      meta: descriptor ? `${descriptor.scene.width}x${descriptor.scene.height}` : '-',
      payload: scenePayload,
      children: [],
    };

    if (descriptor) {
      const sceneConfigPayload: SceneConfigPayload = {
        kind: 'sceneConfig',
        descriptor,
      };
      sceneNode.children?.push({
        id: 'scene-config',
        label: '场景配置',
        type: 'sceneConfig',
        meta: descriptor.scene.parallax?.enabled ? 'parallax on' : 'parallax off',
        payload: sceneConfigPayload,
      });

      const runtimeMap = new Map<string, Layer>();
      engine?.layers.forEach((layer) => runtimeMap.set(layer.id, layer));
      const rawObjMap = this._buildRawObjectMap(inspector?.sceneJson);
      const layerDescriptorById = new Map<string, LayerDescriptor>();
      descriptor.layers.forEach((layer) => layerDescriptorById.set(layer.id, layer));
      const layerNodeById = new Map<string, InspectorTreeNode<InspectorSelectionPayload>>();
      const parentIdByLayerId = new Map<string, string | null>();
      const dependencyMap = descriptor.layerDependencies ?? {};
      for (const layerDescriptor of descriptor.layers) {
        const layerNodeId = `layer-${layerDescriptor.id}`;
        const runtime = runtimeMap.get(layerDescriptor.id) ?? null;
        const rawObject = this._findRawObject(rawObjMap, layerDescriptor.id);
        const runtimeData = runtime?.getInspectorData();
        const extra = (runtimeData?.extra ?? null) as Record<string, unknown> | null;
        const effectPasses = Array.isArray(extra?.effectPasses) ? (extra?.effectPasses as Record<string, unknown>[]) : [];
        const effectFbos = Array.isArray(extra?.effectFbos) ? extra.effectFbos : [];

        const payload: LayerSelectionPayload = {
          kind: 'layer',
          descriptorLayer: layerDescriptor,
          runtimeLayer: runtime,
          rawObject,
        };

        const layerNode: InspectorTreeNode<InspectorSelectionPayload> = {
          id: layerNodeId,
          label: `${layerDescriptor.name || layerDescriptor.id}`,
          type: 'layer',
          meta: `${layerDescriptor.kind} · z=${layerDescriptor.zIndex ?? 0}`,
          toggleable: true,
          toggled: runtime?.visible ?? true,
          payload,
          children: [],
        };
        const parentLayerId = this._extractParentLayerId(rawObject);
        parentIdByLayerId.set(layerDescriptor.id, parentLayerId);

        if (runtimeData?.hasTexture) {
          const texturePayload: TexturePayload = {
            kind: 'texture',
            title: '纹理',
            texture: runtime?.texture ?? null,
          };
          layerNode.children?.push({
            id: `${layerNodeId}-texture`,
            label: '纹理',
            type: 'texture',
            meta: runtimeData.textureSize
              ? `${runtimeData.textureSize.width}x${runtimeData.textureSize.height}`
              : (runtimeData.textureId ?? '-'),
            payload: texturePayload,
          });
        }

        if (runtimeData?.hasMesh || runtimeData?.hasPuppetMesh) {
          const meshPayload: MeshPayload = {
            kind: 'mesh',
            title: runtimeData?.hasPuppetMesh ? 'Puppet 网格' : '网格',
            mesh: runtime?.mesh ?? null,
            puppetMesh: (runtime as any)?._puppetMesh ?? null,
          };
          const meshMeta = runtimeData?.hasPuppetMesh
            ? `${runtimeData.puppetMeshInfo?.vertexCount ?? 0} verts`
            : `${runtimeData?.vertexCount ?? 0} verts`;
          layerNode.children?.push({
            id: `${layerNodeId}-mesh`,
            label: runtimeData?.hasPuppetMesh ? 'Puppet 网格' : '网格',
            type: runtimeData?.hasPuppetMesh ? 'puppet' : 'mesh',
            meta: meshMeta,
            payload: meshPayload,
          });
        }

        if (effectPasses.length > 0) {
          const effectPayload: EffectPayload = {
            kind: 'effect',
            title: '效果管线',
            passes: effectPasses as any[],
            fbos: effectFbos,
            runtimeLayer: runtime,
          };
          const effectNode: InspectorTreeNode<InspectorSelectionPayload> = {
            id: `${layerNodeId}-effect`,
            label: '效果管线',
            type: 'effect',
            meta: `${effectPasses.length} passes`,
            payload: effectPayload,
            children: [],
          };

          effectPasses.forEach((pass, index) => {
            const effectPassPayload: EffectPassPayload = {
              kind: 'effectPass',
              passIndex: index,
              pass: pass as any,
              runtimeLayer: runtime,
            };
            effectNode.children?.push({
              id: `${layerNodeId}-effect-pass-${index}`,
              label: `Pass ${index}`,
              type: 'effectPass',
              meta: String((pass.effectName ?? pass.builtinEffect ?? pass.command ?? 'render')),
              toggleable: true,
              toggled: pass.enabled !== false,
              payload: effectPassPayload,
            });
          });

          layerNode.children?.push(effectNode);
        }

        const depLayerIds = dependencyMap[layerDescriptor.id] ?? [];
        if (depLayerIds.length > 0) {
          const dependencyItems = depLayerIds.map((depLayerId) => {
            const dep = layerDescriptorById.get(depLayerId);
            return {
              layerId: depLayerId,
              name: dep?.name ?? null,
              kind: dep?.kind ?? null,
              zIndex: dep?.zIndex ?? null,
              missing: !dep,
            };
          });
          const dependencyPayload: JsonPayload = {
            kind: 'json',
            title: '依赖关系',
            data: {
              layerId: layerDescriptor.id,
              dependencies: dependencyItems,
            },
          };
          const dependencyNode: InspectorTreeNode<InspectorSelectionPayload> = {
            id: `${layerNodeId}-dependencies`,
            label: '依赖关系',
            type: 'json',
            meta: `${depLayerIds.length} deps`,
            payload: dependencyPayload,
            children: [],
          };
          dependencyItems.forEach((item, index) => {
            const depMeta = item.missing
              ? 'missing'
              : `${item.kind ?? '-'} · z=${item.zIndex ?? 0}`;
            const depPayload: JsonPayload = {
              kind: 'json',
              title: `依赖项 ${index + 1}`,
              data: item,
            };
            dependencyNode.children?.push({
              id: `${layerNodeId}-dependency-${index}`,
              label: item.name ?? item.layerId,
              type: 'json',
              meta: depMeta,
              payload: depPayload,
            });
          });
          layerNode.children?.push(dependencyNode);
        }

        const propertiesPayload: PropertiesPayload = {
          kind: 'properties',
          title: '运行时数据 LayerInspectorData',
          data: runtimeData ?? null,
        };
        layerNode.children?.push({
          id: `${layerNodeId}-properties`,
          label: '运行时数据',
          type: 'properties',
          meta: runtimeData?.kind ?? '-',
          payload: propertiesPayload,
        });

        const descriptorPayload: JsonPayload = {
          kind: 'json',
          title: '描述符 LayerDescriptor',
          data: layerDescriptor,
        };
        layerNode.children?.push({
          id: `${layerNodeId}-descriptor`,
          label: '描述符 LayerDescriptor',
          type: 'json',
          meta: layerDescriptor.kind,
          payload: descriptorPayload,
        });

        const jsonPayload: JsonPayload = {
          kind: 'json',
          title: '原始 WEObject',
          data: rawObject,
        };
        layerNode.children?.push({
          id: `${layerNodeId}-json`,
          label: '原始 JSON',
          type: 'json',
          meta: rawObject ? 'available' : 'null',
          payload: jsonPayload,
        });

        layerNodeById.set(layerDescriptor.id, layerNode);
      }

      const visiting = new Set<string>();
      const attached = new Set<string>();
      const attachLayerNode = (layerId: string): void => {
        if (attached.has(layerId)) return;
        const node = layerNodeById.get(layerId);
        if (!node) return;

        const parentLayerId = parentIdByLayerId.get(layerId) ?? null;
        const hasCycle = !!parentLayerId && (parentLayerId === layerId || visiting.has(parentLayerId));
        if (hasCycle) {
          node.meta = node.meta ? `${node.meta} · cycle-fallback` : 'cycle-fallback';
        }

        visiting.add(layerId);
        const parentNode = !hasCycle && parentLayerId ? layerNodeById.get(parentLayerId) ?? null : null;
        if (parentNode) {
          attachLayerNode(parentLayerId!);
          const parentChildren = parentNode.children ?? (parentNode.children = []);
          if (!parentChildren.some((child) => child.id === node.id)) {
            parentChildren.unshift(node);
          }
        } else {
          const rootChildren = sceneNode.children ?? (sceneNode.children = []);
          if (!rootChildren.some((child) => child.id === node.id)) {
            rootChildren.push(node);
          }
        }
        visiting.delete(layerId);
        attached.add(layerId);
      };
      for (const layerDescriptor of descriptor.layers) {
        attachLayerNode(layerDescriptor.id);
      }
    }

    this._nodes = [sceneNode];
    if (!this._state.selectedId) {
      this._state.selectedId = 'scene-root';
    }
    this._tree.setSelected(this._state.selectedId);
    this._tree.render(this._nodes);

    const selected = this._findNodeById(this._nodes, this._state.selectedId) ?? sceneNode;
    this._state.selectedId = selected.id;
    this._syncSelectedDebugCapture(selected.payload);
    this._detail.render(selected.payload, this._engine);
  }

  private _setPassEnabled(runtimeLayer: Layer | null, passIndex: number, enabled: boolean): void {
    const imageLayer = this._asImageEffectLayer(runtimeLayer);
    if (!imageLayer || typeof imageLayer.setEffectPassEnabled !== 'function') return;
    imageLayer.setEffectPassEnabled(passIndex, enabled);
    this.refresh(this._sceneAdapter, this._engine);
  }

  private _syncSelectedDebugCapture(payload: InspectorSelectionPayload | null): void {
    const nextLayer = this._resolveSelectedDebugLayer(payload);
    if (this._debugSelectedLayer === nextLayer) return;
    if (this._debugSelectedLayer && typeof this._debugSelectedLayer.setInspectorPassDebugEnabled === 'function') {
      this._debugSelectedLayer.setInspectorPassDebugEnabled(false);
    }
    this._debugSelectedLayer = nextLayer;
    if (this._debugSelectedLayer && typeof this._debugSelectedLayer.setInspectorPassDebugEnabled === 'function') {
      this._debugSelectedLayer.setInspectorPassDebugEnabled(true);
    }
  }

  private _resolveSelectedDebugLayer(payload: InspectorSelectionPayload | null): ImageLayer | null {
    if (!payload) return null;
    if (payload.kind === 'layer') {
      return this._asImageEffectLayer(payload.runtimeLayer ?? null);
    }
    if (payload.kind === 'effect') {
      return this._asImageEffectLayer(payload.runtimeLayer ?? null);
    }
    if (payload.kind === 'effectPass') {
      return this._asImageEffectLayer(payload.runtimeLayer ?? null);
    }
    return null;
  }

  private _asImageEffectLayer(layer: Layer | null | undefined): ImageLayer | null {
    if (!layer || layer.kind !== 'image') return null;
    return layer as ImageLayer;
  }

  private _findNodeById(
    nodes: InspectorTreeNode<InspectorSelectionPayload>[],
    id: string | null,
  ): InspectorTreeNode<InspectorSelectionPayload> | null {
    if (!id) return null;
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const child = this._findNodeById(node.children, id);
        if (child) return child;
      }
    }
    return null;
  }

  private _buildRawObjectMap(sceneJson: unknown): Map<number, unknown> {
    const map = new Map<number, unknown>();
    if (!sceneJson || typeof sceneJson !== 'object') return map;
    const objects = (sceneJson as any).objects;
    if (!objects) return map;
    const list = Array.isArray(objects) ? objects : Object.values(objects);
    for (const obj of list as any[]) {
      if (typeof obj?.id === 'number') map.set(obj.id, obj);
    }
    return map;
  }

  private _findRawObject(rawObjMap: Map<number, unknown>, layerId: string): unknown {
    const matched = layerId.match(/(\d+)/g);
    if (!matched || matched.length === 0) return null;
    for (const token of matched) {
      const id = Number(token);
      if (rawObjMap.has(id)) return rawObjMap.get(id) ?? null;
    }
    return null;
  }

  private _extractParentLayerId(rawObject: unknown): string | null {
    if (!rawObject || typeof rawObject !== 'object') return null;
    const parent = (rawObject as { parent?: unknown }).parent;
    if (typeof parent === 'number' && Number.isFinite(parent)) {
      return `layer-${parent}`;
    }
    if (typeof parent === 'string' && /^[0-9]+$/.test(parent)) {
      return `layer-${parent}`;
    }
    return null;
  }

  private _getInitialPreviewBg(): string {
    const fallback = DataModelInspector._PREVIEW_BG_OPTIONS[0]?.value ?? '#172036';
    try {
      const stored = window.localStorage.getItem(DataModelInspector._PREVIEW_BG_KEY);
      if (!stored) return fallback;
      return this._isHexColor(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  }

  private _isHexColor(value: string): boolean {
    return /^#[0-9a-f]{6}$/i.test(value);
  }

  private _applyPreviewBg(color: string): void {
    this._root.style.setProperty('--inspector-preview-bg', color);
    const rgb = this._hexToRgb(color);
    const isLightBg = !!rgb && this._estimateLuma(rgb) >= 160;
    if (isLightBg) {
      this._root.style.setProperty('--inspector-preview-grid-major', 'rgba(15, 23, 42, 0.26)');
      this._root.style.setProperty('--inspector-preview-grid-minor', 'rgba(15, 23, 42, 0.14)');
    } else {
      this._root.style.setProperty('--inspector-preview-grid-major', 'rgba(148, 163, 184, 0.14)');
      this._root.style.setProperty('--inspector-preview-grid-minor', 'rgba(148, 163, 184, 0.08)');
    }
  }

  private _hexToRgb(color: string): { r: number; g: number; b: number } | null {
    if (!this._isHexColor(color)) return null;
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);
    return { r, g, b };
  }

  private _estimateLuma(rgb: { r: number; g: number; b: number }): number {
    // ITU-R BT.601 亮度近似，足够用于网格线明暗切换。
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  }
}
