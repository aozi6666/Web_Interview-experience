import type { EffectPassDebugFrame, EffectPassDebugPreview } from 'moyu-engine/components/effects/EffectPipeline';
import type { PreviewClickPayload } from './TexturePreview';

interface EffectPassItem {
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

export interface EffectPipelinePassViewModel {
  index: number;
  pass: EffectPassItem;
  enabled: boolean;
  debugFrame?: EffectPassDebugFrame | null;
  preview?: EffectPassDebugPreview | null;
}

interface EffectPipelineRenderOptions {
  title?: string;
  showFlow?: boolean;
  onTogglePass?: (passIndex: number, enabled: boolean) => void;
}

export class EffectPipelineView {
  private readonly _root: HTMLElement;
  private readonly _onPreviewClick: ((payload: PreviewClickPayload) => void) | null;

  constructor(root: HTMLElement, onPreviewClick?: (payload: PreviewClickPayload) => void) {
    this._root = root;
    this._root.className = 'inspector-section';
    this._onPreviewClick = onPreviewClick ?? null;
  }

  render(passModels: EffectPipelinePassViewModel[] | null | undefined, options?: EffectPipelineRenderOptions): void {
    this._root.innerHTML = '';
    const title = document.createElement('h4');
    title.textContent = options?.title ?? '效果管线';
    this._root.appendChild(title);

    if (!passModels || passModels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = '无 Effect Pass';
      this._root.appendChild(empty);
      return;
    }

    if (options?.showFlow !== false) {
      this._root.appendChild(this._renderFlow(passModels));
    }

    passModels.forEach((model) => {
      const { index, pass } = model;
      const card = document.createElement('details');
      card.className = 'inspector-pass-card';
      const summary = document.createElement('summary');
      summary.textContent = `Pass ${index} · ${this._passTitle(pass)}`;
      card.appendChild(summary);
      if (options?.onTogglePass) {
        const toggleWrap = document.createElement('div');
        toggleWrap.className = 'inspector-pass-toggle-row';
        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'inspector-pass-toggle-label';
        toggleLabel.textContent = '启用';
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'inspector-tree-toggle';
        const enabled = model.enabled !== false;
        toggleButton.textContent = enabled ? 'ON' : 'OFF';
        if (!enabled) toggleButton.classList.add('off');
        toggleButton.addEventListener('click', () => options.onTogglePass?.(index, !enabled));
        toggleWrap.appendChild(toggleLabel);
        toggleWrap.appendChild(toggleButton);
        card.appendChild(toggleWrap);
      }
      card.appendChild(this._subGroupTitle('Pass 输出'));
      card.appendChild(this._previewBlock(model));
      card.appendChild(this._subGroupTitle('Pass 参数'));
      card.appendChild(this._kvTable({
        command: pass.command || 'render',
        'target(write)': pass.target || 'Output',
        effectName: pass.effectName || '-',
        builtinEffect: pass.builtinEffect || '-',
        debugLabel: pass.debugLabel || '-',
        depthTest: String(pass.depthTest ?? false),
        depthWrite: String(pass.depthWrite ?? false),
        cullMode: pass.cullMode || '-',
        vertexShaderLen: String(pass.vertexShader?.length ?? 0),
        fragmentShaderLen: String(pass.fragmentShader?.length ?? 0),
        enabled: String(model.enabled !== false),
        runtimeAction: model.debugFrame?.action ?? '-',
        runtimeTarget: this._formatRuntimeTarget(model.debugFrame),
      }));
      if (pass.builtinParams) {
        card.appendChild(this._json('builtinParams', pass.builtinParams));
      }
      card.appendChild(this._recordRows('binds(slot -> source)', this._normalizeRecord(pass.binds)));
      card.appendChild(this._recordRows('uniforms', this._normalizeUniforms(pass.uniforms)));
      this._root.appendChild(card);
    });
  }

  private _renderFlow(passModels: EffectPipelinePassViewModel[]): HTMLElement {
    const flow = document.createElement('div');
    flow.className = 'inspector-flow';

    const source = document.createElement('span');
    source.className = 'inspector-flow-node';
    source.textContent = 'BaseTexture';
    flow.appendChild(source);

    passModels.forEach(({ pass, index, enabled }) => {
      const arrow = document.createElement('span');
      arrow.className = 'inspector-flow-arrow';
      arrow.textContent = '→';
      flow.appendChild(arrow);

      const step = document.createElement('div');
      step.className = 'inspector-flow-step';

      const node = document.createElement('span');
      node.className = 'inspector-flow-node';
      node.textContent = `Pass ${index}: ${this._passTitle(pass)}${enabled ? '' : ' (OFF)'}`;
      step.appendChild(node);

      const io = document.createElement('div');
      io.className = 'inspector-flow-io';
      const readBindings = this._normalizeRecord(pass.binds);
      const reads = Object.values(readBindings);
      const readText = reads.length > 0 ? reads.join(', ') : 'BaseTexture';
      const writeText = pass.target || 'Output';
      io.textContent = `read: ${readText} | write: ${writeText}`;
      step.appendChild(io);

      flow.appendChild(step);

      if (pass.target) {
        const arrowToTarget = document.createElement('span');
        arrowToTarget.className = 'inspector-flow-arrow';
        arrowToTarget.textContent = '→';
        flow.appendChild(arrowToTarget);

        const target = document.createElement('span');
        target.className = 'inspector-flow-node inspector-flow-target';
        target.textContent = pass.target;
        flow.appendChild(target);
      }
    });

    return flow;
  }

  private _recordRows(title: string, data: Record<string, string>): HTMLElement {
    const wrap = document.createElement('details');
    wrap.className = 'inspector-json-wrap';
    wrap.open = true;
    const summary = document.createElement('summary');
    summary.textContent = title;
    wrap.appendChild(summary);

    if (Object.keys(data).length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = '无';
      wrap.appendChild(empty);
      return wrap;
    }

    wrap.appendChild(this._kvTable(data));
    return wrap;
  }

  private _normalizeRecord(input: Record<number, string> | Record<string, string> | undefined): Record<string, string> {
    if (!input) return {};
    const out: Record<string, string> = {};
    Object.entries(input).forEach(([key, value]) => {
      out[String(key)] = String(value);
    });
    return out;
  }

  private _normalizeUniforms(uniforms: Record<string, unknown> | undefined): Record<string, string> {
    if (!uniforms) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(uniforms)) {
      out[key] = this._formatUniformValue(value);
    }
    return out;
  }

  private _formatUniformValue(value: unknown): string {
    if (value == null) return 'null';
    if (this._isTexture(value)) {
      const texture = value as { id: string; width: number; height: number };
      return `[Texture] ${texture.id} (${texture.width}x${texture.height})`;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      const limited = value.slice(0, 8).map((v) => (v == null ? 'null' : String(v))).join(', ');
      return value.length > 8 ? `[${limited}, ...]` : `[${limited}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private _isTexture(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.id === 'string'
      && typeof obj.width === 'number'
      && typeof obj.height === 'number'
      && typeof obj.getNativeTexture === 'function';
  }

  private _passTitle(pass: EffectPassItem): string {
    return pass.debugLabel || pass.effectName || pass.builtinEffect || pass.command || 'render';
  }

  private _previewBlock(model: EffectPipelinePassViewModel): HTMLElement {
    const wrap = document.createElement('div');
    const preview = model.preview;
    if (!preview || preview.width <= 0 || preview.height <= 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      const reason = model.debugFrame?.action === 'swap'
        ? 'Swap pass 仅交换缓冲，不产生独立像素输出'
        : '当前无可用输出（可能本帧未执行或未捕获）';
      empty.textContent = reason;
      wrap.appendChild(empty);
      return wrap;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'inspector-preview-canvas inspector-pass-preview-canvas';
    canvas.width = preview.width;
    canvas.height = preview.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const flipped = this._flipY(preview.pixels, preview.width, preview.height);
      const imageData = new ImageData(new Uint8ClampedArray(flipped), preview.width, preview.height);
      ctx.putImageData(imageData, 0, 0);
    }
    if (this._onPreviewClick) {
      canvas.addEventListener('click', () => {
        this._onPreviewClick?.({
          source: canvas,
          width: preview.width,
          height: preview.height,
          title: `Pass ${model.index} 输出`,
          backgroundStyle: this._readBackgroundStyle(canvas),
        });
      });
    }
    const meta = document.createElement('div');
    meta.className = 'inspector-meta';
    const source = `${preview.sourceWidth}x${preview.sourceHeight}`;
    const shown = `${preview.width}x${preview.height}`;
    meta.textContent = `源尺寸: ${source} | 预览尺寸: ${shown}`;
    wrap.appendChild(canvas);
    wrap.appendChild(meta);
    return wrap;
  }

  private _flipY(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const rowBytes = width * 4;
    const out = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y += 1) {
      const srcOffset = y * rowBytes;
      const dstOffset = (height - 1 - y) * rowBytes;
      out.set(pixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
    return out;
  }

  private _formatRuntimeTarget(frame?: EffectPassDebugFrame | null): string {
    if (!frame) return '-';
    if (frame.targetKind === 'none') return '-';
    if (frame.targetKind === 'namedFbo') return frame.targetName || 'namedFbo';
    return 'pingPong';
  }

  private _kv(key: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'inspector-kv-row';
    row.innerHTML = `<span>${key}</span><span>${value}</span>`;
    return row;
  }

  private _kvTable(data: Record<string, string>): HTMLElement {
    const block = document.createElement('div');
    block.className = 'inspector-kv-block';
    Object.entries(data).forEach(([key, value]) => block.appendChild(this._kv(key, value)));
    return block;
  }

  private _subGroupTitle(text: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'inspector-subgroup-title';
    div.textContent = text;
    return div;
  }

  private _json(title: string, data: unknown): HTMLElement {
    const wrap = document.createElement('details');
    wrap.className = 'inspector-json-wrap';
    const s = document.createElement('summary');
    s.textContent = title;
    wrap.appendChild(s);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data ?? null, null, 2);
    wrap.appendChild(pre);
    return wrap;
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
}
