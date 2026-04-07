import type { Layer, LayerInspectorData } from 'moyu-engine/scenario/layers';
import type { LayerDescriptor, WallpaperDescriptor } from 'moyu-engine/scenario/scene-model';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { IMesh } from 'moyu-engine/rendering/interfaces/IMesh';
import type { Engine } from 'moyu-engine';
import type { EffectPassDebugFrame, EffectPassDebugPreview } from 'moyu-engine/components/effects/EffectPipeline';
import { TexturePreview } from './TexturePreview';
import { MeshPreview } from './MeshPreview';
import { EffectPipelineView, type EffectPipelinePassViewModel } from './EffectPipelineView';
import { LayerRenderPreview } from './LayerRenderPreview';
import { ImageLightbox } from './ImageLightbox';

export interface SceneSelectionPayload {
  kind: 'scene';
  descriptor: WallpaperDescriptor | null;
  projectJson: unknown;
  sceneJson: unknown;
  originalSceneJson: unknown;
}

export interface LayerSelectionPayload {
  kind: 'layer';
  descriptorLayer: LayerDescriptor;
  runtimeLayer: Layer | null;
  rawObject: unknown;
}

export interface SceneConfigPayload {
  kind: 'sceneConfig';
  descriptor: WallpaperDescriptor | null;
}

export interface TexturePayload {
  kind: 'texture';
  title: string;
  texture: ITexture | null;
}

interface PuppetMeshLike {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

export interface MeshPayload {
  kind: 'mesh';
  title: string;
  mesh: IMesh | null;
  puppetMesh?: PuppetMeshLike | null;
}

export interface EffectPassItemPayload {
  effectName?: string;
  vertexShader?: string;
  fragmentShader?: string;
  builtinEffect?: string;
  builtinParams?: Record<string, unknown>;
  command?: string;
  target?: string;
  binds?: Record<number, string> | Record<string, string>;
  uniforms?: Record<string, unknown>;
  depthTest?: boolean;
  depthWrite?: boolean;
  cullMode?: string;
  debugLabel?: string;
  enabled?: boolean;
}

export interface EffectPayload {
  kind: 'effect';
  title: string;
  passes: EffectPassItemPayload[];
  fbos: unknown[];
  runtimeLayer?: Layer | null;
}

export interface EffectPassPayload {
  kind: 'effectPass';
  passIndex: number;
  pass: EffectPassItemPayload;
  runtimeLayer?: Layer | null;
}

interface EffectDebugRuntimeLayer {
  setEffectPassEnabled(passIndex: number, enabled: boolean): void;
  getInspectorPassDebugFrames(): EffectPassDebugFrame[];
  getInspectorPassDebugPreview(passIndex: number, maxSize?: number): EffectPassDebugPreview | null;
}

export interface PropertiesPayload {
  kind: 'properties';
  title: string;
  data: unknown;
}

export interface JsonPayload {
  kind: 'json';
  title: string;
  data: unknown;
}

export type InspectorSelectionPayload =
  | SceneSelectionPayload
  | LayerSelectionPayload
  | SceneConfigPayload
  | TexturePayload
  | MeshPayload
  | EffectPayload
  | EffectPassPayload
  | PropertiesPayload
  | JsonPayload;

export class DetailPanel {
  private readonly _root: HTMLElement;
  private readonly _summary: HTMLElement;
  private readonly _layerRenderRoot: HTMLElement;
  private readonly _textureRoot: HTMLElement;
  private readonly _meshRoot: HTMLElement;
  private readonly _effectRoot: HTMLElement;
  private readonly _layerRenderPreview: LayerRenderPreview;
  private readonly _texturePreview: TexturePreview;
  private readonly _meshPreview: MeshPreview;
  private readonly _effectView: EffectPipelineView;
  private readonly _lightbox: ImageLightbox;
  private readonly _onEffectPassToggle: ((runtimeLayer: Layer, passIndex: number, enabled: boolean) => void) | null;
  private _engine: Engine | null = null;
  private _lastSelectionKey: string | null = null;

  constructor(
    root: HTMLElement,
    onEffectPassToggle?: (runtimeLayer: Layer, passIndex: number, enabled: boolean) => void,
  ) {
    this._root = root;
    this._layerRenderRoot = document.createElement('div');
    this._root.appendChild(this._layerRenderRoot);

    this._summary = document.createElement('div');
    this._summary.className = 'inspector-detail-summary';
    this._root.appendChild(this._summary);

    this._textureRoot = document.createElement('div');
    this._meshRoot = document.createElement('div');
    this._effectRoot = document.createElement('div');
    this._root.appendChild(this._textureRoot);
    this._root.appendChild(this._meshRoot);
    this._root.appendChild(this._effectRoot);

    this._lightbox = new ImageLightbox();
    const handlePreviewClick = (payload: { source: CanvasImageSource; width: number; height: number; title?: string }): void => {
      this._lightbox.open(payload);
    };
    this._layerRenderPreview = new LayerRenderPreview(this._layerRenderRoot, handlePreviewClick);
    this._texturePreview = new TexturePreview(this._textureRoot, handlePreviewClick);
    this._meshPreview = new MeshPreview(this._meshRoot, handlePreviewClick);
    this._effectView = new EffectPipelineView(this._effectRoot, handlePreviewClick);
    this._onEffectPassToggle = onEffectPassToggle ?? null;
  }

  render(payload: InspectorSelectionPayload | null, engine: Engine | null): void {
    const nextSelectionKey = this._selectionKey(payload);
    if (nextSelectionKey !== this._lastSelectionKey && this._lightbox.visible) {
      this._lightbox.close();
    }
    this._lastSelectionKey = nextSelectionKey;
    this._engine = engine;
    this._summary.innerHTML = '';
    if (!payload) {
      this._summary.innerHTML = '<div class="inspector-empty">请选择左侧节点查看详情</div>';
      this._resetPreviews();
      return;
    }
    switch (payload.kind) {
      case 'scene':
        this._renderScene(payload);
        break;
      case 'sceneConfig':
        this._renderSceneConfig(payload);
        break;
      case 'layer':
        this._renderLayer(payload);
        break;
      case 'texture':
        this._renderTexture(payload);
        break;
      case 'mesh':
        this._renderMesh(payload);
        break;
      case 'effect':
        this._renderEffect(payload);
        break;
      case 'effectPass':
        this._renderEffectPass(payload);
        break;
      case 'properties':
        this._renderProperties(payload);
        break;
      case 'json':
        this._renderJson(payload);
        break;
      default:
        this._summary.innerHTML = '<div class="inspector-empty">未知节点类型</div>';
        this._resetPreviews();
        break;
    }
  }

  private _renderScene(payload: SceneSelectionPayload): void {
    const d = payload.descriptor;
    this._summary.appendChild(this._title('场景信息'));
    this._summary.appendChild(this._subGroupTitle('概览'));
    this._summary.appendChild(this._kvGridBlock({
      标题: d?.meta.title || '-',
      类型: d?.meta.type || '-',
      尺寸: d ? `${d.scene.width} x ${d.scene.height}` : '-',
      图层数: d ? String(d.layers.length) : '0',
      路径: d?.meta.sourcePath || '-',
    }, 2));

    this._summary.appendChild(this._jsonBlock('project.json', payload.projectJson));
    this._summary.appendChild(this._jsonBlock('scene.json (原始)', payload.originalSceneJson));
    this._summary.appendChild(this._jsonBlock('scene.json (解析后)', payload.sceneJson));
    if (d?.layerDependencies) {
      this._summary.appendChild(this._jsonBlock('图层依赖关系', d.layerDependencies));
    }
    if (d?.specialLayers) {
      this._summary.appendChild(this._subGroupTitle('特殊图层'));
      this._summary.appendChild(this._kvGridBlock({
        irisLayerIds: d.specialLayers.irisLayerIds.join(', ') || '-',
        mouseTrailLayerIds: d.specialLayers.mouseTrailLayerIds.join(', ') || '-',
      }, 2));
    }
    this._summary.appendChild(this._jsonBlock('中间描述符 Descriptor', payload.descriptor));

    this._resetPreviews();
  }

  private _renderLayer(payload: LayerSelectionPayload): void {
    const runtimeData = payload.runtimeLayer?.getInspectorData();
    const effectRuntime = this._asEffectDebugRuntimeLayer(payload.runtimeLayer);
    this._summary.appendChild(this._title(`图层: ${payload.descriptorLayer.name || payload.descriptorLayer.id}`));
    this._summary.appendChild(this._subGroupTitle('描述符概览'));
    this._summary.appendChild(this._kvGridBlock({
      id: payload.descriptorLayer.id,
      kind: payload.descriptorLayer.kind,
      zIndex: String(payload.descriptorLayer.zIndex ?? 0),
      visible: String(payload.descriptorLayer.visible ?? true),
      opacity: String(payload.descriptorLayer.opacity ?? 1),
      size: `${payload.descriptorLayer.width} x ${payload.descriptorLayer.height}`,
      runtimeKind: runtimeData?.kind || '-',
    }, 3));

    if (runtimeData) {
      const runtimeScale = {
        x: runtimeData.scale?.x ?? 1,
        y: runtimeData.scale?.y ?? 1,
      };
      const runtimeAnchor = {
        x: runtimeData.anchor?.x ?? 0.5,
        y: runtimeData.anchor?.y ?? 0.5,
      };
      this._summary.appendChild(this._subGroupTitle('运行时变换'));
      this._summary.appendChild(this._kvCompactGridBlock({
        位置: this._formatVecValue([runtimeData.x, runtimeData.y]),
        缩放: this._formatVecValue([runtimeScale.x, runtimeScale.y]),
        旋转: this._formatNumber(runtimeData.rotation),
        锚点: this._formatVecValue([runtimeAnchor.x, runtimeAnchor.y]),
      }, 3));

      this._summary.appendChild(this._subGroupTitle('其他'));
      this._summary.appendChild(this._kvCompactGridBlock({
        视差深度: this._formatVecValue([runtimeData.parallaxDepth[0], runtimeData.parallaxDepth[1]]),
        fullscreen: String(runtimeData.fullscreen),
        renderPhase: String(runtimeData.renderPhase),
      }, 3));

      this._summary.appendChild(this._subGroupTitle('资源状态'));
      this._summary.appendChild(this._kvGridBlock({
        hasTexture: String(runtimeData.hasTexture),
        hasMesh: String(runtimeData.hasMesh),
        hasPuppetMesh: String(runtimeData.hasPuppetMesh),
      }, 3));

      const extra = runtimeData.extra && typeof runtimeData.extra === 'object'
        ? (runtimeData.extra as Record<string, unknown>)
        : null;
      if (extra) {
        const scalarExtra: Record<string, string> = {};
        const nestedExtra: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(extra)) {
          if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            scalarExtra[key] = this._formatSimpleValue(value);
          } else if (Array.isArray(value) || typeof value === 'object') {
            nestedExtra[key] = value;
          }
        }
        if (Object.keys(scalarExtra).length > 0) {
          this._summary.appendChild(this._subGroupTitle('运行时扩展(标量)'));
          const extraColumns = Math.max(1, Math.min(3, Object.keys(scalarExtra).length));
          this._summary.appendChild(this._kvGridBlock(scalarExtra, extraColumns));
        }
        for (const [key, value] of Object.entries(nestedExtra)) {
          this._summary.appendChild(this._jsonBlock(`extra.${key}`, value));
        }
      }
    } else {
      this._summary.appendChild(this._subGroupTitle('运行时'));
      this._summary.appendChild(this._kvGridBlock({
        hasRuntime: 'false',
      }, 1));
    }

    this._summary.appendChild(this._subGroupTitle('实时预览'));
    const previewTexture = payload.runtimeLayer?.texture ?? null;
    const previewMesh = payload.runtimeLayer?.mesh ?? null;
    const previewPuppetMesh = (payload.runtimeLayer as any)?._puppetMesh as PuppetMeshLike | null | undefined;
    const effectPasses = this._extractEffectPasses(runtimeData);
    const effectModels = this._buildEffectPassViewModels(effectPasses, effectRuntime);
    const showTexture = !!previewTexture;
    const showMesh = !!previewMesh || !!previewPuppetMesh;
    const showEffect = effectModels.length > 0;

    this._showSections(true, showTexture, showMesh, showEffect);
    this._layerRenderPreview.render(payload.runtimeLayer ?? null, this._engine);

    if (!showTexture && !showMesh && !showEffect) {
      this._texturePreview.render(null);
      return;
    }
    if (showTexture) this._texturePreview.render(previewTexture);
    if (showMesh) this._meshPreview.render(previewMesh, previewPuppetMesh ?? undefined);
    if (showEffect) {
      this._effectView.render(effectModels, {
        onTogglePass: effectRuntime ? (passIndex, enabled) => this._togglePass(effectRuntime, passIndex, enabled) : undefined,
      });
    }
  }

  private _renderSceneConfig(payload: SceneConfigPayload): void {
    const scene = payload.descriptor?.scene;
    this._summary.appendChild(this._title('场景配置'));
    this._summary.appendChild(this._subGroupTitle('场景参数'));
    this._summary.appendChild(this._subGroupTitle('尺寸'));
    this._summary.appendChild(this._kvGridBlock({
      width: scene ? String(scene.width) : '-',
      height: scene ? String(scene.height) : '-',
    }, 2));
    this._summary.appendChild(this._subGroupTitle('清屏'));
    this._summary.appendChild(this._kvGridBlock({
      clearColor: scene?.clearColor ? this._safeStringify(scene.clearColor) : '-',
    }, 1));
    this._summary.appendChild(this._subGroupTitle('Parallax'));
    this._summary.appendChild(this._kvGridBlock({
      parallaxEnabled: String(scene?.parallax?.enabled ?? false),
      parallaxAmount: String(scene?.parallax?.amount ?? 0),
      parallaxDelay: String(scene?.parallax?.delay ?? 0),
      parallaxMouseInfluence: String(scene?.parallax?.mouseInfluence ?? 0),
    }, 2));
    this._summary.appendChild(this._subGroupTitle('Shake'));
    this._summary.appendChild(this._kvGridBlock({
      shakeEnabled: String(scene?.shake?.enabled ?? false),
      shakeAmplitude: String(scene?.shake?.amplitude ?? 0),
      shakeRoughness: String(scene?.shake?.roughness ?? 0),
      shakeSpeed: String(scene?.shake?.speed ?? 0),
    }, 2));
    this._summary.appendChild(this._jsonBlock('scene 配置对象', scene ?? null));
    this._resetPreviews();
  }

  private _renderTexture(payload: TexturePayload): void {
    this._summary.appendChild(this._title(payload.title));
    this._summary.appendChild(this._subGroupTitle('纹理信息'));
    this._summary.appendChild(this._kvGridBlock({
      hasTexture: String(!!payload.texture),
      id: payload.texture?.id || '-',
      size: payload.texture ? `${payload.texture.width} x ${payload.texture.height}` : '-',
      type: payload.texture ? (payload.texture.isVideoTexture ? 'VideoTexture' : 'Texture') : '-',
    }, 2));
    this._showSections(false, true, false, false);
    this._texturePreview.render(payload.texture);
  }

  private _renderMesh(payload: MeshPayload): void {
    this._summary.appendChild(this._title(payload.title));
    this._summary.appendChild(this._subGroupTitle('网格信息'));
    this._summary.appendChild(this._kvGridBlock({
      hasMesh: String(!!payload.mesh),
      meshId: payload.mesh?.id || '-',
      vertexCount: payload.mesh ? String(payload.mesh.vertexCount) : '-',
      indexCount: payload.mesh ? String(payload.mesh.indexCount) : '-',
      hasPuppetMesh: String(!!payload.puppetMesh),
    }, 2));
    this._showSections(false, false, true, false);
    this._meshPreview.render(payload.mesh, (payload.puppetMesh ?? undefined) as any);
  }

  private _renderEffect(payload: EffectPayload): void {
    this._summary.appendChild(this._title(payload.title));
    this._summary.appendChild(this._subGroupTitle('统计'));
    this._summary.appendChild(this._kvGridBlock({
      passCount: String(payload.passes.length),
      fboCount: String(payload.fbos.length),
    }, 2));
    if (payload.fbos.length > 0) {
      const fboRows: Record<string, string> = {};
      payload.fbos.forEach((fbo, index) => {
        const item = fbo as { name?: unknown; scale?: unknown };
        const name = typeof item?.name === 'string' ? item.name : `fbo_${index}`;
        const scale = typeof item?.scale === 'number' ? item.scale : '-';
        fboRows[`[${index}] ${name}`] = `scale=${scale}`;
      });
      this._summary.appendChild(this._groupTitle('FBO 定义'));
      this._summary.appendChild(this._kvGridBlock(fboRows));
    }
    this._showSections(false, false, false, true);
    const effectRuntime = this._asEffectDebugRuntimeLayer(payload.runtimeLayer);
    const models = this._buildEffectPassViewModels(payload.passes, effectRuntime);
    this._effectView.render(models, {
      onTogglePass: effectRuntime ? (passIndex, enabled) => this._togglePass(effectRuntime, passIndex, enabled) : undefined,
    });
  }

  private _renderEffectPass(payload: EffectPassPayload): void {
    const effectRuntime = this._asEffectDebugRuntimeLayer(payload.runtimeLayer);
    const models = this._buildEffectPassViewModels([payload.pass], effectRuntime, payload.passIndex);
    const model = models[0] ?? null;
    this._summary.appendChild(this._title(`Pass ${payload.passIndex}`));
    if (model) {
      this._summary.appendChild(this._subGroupTitle('Pass 输出预览'));
      this._summary.appendChild(this._renderEffectPassPreview(model, effectRuntime));
    }
    this._summary.appendChild(this._subGroupTitle('Pass 参数'));
    this._summary.appendChild(this._subGroupTitle('命令与目标'));
    this._summary.appendChild(this._kvGridBlock({
      command: payload.pass.command || 'render',
      target: payload.pass.target || '-',
      effectName: payload.pass.effectName || '-',
    }, 3));
    this._summary.appendChild(this._subGroupTitle('效果标识'));
    this._summary.appendChild(this._kvGridBlock({
      builtinEffect: payload.pass.builtinEffect || '-',
      debugLabel: payload.pass.debugLabel || '-',
    }, 2));
    this._summary.appendChild(this._subGroupTitle('渲染状态'));
    this._summary.appendChild(this._kvGridBlock({
      depthTest: String(payload.pass.depthTest ?? false),
      depthWrite: String(payload.pass.depthWrite ?? false),
      cullMode: payload.pass.cullMode || '-',
    }, 3));
    this._summary.appendChild(this._subGroupTitle('Shader 概况'));
    this._summary.appendChild(this._kvGridBlock({
      vertexShaderLen: String(payload.pass.vertexShader?.length ?? 0),
      fragmentShaderLen: String(payload.pass.fragmentShader?.length ?? 0),
    }, 2));
    if (payload.pass.builtinParams) {
      this._summary.appendChild(this._jsonBlock('builtinParams', payload.pass.builtinParams));
    }
    this._summary.appendChild(this._groupTitle('binds(slot -> source)'));
    this._summary.appendChild(this._kvGridBlock(this._normalizeStringRecord(payload.pass.binds)));
    this._summary.appendChild(this._groupTitle('uniforms'));
    this._summary.appendChild(this._kvGridBlock(this._toKvRecord(payload.pass.uniforms ?? null)));
    this._showSections(false, false, false, false);
  }

  private _renderProperties(payload: PropertiesPayload): void {
    this._summary.appendChild(this._title(payload.title));
    if (this._isLayerInspectorData(payload.data)) {
      const data = payload.data;
      const dataScale = {
        x: data.scale?.x ?? 1,
        y: data.scale?.y ?? 1,
      };
      const dataAnchor = {
        x: data.anchor?.x ?? 0.5,
        y: data.anchor?.y ?? 0.5,
      };
      this._summary.appendChild(this._groupTitle('基本信息'));
      this._summary.appendChild(this._kvGridBlock({
        kind: data.kind,
        id: data.id,
        name: data.name,
      }, 3));

      this._summary.appendChild(this._groupTitle('尺寸'));
      this._summary.appendChild(this._kvGridBlock({
        width: String(data.width),
        height: String(data.height),
      }, 2));

      this._summary.appendChild(this._groupTitle('变换'));
      this._summary.appendChild(this._kvCompactGridBlock({
        位置: this._formatVecValue([data.x, data.y]),
        缩放: this._formatVecValue([dataScale.x, dataScale.y]),
        旋转: this._formatNumber(data.rotation),
        锚点: this._formatVecValue([dataAnchor.x, dataAnchor.y]),
      }, 3));

      this._summary.appendChild(this._groupTitle('显示'));
      this._summary.appendChild(this._kvCompactGridBlock({
        visible: String(data.visible),
        opacity: this._formatNumber(data.opacity),
        zIndex: String(data.zIndex),
        视差深度: this._formatVecValue([data.parallaxDepth[0], data.parallaxDepth[1]]),
        fullscreen: String(data.fullscreen),
        renderPhase: String(data.renderPhase),
      }, 3));

      this._summary.appendChild(this._groupTitle('纹理'));
      this._summary.appendChild(this._kvGridBlock({
        hasTexture: String(data.hasTexture),
        textureId: data.textureId ?? '-',
        textureSize: data.textureSize ? `${data.textureSize.width} x ${data.textureSize.height}` : '-',
      }, 3));

      this._summary.appendChild(this._groupTitle('网格'));
      this._summary.appendChild(this._kvGridBlock({
        hasMesh: String(data.hasMesh),
        meshId: data.meshId ?? '-',
        vertexCount: String(data.vertexCount ?? 0),
        indexCount: String(data.indexCount ?? 0),
      }, 2));

      this._summary.appendChild(this._groupTitle('Puppet'));
      this._summary.appendChild(this._kvGridBlock({
        hasPuppetMesh: String(data.hasPuppetMesh),
        puppetVertexCount: String(data.puppetMeshInfo?.vertexCount ?? 0),
        puppetTriangleCount: String(data.puppetMeshInfo?.triangleCount ?? 0),
      }, 3));

      if (data.extra && typeof data.extra === 'object') {
        this._summary.appendChild(this._groupTitle('类型属性'));
        const extraKv = this._toKvRecord(data.extra);
        const extraColumns = Math.max(1, Math.min(3, Object.keys(extraKv).length));
        this._summary.appendChild(this._kvGridBlock(extraKv, extraColumns));
      }
    } else {
      const kv = this._toKvRecord(payload.data);
      if (Object.keys(kv).length > 0) {
        const columns = Math.max(1, Math.min(3, Object.keys(kv).length));
        this._summary.appendChild(this._kvGridBlock(kv, columns));
      }
    }
    this._summary.appendChild(this._jsonBlock(payload.title, payload.data));
    this._resetPreviews();
  }

  private _renderJson(payload: JsonPayload): void {
    this._summary.appendChild(this._title(payload.title));
    this._summary.appendChild(this._jsonBlock(payload.title, payload.data));
    this._resetPreviews();
  }

  private _asEffectDebugRuntimeLayer(layer: Layer | null | undefined): (Layer & EffectDebugRuntimeLayer) | null {
    if (!layer || layer.kind !== 'image') return null;
    const candidate = layer as Layer & Partial<EffectDebugRuntimeLayer>;
    if (typeof candidate.setEffectPassEnabled !== 'function') return null;
    if (typeof candidate.getInspectorPassDebugFrames !== 'function') return null;
    if (typeof candidate.getInspectorPassDebugPreview !== 'function') return null;
    return candidate as Layer & EffectDebugRuntimeLayer;
  }

  private _buildEffectPassViewModels(
    passes: EffectPassItemPayload[],
    runtimeLayer: (Layer & EffectDebugRuntimeLayer) | null,
    basePassIndex = 0,
  ): EffectPipelinePassViewModel[] {
    const debugFrames = runtimeLayer?.getInspectorPassDebugFrames() ?? [];
    return passes.map((pass, localIndex) => {
      const passIndex = basePassIndex + localIndex;
      const debugFrame = debugFrames[passIndex] ?? null;
      const preview = runtimeLayer?.getInspectorPassDebugPreview(passIndex, 320) ?? null;
      return {
        index: passIndex,
        pass,
        enabled: debugFrame?.enabled ?? (pass.enabled !== false),
        debugFrame,
        preview,
      };
    });
  }

  private _togglePass(runtimeLayer: Layer & EffectDebugRuntimeLayer, passIndex: number, enabled: boolean): void {
    this._onEffectPassToggle?.(runtimeLayer, passIndex, enabled);
  }

  private _renderEffectPassPreview(
    model: EffectPipelinePassViewModel,
    runtimeLayer: (Layer & EffectDebugRuntimeLayer) | null,
  ): HTMLElement {
    const wrap = document.createElement('div');
    if (runtimeLayer) {
      const toggleRow = document.createElement('div');
      toggleRow.className = 'inspector-pass-toggle-row';
      const toggleLabel = document.createElement('span');
      toggleLabel.className = 'inspector-pass-toggle-label';
      toggleLabel.textContent = '启用';
      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'inspector-tree-toggle';
      const enabled = model.enabled !== false;
      toggleButton.textContent = enabled ? 'ON' : 'OFF';
      if (!enabled) toggleButton.classList.add('off');
      toggleButton.addEventListener('click', () => this._togglePass(runtimeLayer, model.index, !enabled));
      toggleRow.appendChild(toggleLabel);
      toggleRow.appendChild(toggleButton);
      wrap.appendChild(toggleRow);
    }

    const preview = model.preview;
    if (!preview || preview.width <= 0 || preview.height <= 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = model.debugFrame?.action === 'swap'
        ? 'Swap pass 仅交换缓冲，不产生独立像素输出'
        : '当前无可用输出（可能本帧未执行或未捕获）';
      wrap.appendChild(empty);
      return wrap;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'inspector-preview-canvas inspector-pass-preview-canvas';
    canvas.width = preview.width;
    canvas.height = preview.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const flipped = this._flipYPixels(preview.pixels, preview.width, preview.height);
      ctx.putImageData(new ImageData(flipped, preview.width, preview.height), 0, 0);
    }
    canvas.addEventListener('click', () => {
      this._lightbox.open({
        source: canvas,
        width: preview.width,
        height: preview.height,
        title: `Pass ${model.index} 输出`,
        backgroundStyle: this._readBackgroundStyle(canvas),
      });
    });
    wrap.appendChild(canvas);

    const meta = document.createElement('div');
    meta.className = 'inspector-meta';
    meta.textContent = `源尺寸: ${preview.sourceWidth}x${preview.sourceHeight} | 预览尺寸: ${preview.width}x${preview.height}`;
    wrap.appendChild(meta);
    return wrap;
  }

  private _flipYPixels(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const rowBytes = width * 4;
    const out = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y += 1) {
      const srcOffset = y * rowBytes;
      const dstOffset = (height - 1 - y) * rowBytes;
      out.set(pixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
    return out;
  }

  private _readBackgroundStyle(canvas: HTMLCanvasElement): {
    color: string;
    image: string;
    size: string;
    position: string;
    repeat: string;
  } {
    const computed = window.getComputedStyle(canvas);
    return {
      color: computed.backgroundColor,
      image: computed.backgroundImage,
      size: computed.backgroundSize,
      position: computed.backgroundPosition,
      repeat: computed.backgroundRepeat,
    };
  }

  private _toKvRecord(data: unknown): Record<string, string> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          out[`${key}.${subKey}`] = this._formatSimpleValue(subValue);
        }
      } else {
        out[key] = this._formatSimpleValue(value);
      }
    }
    return out;
  }

  private _normalizeStringRecord(data: Record<number, string> | Record<string, string> | undefined): Record<string, string> {
    if (!data) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      out[String(key)] = String(value);
    }
    return out;
  }

  private _extractEffectPasses(runtimeData: LayerInspectorData | undefined): EffectPassItemPayload[] {
    const extra = runtimeData?.extra;
    if (!extra || typeof extra !== 'object') return [];
    const passes = (extra as Record<string, unknown>).effectPasses;
    if (!Array.isArray(passes)) return [];
    return passes as EffectPassItemPayload[];
  }

  private _isLayerInspectorData(data: unknown): data is LayerInspectorData {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return typeof obj.id === 'string'
      && typeof obj.kind === 'string'
      && typeof obj.width === 'number'
      && typeof obj.height === 'number'
      && typeof obj.x === 'number'
      && typeof obj.y === 'number'
      && typeof obj.visible === 'boolean'
      && Array.isArray(obj.parallaxDepth);
  }

  private _formatSimpleValue(value: unknown): string {
    if (value == null) return 'null';
    if (typeof value === 'number') return this._formatNumber(value);
    if (this._isTexture(value)) {
      const texture = value as { id: string; width: number; height: number };
      return `[Texture] ${texture.id} (${texture.width}x${texture.height})`;
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      const canInline = value.length <= 8
        && value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
      if (canInline) {
        return `[${value.map((item) => (item == null ? 'null' : String(item))).join(', ')}]`;
      }
      return `Array(${value.length})`;
    }
    if (typeof value === 'object') {
      return 'Object';
    }
    return typeof value;
  }

  private _resetPreviews(): void {
    this._layerRenderPreview.render(null, this._engine);
    this._showSections(false, false, false, false);
  }

  private _showSections(
    layerRenderVisible: boolean,
    textureVisible: boolean,
    meshVisible: boolean,
    effectVisible: boolean,
  ): void {
    this._layerRenderRoot.style.display = layerRenderVisible ? '' : 'none';
    this._textureRoot.style.display = textureVisible ? '' : 'none';
    this._meshRoot.style.display = meshVisible ? '' : 'none';
    this._effectRoot.style.display = effectVisible ? '' : 'none';
  }

  private _title(text: string): HTMLElement {
    const h = document.createElement('h3');
    h.textContent = text;
    return h;
  }

  private _kvBlock(data: Record<string, string>): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'inspector-kv-block';
    Object.entries(data).forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'inspector-kv-row';
      row.innerHTML = `<span>${k}</span><span>${v}</span>`;
      wrap.appendChild(row);
    });
    return wrap;
  }

  private _formatVecValue(components: number[], names = ['x', 'y', 'z', 'w']): string {
    return components
      .map((value, index) => (
        `<span class="inspector-vec-label">${names[index] ?? index}</span>${this._formatNumber(value)}`
      ))
      .join('<span class="inspector-vec-sep">,</span>');
  }

  private _kvGridBlock(data: Record<string, string>, columns = 2): HTMLElement {
    const wrap = this._kvBlock(data);
    wrap.classList.add('inspector-kv-grid');
    wrap.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    const rows = Array.from(wrap.querySelectorAll<HTMLElement>('.inspector-kv-row'));
    const lastRowCount = rows.length === 0 ? 0 : (rows.length % columns || columns);
    const startIndex = rows.length - lastRowCount;
    for (let i = 0; i < rows.length; i += 1) {
      rows[i].classList.toggle('inspector-kv-row-last-line', i >= startIndex);
    }
    return wrap;
  }

  private _kvCompactGridBlock(data: Record<string, string>, columns = 3): HTMLElement {
    const wrap = this._kvBlock(data);
    wrap.classList.add('inspector-kv-grid', 'inspector-kv-grid-compact');
    wrap.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    return wrap;
  }

  private _isTexture(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.id === 'string'
      && typeof obj.width === 'number'
      && typeof obj.height === 'number'
      && typeof obj.getNativeTexture === 'function';
  }

  private _formatNumber(value: number, maxFractionDigits = 4): string {
    if (!Number.isFinite(value)) return String(value);
    const fixed = value.toFixed(maxFractionDigits);
    return fixed.replace(/\.?0+$/, '');
  }

  private _groupTitle(text: string): HTMLElement {
    const h = document.createElement('h4');
    h.className = 'inspector-group-title';
    h.textContent = text;
    return h;
  }

  private _subGroupTitle(text: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'inspector-subgroup-title';
    div.textContent = text;
    return div;
  }

  private _jsonBlock(title: string, obj: unknown): HTMLElement {
    const wrap = document.createElement('details');
    wrap.className = 'inspector-json-wrap';
    const summary = document.createElement('summary');
    summary.textContent = title;
    wrap.appendChild(summary);
    const pre = document.createElement('pre');
    pre.textContent = '(展开后加载)';
    let loaded = false;
    const loadJson = (): void => {
      if (loaded) return;
      loaded = true;
      pre.textContent = this._safeStringify(obj);
    };
    wrap.addEventListener('toggle', () => {
      if (wrap.open) loadJson();
    });
    wrap.appendChild(pre);
    return wrap;
  }

  private _safeStringify(obj: unknown): string {
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(
        obj ?? null,
        (_key, value) => {
          if (typeof value === 'function') return '[Function]';
          if (typeof value === 'bigint') return String(value);
          if (value && typeof value === 'object') {
            if (seen.has(value as object)) return '[Circular]';
            seen.add(value as object);
          }
          return value;
        },
        2,
      );
    } catch (error) {
      return `序列化失败: ${(error as Error).message}`;
    }
  }

  private _selectionKey(payload: InspectorSelectionPayload | null): string | null {
    if (!payload) return null;
    switch (payload.kind) {
      case 'layer':
        return `layer:${payload.descriptorLayer.id}`;
      case 'texture':
      case 'mesh':
      case 'effect':
      case 'properties':
      case 'json':
        return `${payload.kind}:${payload.title}`;
      case 'effectPass':
        return `effectPass:${payload.passIndex}`;
      case 'scene':
      case 'sceneConfig':
        return payload.kind;
    }
  }
}
