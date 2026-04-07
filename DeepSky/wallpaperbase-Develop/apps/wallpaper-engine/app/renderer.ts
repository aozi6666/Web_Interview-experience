/**
 * Wallpaper Engine Renderer - 主渲染器
 */

import { Engine, createEngine } from 'moyu-engine';
import { EngineDefaults } from 'moyu-engine/scenario/EngineDefaults';
import { createThreeBackend } from 'moyu-engine/rendering/threejs';
import { createImageLayer, ImageLayer, ParticleLayer } from 'moyu-engine/scenario/layers';
import { CharacterLayer, createCharacterLayer, type CharacterDef } from 'moyu-engine/avatar/puppet/character';
import { WEScene } from 'formats/we';
import { loadWEEffectShaders } from 'formats/we/shader';
import { DataModelInspector } from './inspector/Inspector';
import { LayerRenderPreview } from './inspector/LayerRenderPreview';

// ==================== 应用状态 ====================

interface AppState {
  engine: Engine | null;
  scene: WEScene | null;
  inspector: DataModelInspector | null;
  currentPath: string | null;
  irisLayers: ImageLayer[];
  mouseTrailLayers: ParticleLayer[];
  characterPartTimer: number | null;
  demoCharacterLayer: CharacterLayer | null;
}

const state: AppState = {
  engine: null,
  scene: null,
  inspector: null,
  currentPath: null,
  irisLayers: [],
  mouseTrailLayers: [],
  characterPartTimer: null,
  demoCharacterLayer: null,
};

interface CharacterPanelElements {
  root: HTMLElement;
  autoBlink: HTMLInputElement;
  mouthOpen: HTMLInputElement;
  mouthPart: HTMLSelectElement;
  eyeL: HTMLInputElement;
  eyeR: HTMLInputElement;
  angleX: HTMLInputElement;
  angleY: HTMLInputElement;
  angleZ: HTMLInputElement;
  playTalk: HTMLButtonElement;
  stopTalk: HTMLButtonElement;
  reset: HTMLButtonElement;
}

let characterPanel: CharacterPanelElements | null = null;
const GPU_TUNING_SETTINGS_KEY = 'we.gpuTuningSettings.v1';
const TEXT_SAFE_MAX_DPR = 2.0;

type PowerPreferenceOption = 'default' | 'low-power' | 'high-performance';
type QualityPreset = 'ultra' | 'high' | 'medium' | 'low' | 'custom';

const QUALITY_PRESETS: Record<Exclude<QualityPreset, 'custom'>, Partial<GpuTuningSettings>> = {
  ultra: {
    targetFps: 60,
    maxDpr: 2.0,
    sceneCaptureScale: 1.0,
    effectQuality: 1.0,
    autoEffectQuality: false,
    bloomEnabled: true,
    particleDensityScale: 1.0,
  },
  high: {
    targetFps: 30,
    maxDpr: 2.0,
    sceneCaptureScale: 1.0,
    effectQuality: 1.0,
    autoEffectQuality: false,
    bloomEnabled: true,
    particleDensityScale: 1.0,
  },
  medium: {
    targetFps: 30,
    maxDpr: 1.5,
    sceneCaptureScale: 0.75,
    effectQuality: 0.75,
    autoEffectQuality: false,
    bloomEnabled: true,
    particleDensityScale: 1.0,
  },
  low: {
    targetFps: 30,
    maxDpr: 1.0,
    sceneCaptureScale: 0.5,
    effectQuality: 0.5,
    autoEffectQuality: false,
    bloomEnabled: false,
    particleDensityScale: 0.5,
  },
};

function detectCurrentPreset(settings: GpuTuningSettings): QualityPreset {
  for (const [name, preset] of Object.entries(QUALITY_PRESETS) as Array<[Exclude<QualityPreset, 'custom'>, Partial<GpuTuningSettings>]>) {
    const match = Object.entries(preset).every(([key, value]) => {
      const current = settings[key as keyof GpuTuningSettings];
      if (typeof value === 'number') return Math.abs((current as number) - value) < 0.01;
      return current === value;
    });
    if (match) return name;
  }
  return 'custom';
}

interface GpuTuningSettings {
  visibilityThrottle: boolean;
  inspectorPreview: boolean;
  browserBlur: boolean;
  targetFps: number;
  maxDpr: number;
  sceneCaptureScale: number;
  powerPreference: PowerPreferenceOption;
  effectQuality: number;
  autoEffectQuality: boolean;
  bloomEnabled: boolean;
  particleDensityScale: number;
}

const DEFAULT_GPU_TUNING_SETTINGS: GpuTuningSettings = {
  visibilityThrottle: true,
  inspectorPreview: true,
  browserBlur: false,
  targetFps: 30,
  maxDpr: 2.0,
  sceneCaptureScale: 1.0,
  powerPreference: 'default',
  effectQuality: 1.0,
  autoEffectQuality: true,
  bloomEnabled: true,
  particleDensityScale: 1.0,
};

function clampTargetFps(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GPU_TUNING_SETTINGS.targetFps;
  const stepped = Math.round(value / 5) * 5;
  return Math.min(60, Math.max(15, stepped));
}

function clampMaxDpr(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GPU_TUNING_SETTINGS.maxDpr;
  return Math.round(Math.min(2, Math.max(0.5, value)) * 10) / 10;
}

function clampSceneCaptureScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GPU_TUNING_SETTINGS.sceneCaptureScale;
  return Math.round(Math.min(1, Math.max(0.25, value)) * 100) / 100;
}

function clampEffectQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GPU_TUNING_SETTINGS.effectQuality;
  return Math.round(Math.min(1, Math.max(0.25, value)) * 100) / 100;
}

function clampParticleDensityScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GPU_TUNING_SETTINGS.particleDensityScale;
  return Math.round(Math.min(1, Math.max(0.1, value)) * 10) / 10;
}

function loadGpuTuningSettings(): GpuTuningSettings {
  try {
    const raw = window.localStorage.getItem(GPU_TUNING_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GPU_TUNING_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GpuTuningSettings>;
    return {
      visibilityThrottle: parsed.visibilityThrottle ?? DEFAULT_GPU_TUNING_SETTINGS.visibilityThrottle,
      inspectorPreview: parsed.inspectorPreview ?? DEFAULT_GPU_TUNING_SETTINGS.inspectorPreview,
      browserBlur: parsed.browserBlur ?? DEFAULT_GPU_TUNING_SETTINGS.browserBlur,
      targetFps: clampTargetFps(parsed.targetFps ?? DEFAULT_GPU_TUNING_SETTINGS.targetFps),
      maxDpr: clampMaxDpr(parsed.maxDpr ?? DEFAULT_GPU_TUNING_SETTINGS.maxDpr),
      sceneCaptureScale: clampSceneCaptureScale(parsed.sceneCaptureScale ?? DEFAULT_GPU_TUNING_SETTINGS.sceneCaptureScale),
      powerPreference: (parsed.powerPreference ?? DEFAULT_GPU_TUNING_SETTINGS.powerPreference) as PowerPreferenceOption,
      effectQuality: clampEffectQuality(parsed.effectQuality ?? DEFAULT_GPU_TUNING_SETTINGS.effectQuality),
      autoEffectQuality: parsed.autoEffectQuality ?? DEFAULT_GPU_TUNING_SETTINGS.autoEffectQuality,
      bloomEnabled: parsed.bloomEnabled ?? DEFAULT_GPU_TUNING_SETTINGS.bloomEnabled,
      particleDensityScale: clampParticleDensityScale(parsed.particleDensityScale ?? DEFAULT_GPU_TUNING_SETTINGS.particleDensityScale),
    };
  } catch {
    return { ...DEFAULT_GPU_TUNING_SETTINGS };
  }
}

let gpuTuningSettings: GpuTuningSettings = loadGpuTuningSettings();
const GPU_OCCUPANCY_WINDOW_MS = 1000;
const gpuOccupancySamples: Array<{ ts: number; renderMs: number; frameBudgetMs: number }> = [];

function getFrameBudgetMs(): number {
  return 1000 / Math.max(1, gpuTuningSettings.targetFps);
}

function estimateGpuPercent1s(renderMs: number, frameBudgetMs: number): number {
  const now = performance.now();
  const windowStart = now - GPU_OCCUPANCY_WINDOW_MS;
  gpuOccupancySamples.push({ ts: now, renderMs, frameBudgetMs });
  while (gpuOccupancySamples.length > 0 && gpuOccupancySamples[0].ts < windowStart - GPU_OCCUPANCY_WINDOW_MS) {
    gpuOccupancySamples.shift();
  }
  if (gpuOccupancySamples.length === 1) {
    return Math.max(0, Math.min(999, (renderMs / frameBudgetMs) * 100));
  }

  let weightedGpuPercent = 0;
  let weightedDurationMs = 0;
  for (let i = 0; i < gpuOccupancySamples.length; i += 1) {
    const current = gpuOccupancySamples[i];
    const nextTs = i + 1 < gpuOccupancySamples.length ? gpuOccupancySamples[i + 1].ts : now;
    const start = Math.max(windowStart, current.ts);
    const end = Math.min(now, nextTs);
    const durationMs = Math.max(0, end - start);
    if (durationMs <= 0) continue;
    const samplePercent = (current.renderMs / Math.max(1e-6, current.frameBudgetMs)) * 100;
    weightedGpuPercent += samplePercent * durationMs;
    weightedDurationMs += durationMs;
  }
  if (weightedDurationMs <= 0) {
    return Math.max(0, Math.min(999, (renderMs / frameBudgetMs) * 100));
  }
  return Math.max(0, Math.min(999, weightedGpuPercent / weightedDurationMs));
}

function saveGpuTuningSettings(): void {
  try {
    window.localStorage.setItem(GPU_TUNING_SETTINGS_KEY, JSON.stringify(gpuTuningSettings));
  } catch {
    // 忽略本地存储不可用场景
  }
}

// ==================== 工具函数 ====================

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

function updateInfo(text: string): void {
  const infoEl = document.getElementById('info');
  if (infoEl) infoEl.textContent = text;
}

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function getGpuTunableBackend(): {
  setMaxDpr?: (value: number) => void;
  getMaxDpr?: () => number;
  setSceneCaptureScale?: (value: number) => void;
  getSceneCaptureScale?: () => number;
} | null {
  if (!state.engine) return null;
  return state.engine.backend as unknown as {
    setMaxDpr?: (value: number) => void;
    getMaxDpr?: () => number;
    setSceneCaptureScale?: (value: number) => void;
    getSceneCaptureScale?: () => number;
  };
}

function applyBrowserBlurStyle(enabled: boolean): void {
  const browser = document.getElementById('wallpaper-browser');
  if (!browser) return;
  browser.style.backdropFilter = enabled ? 'blur(6px)' : 'none';
  (browser.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = enabled ? 'blur(6px)' : 'none';
}

function applyGpuTuningSettings(): void {
  const imageDprScale = Math.max(0.25, Math.min(1, gpuTuningSettings.maxDpr / TEXT_SAFE_MAX_DPR));
  const cappedEffectQuality = clampEffectQuality(gpuTuningSettings.effectQuality * imageDprScale);
  ParticleLayer.setGlobalDensityScale(gpuTuningSettings.particleDensityScale);
  if (state.engine) {
    state.engine.setVisibilityThrottleEnabled(gpuTuningSettings.visibilityThrottle);
    state.engine.setTargetFps(gpuTuningSettings.targetFps);
    state.engine.setBloomOverride(gpuTuningSettings.bloomEnabled ? null : false);
  }
  ImageLayer.setGlobalEffectQualityCap(imageDprScale);
  ImageLayer.setAutoEffectQualityEnabled(gpuTuningSettings.autoEffectQuality);
  if (!gpuTuningSettings.autoEffectQuality) {
    ImageLayer.setGlobalEffectQuality(cappedEffectQuality);
  }
  LayerRenderPreview.setPreviewEnabled(gpuTuningSettings.inspectorPreview);
  applyBrowserBlurStyle(gpuTuningSettings.browserBlur);
  const backend = getGpuTunableBackend();
  // Keep text crisp: renderer always uses native DPR cap.
  backend?.setMaxDpr?.(TEXT_SAFE_MAX_DPR);
  // Keep scene capture independent from maxDpr slider to avoid text blur in post-process path.
  backend?.setSceneCaptureScale?.(clampSceneCaptureScale(gpuTuningSettings.sceneCaptureScale));
}

function maybeSwitchPowerPreferenceForVideoWallpaper(): void {
  if (!state.engine) return;
  const hasVideoLayer = state.engine.layers.some((layer) => layer.kind === 'video');
  if (!hasVideoLayer) return;
  if (gpuTuningSettings.powerPreference !== 'low-power') return;
  gpuTuningSettings.powerPreference = 'default';
  saveGpuTuningSettings();
  updateInfo('检测到视频图层，已将 PowerPreference 调整为 default（重载页面后生效）');
}

function updateGpuMetricsPanel(): void {
  const panel = document.getElementById('gpu-metrics');
  if (!panel) return;
  if (!state.engine) {
    panel.textContent = 'GPU 观测: 引擎未初始化';
    return;
  }
  const stats = state.engine.getStats() as {
    fps: number;
    drawCalls: number;
    triangles: number;
    textures: number;
    renderTime: number;
    lastPassRenderTime?: number;
    programs?: number;
    geometries?: number;
  };
  const renderMs = Number.isFinite(stats.renderTime) ? Math.max(0, stats.renderTime) : 0;
  const lastPassMs = Number.isFinite(stats.lastPassRenderTime) ? Math.max(0, stats.lastPassRenderTime as number) : 0;
  const frameBudgetMs = getFrameBudgetMs();
  const gpuPercent = estimateGpuPercent1s(renderMs, frameBudgetMs);
  const programs = stats.programs ?? 0;
  const geometries = stats.geometries ?? 0;
  panel.textContent =
    `GPU占用(1s估算): ${gpuPercent.toFixed(1)}%\n` +
    `FrameRender: ${renderMs.toFixed(2)}ms / ${frameBudgetMs.toFixed(2)}ms\n` +
    `LastPass: ${lastPassMs.toFixed(2)}ms\n` +
    `FPS: ${stats.fps}  DrawCalls: ${stats.drawCalls}\n` +
    `Triangles: ${stats.triangles}\n` +
    `Textures: ${stats.textures}  Programs: ${programs}\n` +
    `Geometries: ${geometries}`;
}

function setupGpuTuningPanel(): void {
  const root = document.getElementById('gpu-tuning-panel');
  if (!root) return;
  const header = root.querySelector<HTMLElement>('.panel-head');
  const toggleText = document.getElementById('gpu-tuning-toggle');
  const visibilityThrottle = document.getElementById('opt-visibility-throttle') as HTMLInputElement | null;
  const inspectorPreview = document.getElementById('opt-inspector-preview') as HTMLInputElement | null;
  const browserBlur = document.getElementById('opt-browser-blur') as HTMLInputElement | null;
  const targetFps = document.getElementById('opt-target-fps') as HTMLInputElement | null;
  const targetFpsValue = document.getElementById('opt-target-fps-value');
  const maxDpr = document.getElementById('opt-max-dpr') as HTMLInputElement | null;
  const maxDprValue = document.getElementById('opt-dpr-value');
  const sceneCaptureScale = document.getElementById('opt-scene-capture-scale') as HTMLInputElement | null;
  const sceneCaptureScaleValue = document.getElementById('opt-scene-capture-scale-value');
  const autoEffectQuality = document.getElementById('opt-auto-effect-quality') as HTMLInputElement | null;
  const effectQuality = document.getElementById('opt-effect-quality') as HTMLInputElement | null;
  const effectQualityValue = document.getElementById('opt-effect-quality-value');
  const bloomEnabled = document.getElementById('opt-bloom-enabled') as HTMLInputElement | null;
  const particleDensityScale = document.getElementById('opt-particle-density') as HTMLInputElement | null;
  const particleDensityScaleValue = document.getElementById('opt-particle-density-value');
  const powerPreference = document.getElementById('opt-power-preference') as HTMLSelectElement | null;
  const qualityPreset = document.getElementById('opt-quality-preset') as HTMLSelectElement | null;
  const reloadBtn = document.getElementById('opt-reload');
  const resetBtn = document.getElementById('opt-reset');
  if (
    !header || !toggleText || !visibilityThrottle || !inspectorPreview || !browserBlur
    || !targetFps || !targetFpsValue || !maxDpr || !maxDprValue
    || !sceneCaptureScale || !sceneCaptureScaleValue
    || !autoEffectQuality || !effectQuality || !effectQualityValue
    || !bloomEnabled || !particleDensityScale || !particleDensityScaleValue
    || !powerPreference
  ) {
    return;
  }

  const syncInputs = (): void => {
    visibilityThrottle.checked = gpuTuningSettings.visibilityThrottle;
    inspectorPreview.checked = gpuTuningSettings.inspectorPreview;
    browserBlur.checked = gpuTuningSettings.browserBlur;
    targetFps.value = String(gpuTuningSettings.targetFps);
    targetFpsValue.textContent = String(gpuTuningSettings.targetFps);
    maxDpr.value = gpuTuningSettings.maxDpr.toFixed(1);
    maxDprValue.textContent = gpuTuningSettings.maxDpr.toFixed(1);
    sceneCaptureScale.value = gpuTuningSettings.sceneCaptureScale.toFixed(2);
    sceneCaptureScaleValue.textContent = gpuTuningSettings.sceneCaptureScale.toFixed(2);
    autoEffectQuality.checked = gpuTuningSettings.autoEffectQuality;
    effectQuality.value = gpuTuningSettings.effectQuality.toFixed(2);
    effectQualityValue.textContent = gpuTuningSettings.effectQuality.toFixed(2);
    effectQuality.disabled = gpuTuningSettings.autoEffectQuality;
    bloomEnabled.checked = gpuTuningSettings.bloomEnabled;
    particleDensityScale.value = gpuTuningSettings.particleDensityScale.toFixed(1);
    particleDensityScaleValue.textContent = gpuTuningSettings.particleDensityScale.toFixed(1);
    powerPreference.value = gpuTuningSettings.powerPreference;
    if (qualityPreset) {
      qualityPreset.value = detectCurrentPreset(gpuTuningSettings);
    }
  };

  const persistAndApply = (): void => {
    saveGpuTuningSettings();
    applyGpuTuningSettings();
    if (qualityPreset) {
      qualityPreset.value = detectCurrentPreset(gpuTuningSettings);
    }
  };

  header.addEventListener('click', () => {
    const collapsed = root.classList.toggle('collapsed');
    toggleText.textContent = collapsed ? '展开' : '收起';
  });

  visibilityThrottle.addEventListener('change', () => {
    gpuTuningSettings.visibilityThrottle = visibilityThrottle.checked;
    persistAndApply();
  });
  inspectorPreview.addEventListener('change', () => {
    gpuTuningSettings.inspectorPreview = inspectorPreview.checked;
    persistAndApply();
  });
  browserBlur.addEventListener('change', () => {
    gpuTuningSettings.browserBlur = browserBlur.checked;
    persistAndApply();
  });
  targetFps.addEventListener('input', () => {
    gpuTuningSettings.targetFps = clampTargetFps(Number(targetFps.value));
    targetFpsValue.textContent = String(gpuTuningSettings.targetFps);
    persistAndApply();
  });
  maxDpr.addEventListener('input', () => {
    gpuTuningSettings.maxDpr = clampMaxDpr(Number(maxDpr.value));
    maxDprValue.textContent = gpuTuningSettings.maxDpr.toFixed(1);
    persistAndApply();
  });
  sceneCaptureScale.addEventListener('input', () => {
    gpuTuningSettings.sceneCaptureScale = clampSceneCaptureScale(Number(sceneCaptureScale.value));
    sceneCaptureScaleValue.textContent = gpuTuningSettings.sceneCaptureScale.toFixed(2);
    persistAndApply();
  });
  autoEffectQuality.addEventListener('change', () => {
    gpuTuningSettings.autoEffectQuality = autoEffectQuality.checked;
    effectQuality.disabled = gpuTuningSettings.autoEffectQuality;
    persistAndApply();
  });
  effectQuality.addEventListener('input', () => {
    gpuTuningSettings.effectQuality = clampEffectQuality(Number(effectQuality.value));
    effectQualityValue.textContent = gpuTuningSettings.effectQuality.toFixed(2);
    if (!gpuTuningSettings.autoEffectQuality) {
      persistAndApply();
    } else {
      saveGpuTuningSettings();
    }
  });
  bloomEnabled.addEventListener('change', () => {
    gpuTuningSettings.bloomEnabled = bloomEnabled.checked;
    persistAndApply();
  });
  particleDensityScale.addEventListener('input', () => {
    gpuTuningSettings.particleDensityScale = clampParticleDensityScale(Number(particleDensityScale.value));
    particleDensityScaleValue.textContent = gpuTuningSettings.particleDensityScale.toFixed(1);
    persistAndApply();
  });
  particleDensityScale.addEventListener('change', () => {
    updateInfo('粒子密度缩放对新建粒子图层生效，已加载壁纸建议重载后观察差异');
  });
  powerPreference.addEventListener('change', () => {
    gpuTuningSettings.powerPreference = powerPreference.value as PowerPreferenceOption;
    saveGpuTuningSettings();
    updateInfo(`PowerPreference 已设为 ${gpuTuningSettings.powerPreference}，重载页面后生效`);
  });
  qualityPreset?.addEventListener('change', () => {
    const presetName = qualityPreset.value as QualityPreset;
    if (presetName === 'custom') return;
    const preset = QUALITY_PRESETS[presetName];
    if (!preset) return;
    Object.assign(gpuTuningSettings, preset);
    syncInputs();
    persistAndApply();
    const labels: Record<string, string> = { ultra: '极致画质', high: '高画质', medium: '均衡', low: '省电' };
    updateInfo(`已切换到「${labels[presetName]}」质量档位`);
  });
  reloadBtn?.addEventListener('click', () => window.location.reload());
  resetBtn?.addEventListener('click', () => {
    gpuTuningSettings = { ...DEFAULT_GPU_TUNING_SETTINGS };
    syncInputs();
    persistAndApply();
    updateInfo('已恢复 GPU 优化默认配置');
  });

  syncInputs();
  applyGpuTuningSettings();
}

function refreshInspector(): void {
  const inspector = state.inspector;
  if (!inspector || !inspector.isVisible) return;
  const t0 = performance.now();
  inspector.refresh(state.scene, state.engine);
  const refreshMs = performance.now() - t0;
  const activePath = state.currentPath ?? state.scene?.wallpaperPath ?? '';
  if (activePath.includes('/wallpapers/3581882134')) {
    console.log(`[LoadProfile] refreshInspector=${refreshMs.toFixed(1)}ms path=${activePath}`);
  }
}

function ensureInspector(): DataModelInspector | null {
  if (state.inspector) return state.inspector;
  const inspectorRoot = document.getElementById('data-inspector-root') as HTMLDivElement | null;
  if (!inspectorRoot) return null;
  state.inspector = new DataModelInspector(inspectorRoot);
  state.inspector.setExportHandler(exportWallpaperData);
  state.inspector.refresh(state.scene, state.engine);
  return state.inspector;
}

function handleInspectorToggle(): void {
  try {
    const inspector = ensureInspector();
    if (!inspector) {
      updateInfo('数据查看器初始化失败：找不到 Inspector 容器元素');
      return;
    }
    inspector.toggle();
    if (inspector.isVisible) {
      refreshInspector();
    }
    updateInfo('已切换数据查看器');
  } catch (error) {
    console.error('数据查看器切换失败:', error);
    updateInfo(`数据查看器异常: ${(error as Error).message}`);
  }
}

function getCharacterPanel(): CharacterPanelElements {
  if (characterPanel) return characterPanel;

  characterPanel = {
    root: document.getElementById('character-debug-panel') as HTMLElement,
    autoBlink: document.getElementById('char-auto-blink') as HTMLInputElement,
    mouthOpen: document.getElementById('char-mouth-open') as HTMLInputElement,
    mouthPart: document.getElementById('char-mouth-part') as HTMLSelectElement,
    eyeL: document.getElementById('char-eye-l') as HTMLInputElement,
    eyeR: document.getElementById('char-eye-r') as HTMLInputElement,
    angleX: document.getElementById('char-angle-x') as HTMLInputElement,
    angleY: document.getElementById('char-angle-y') as HTMLInputElement,
    angleZ: document.getElementById('char-angle-z') as HTMLInputElement,
    playTalk: document.getElementById('char-play-talk') as HTMLButtonElement,
    stopTalk: document.getElementById('char-stop-talk') as HTMLButtonElement,
    reset: document.getElementById('char-reset') as HTMLButtonElement,
  };

  return characterPanel;
}

function setCharacterPanelVisible(visible: boolean): void {
  const panel = getCharacterPanel();
  panel.root.style.display = visible ? 'block' : 'none';
}

function syncCharacterPanelFromLayer(layer: CharacterLayer): void {
  const panel = getCharacterPanel();
  panel.eyeL.value = String(layer.parameters.getValue('ParamEyeLOpen'));
  panel.eyeR.value = String(layer.parameters.getValue('ParamEyeROpen'));
  panel.mouthOpen.value = String(layer.parameters.getValue('ParamMouthOpenY'));
  panel.angleX.value = String(layer.parameters.getValue('ParamAngleX'));
  panel.angleY.value = String(layer.parameters.getValue('ParamAngleY'));
  panel.angleZ.value = String(layer.parameters.getValue('ParamAngleZ'));
}

function setupCharacterPanelEvents(): void {
  const panel = getCharacterPanel();
  const bindSlider = (el: HTMLInputElement, paramId: string) => {
    el.addEventListener('input', () => {
      const layer = state.demoCharacterLayer;
      if (!layer) return;
      layer.setParameter(paramId, Number(el.value));
    });
  };

  bindSlider(panel.eyeL, 'ParamEyeLOpen');
  bindSlider(panel.eyeR, 'ParamEyeROpen');
  bindSlider(panel.mouthOpen, 'ParamMouthOpenY');
  bindSlider(panel.angleX, 'ParamAngleX');
  bindSlider(panel.angleY, 'ParamAngleY');
  bindSlider(panel.angleZ, 'ParamAngleZ');

  panel.autoBlink.addEventListener('change', () => {
    const layer = state.demoCharacterLayer;
    if (!layer) return;
    if (!panel.autoBlink.checked) {
      layer.setParameter('ParamEyeLOpen', Number(panel.eyeL.value));
      layer.setParameter('ParamEyeROpen', Number(panel.eyeR.value));
    }
  });

  panel.mouthPart.addEventListener('change', () => {
    const layer = state.demoCharacterLayer;
    if (!layer) return;
    layer.setPart('mouth', panel.mouthPart.value);
  });

  panel.playTalk.addEventListener('click', () => {
    const layer = state.demoCharacterLayer;
    if (!layer) return;
    layer.playAnimation('talk');
  });

  panel.stopTalk.addEventListener('click', () => {
    const layer = state.demoCharacterLayer;
    if (!layer) return;
    layer.stopAnimation();
  });

  panel.reset.addEventListener('click', () => {
    const layer = state.demoCharacterLayer;
    if (!layer) return;
    layer.parameters.resetToDefaults();
    layer.setPart('mouth', 'mouth_smile');
    panel.mouthPart.value = 'mouth_smile';
    syncCharacterPanelFromLayer(layer);
  });
}

function dumpLayoutDiagnostics(engine: Engine, wallpaperPath: string): void {
  const canvas = document.getElementById('render-canvas') as HTMLCanvasElement | null;
  const renderStage = document.getElementById('render-stage');
  const stageRect = renderStage?.getBoundingClientRect();
  const lines: string[] = [
    `\n=== Layout Diagnostics: ${wallpaperPath} ===`,
    `platform: ${navigator.platform}  userAgent: ${navigator.userAgent.slice(0, 80)}`,
    `devicePixelRatio: ${window.devicePixelRatio}`,
    `engine: ${engine.width}x${engine.height}  scriptWorld: ${engine.scriptWorldWidth}x${engine.scriptWorldHeight}`,
    `canvas buffer: ${canvas?.width ?? '?'}x${canvas?.height ?? '?'}  css: ${canvas?.style.width ?? '?'}x${canvas?.style.height ?? '?'}`,
    `renderStage rect: ${stageRect ? `${stageRect.width}x${stageRect.height}` : '?'}`,
  ];

  const sceneW = engine.scriptWorldWidth;
  const sceneH = engine.scriptWorldHeight;
  if (sceneW > 0 && sceneH > 0) {
    const cs = Math.max(engine.width / sceneW, engine.height / sceneH);
    const bgW = sceneW * cs;
    const bgH = sceneH * cs;
    const ovX = bgW - engine.width;
    const ovY = bgH - engine.height;
    lines.push(`coverScale: ${cs.toFixed(6)}  overflow: ${ovX.toFixed(2)},${ovY.toFixed(2)}  sceneOffset: ${(ovX / 2).toFixed(2)},${(ovY / 2).toFixed(2)}`);
  }

  const keyIds = ['layer-357', 'layer-220', 'layer-223', 'layer-237', 'layer-352', 'layer-359'];
  for (const layer of engine.layers) {
    if (keyIds.includes(layer.id)) {
      lines.push(`  ${layer.id} "${layer.name}" pos=(${layer.x.toFixed(2)}, ${layer.y.toFixed(2)}) size=${layer.width.toFixed(0)}x${layer.height.toFixed(0)}`);
    }
  }
  lines.push('=== End Layout Diagnostics ===\n');
  console.log(lines.join('\n'));
}

function createSolidCircleTexture(size: number, fill: string, stroke?: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

function createRoundedRectTexture(width: number, height: number, fill: string, radius = 18): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(width - r, 0);
  ctx.quadraticCurveTo(width, 0, width, r);
  ctx.lineTo(width, height - r);
  ctx.quadraticCurveTo(width, height, width - r, height);
  ctx.lineTo(r, height);
  ctx.quadraticCurveTo(0, height, 0, height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  return canvas.toDataURL('image/png');
}

function createRectMesh(cx: number, cy: number, width: number, height: number) {
  const hw = width / 2;
  const hh = height / 2;
  return {
    vertices: new Float32Array([
      cx - hw, cy - hh, 0,
      cx + hw, cy - hh, 0,
      cx + hw, cy + hh, 0,
      cx - hw, cy + hh, 0,
    ]),
    uvs: new Float32Array([
      0, 1,
      1, 1,
      1, 0,
      0, 0,
    ]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

function createQuadDelta(
  leftDx: number,
  rightDx: number,
  topDy: number,
  bottomDy: number,
  globalDx = 0,
  globalDy = 0,
): Float32Array {
  // 顶点顺序：v0(left-bottom), v1(right-bottom), v2(right-top), v3(left-top)
  return new Float32Array([
    leftDx + globalDx, bottomDy + globalDy,
    rightDx + globalDx, bottomDy + globalDy,
    rightDx + globalDx, topDy + globalDy,
    leftDx + globalDx, topDy + globalDy,
  ]);
}

function createTiltDelta(magnitude: number): Float32Array {
  return new Float32Array([
    -magnitude, -magnitude,
    -magnitude, magnitude,
    magnitude, magnitude,
    magnitude, -magnitude,
  ]);
}

function createDemoCharacterDef(): CharacterDef {
  const faceTex = createSolidCircleTexture(512, '#ffe2d1', '#f6c4a5');
  const eyeTex = createRoundedRectTexture(128, 48, '#1c2846', 24);
  const mouthSmileTex = createRoundedRectTexture(160, 56, '#d1547d', 28);
  const mouthOpenTex = createRoundedRectTexture(140, 96, '#7e2b4a', 30);

  const faceMesh = createRectMesh(0, 0, 360, 360);
  const eyeLeftMesh = createRectMesh(-70, 42, 90, 34);
  const eyeRightMesh = createRectMesh(70, 42, 90, 34);
  const mouthMesh = createRectMesh(0, -70, 120, 44);
  const mouthOpenMesh = createRectMesh(0, -70, 102, 76);

  const eyeCloseDelta = new Float32Array([
    0, 17,
    0, 17,
    0, -17,
    0, -17,
  ]);
  const zeroDelta = new Float32Array(8);

  return {
    meta: {
      name: 'DemoWife',
      version: '1.0.0',
      width: 512,
      height: 512,
    },
    skeleton: {
      bones: [
        {
          id: 'root',
          name: 'root',
          parentId: null,
          localTransform: {
            pos: { x: 0, y: 0 },
            rotation: 0,
            scale: { x: 1, y: 1 },
          },
          length: 0,
        },
      ],
    },
    parameters: [
      { id: 'ParamEyeLOpen', name: 'EyeL', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamEyeROpen', name: 'EyeR', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamMouthOpenY', name: 'Mouth', min: 0, max: 1, default: 0, group: 'mouth' },
      { id: 'ParamBreath', name: 'Breath', min: 0, max: 1, default: 0.5, group: 'body' },
      { id: 'ParamAngleX', name: 'AngleX', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleY', name: 'AngleY', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleZ', name: 'AngleZ', min: -30, max: 30, default: 0, group: 'face' },
    ],
    drawOrder: [
      { slotId: 'face', zIndex: 0 },
      { slotId: 'eyes_left', zIndex: 10 },
      { slotId: 'eyes_right', zIndex: 11 },
      { slotId: 'mouth', zIndex: 20 },
    ],
    parts: [
      {
        id: 'face_base',
        slot: 'face',
        texture: faceTex,
        mesh: faceMesh,
        deformers: [
          {
            parameterId: 'ParamAngleX',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(-16, 10, 0, 0) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(10, -16, 0, 0) },
            ],
          },
          {
            parameterId: 'ParamAngleY',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -14, 12) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 12, -14) },
            ],
          },
          {
            parameterId: 'ParamAngleZ',
            keyforms: [
              { paramValue: -30, vertexDeltas: createTiltDelta(-12) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createTiltDelta(12) },
            ],
          },
        ],
        zIndex: 0,
      },
      {
        id: 'eyes_left',
        slot: 'eyes_left',
        texture: eyeTex,
        mesh: eyeLeftMesh,
        deformers: [
          {
            parameterId: 'ParamEyeLOpen',
            keyforms: [
              { paramValue: 0, vertexDeltas: eyeCloseDelta },
              { paramValue: 1, vertexDeltas: new Float32Array(8) },
            ],
          },
          {
            parameterId: 'ParamAngleX',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(-10, 6, 0, 0) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(6, -10, 0, 0) },
            ],
          },
          {
            parameterId: 'ParamAngleY',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -6, 5) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 5, -6) },
            ],
          },
          {
            parameterId: 'ParamAngleZ',
            keyforms: [
              { paramValue: -30, vertexDeltas: createTiltDelta(-4) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createTiltDelta(4) },
            ],
          },
        ],
        zIndex: 0,
      },
      {
        id: 'eyes_right',
        slot: 'eyes_right',
        texture: eyeTex,
        mesh: eyeRightMesh,
        deformers: [
          {
            parameterId: 'ParamEyeROpen',
            keyforms: [
              { paramValue: 0, vertexDeltas: eyeCloseDelta },
              { paramValue: 1, vertexDeltas: new Float32Array(8) },
            ],
          },
          {
            parameterId: 'ParamAngleX',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(-6, 10, 0, 0) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(10, -6, 0, 0) },
            ],
          },
          {
            parameterId: 'ParamAngleY',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -6, 5) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 5, -6) },
            ],
          },
          {
            parameterId: 'ParamAngleZ',
            keyforms: [
              { paramValue: -30, vertexDeltas: createTiltDelta(-4) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createTiltDelta(4) },
            ],
          },
        ],
        zIndex: 1,
      },
      {
        id: 'mouth_smile',
        slot: 'mouth',
        texture: mouthSmileTex,
        mesh: mouthMesh,
        deformers: [
          {
            parameterId: 'ParamAngleX',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(-8, 5, 0, 0) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(5, -8, 0, 0) },
            ],
          },
          {
            parameterId: 'ParamAngleY',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -8, 10) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 8, -10) },
            ],
          },
          {
            parameterId: 'ParamAngleZ',
            keyforms: [
              { paramValue: -30, vertexDeltas: createTiltDelta(-5) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createTiltDelta(5) },
            ],
          },
        ],
        zIndex: 0,
      },
      {
        id: 'mouth_open',
        slot: 'mouth',
        texture: mouthOpenTex,
        mesh: mouthOpenMesh,
        deformers: [
          {
            parameterId: 'ParamAngleX',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(-9, 6, 0, 0) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(6, -9, 0, 0) },
            ],
          },
          {
            parameterId: 'ParamAngleY',
            keyforms: [
              { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -9, 11) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 9, -11) },
            ],
          },
          {
            parameterId: 'ParamAngleZ',
            keyforms: [
              { paramValue: -30, vertexDeltas: createTiltDelta(-6) },
              { paramValue: 0, vertexDeltas: zeroDelta },
              { paramValue: 30, vertexDeltas: createTiltDelta(6) },
            ],
          },
        ],
        zIndex: 1,
      },
    ],
    animations: [
      {
        name: 'talk',
        duration: 1.1,
        loop: true,
        tracks: [
          {
            targetType: 'parameter',
            targetId: 'ParamMouthOpenY',
            property: 'value',
            keyframes: [
              { time: 0, value: 0 },
              { time: 0.2, value: 0.7 },
              { time: 0.45, value: 0.1 },
              { time: 0.7, value: 0.9 },
              { time: 1.1, value: 0 },
            ],
          },
        ],
      },
    ],
    physics: [],
  };
}

// ==================== 初始化 ====================

async function init(): Promise<void> {
  const canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
  const container = document.getElementById('canvas-container') as HTMLDivElement;
  const renderStage = document.getElementById('render-stage') as HTMLDivElement;
  const inspectorRoot = document.getElementById('data-inspector-root') as HTMLDivElement;
  const infoEl = document.getElementById('info') as HTMLDivElement;
  
  if (!canvas || !container || !renderStage || !inspectorRoot) {
    console.error('找不到画布元素');
    updateInfo('错误: 找不到画布元素');
    return;
  }
  
  try {
    await EngineDefaults.init();

    // 设置画布尺寸
    const updateCanvasSize = () => {
      const rect = renderStage.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      state.engine?.resize(rect.width, rect.height);
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // 鼠标事件监听（用于粒子跟随等效果）
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = rect.height - (e.clientY - rect.top);
      
      for (const layer of state.mouseTrailLayers) {
        layer.updateMousePosition(x, y);
      }
    });
    
    // 创建引擎
    console.log('创建渲染后端...');
    const backend = createThreeBackend({
      maxDpr: TEXT_SAFE_MAX_DPR,
      powerPreference: gpuTuningSettings.powerPreference,
    });
    state.engine = createEngine({
      canvas,
      width: canvas.width,
      height: canvas.height,
      backend,
      effectShaderLoader: loadWEEffectShaders,
      backgroundColor: { r: 0.1, g: 0.1, b: 0.18, a: 1 },
    });
    
    console.log('创建场景管理器...');
    state.scene = new WEScene(state.engine);
    state.inspector = new DataModelInspector(inspectorRoot);
    state.inspector.setExportHandler(exportWallpaperData);
    
    console.log('启动渲染循环...');
    state.engine.start();
    applyGpuTuningSettings();
    
    // 绑定按钮事件
    bindButtonEvents();
    setupGpuTuningPanel();
    refreshInspector();
    
    // FPS 显示
    setInterval(() => {
      const hasActiveWallpaper = Boolean(state.currentPath ?? state.scene?.wallpaperPath);
      if (state.engine && infoEl) {
        if (!hasActiveWallpaper) {
          infoEl.textContent = 'FPS: - | Draw Calls: - | 准备就绪';
          return;
        }
        const stats = state.engine.getStats();
        const pathInfo = state.currentPath ? `${getFileName(state.currentPath)}` : '准备就绪';
        infoEl.textContent = `FPS: ${stats.fps} | Draw Calls: ${stats.drawCalls} | ${pathInfo}`;
      }
      if (hasActiveWallpaper) updateGpuMetricsPanel();
    }, 500);
    
    console.log('Wallpaper Engine Renderer 已初始化');
    updateInfo('准备就绪，点击"打开壁纸"或"加载示例"');
    
    
  } catch (error) {
    console.error('初始化失败:', error);
    updateInfo(`初始化失败: ${(error as Error).message}`);
  }
}

function bindButtonEvents(): void {
  document.getElementById('btn-open')?.addEventListener('click', openWallpaper);
  document.getElementById('btn-reload')?.addEventListener('click', reloadWallpaper);
  document.getElementById('btn-test')?.addEventListener('click', loadTestScene);
  document.getElementById('btn-sample')?.addEventListener('click', loadSampleWallpaper);
  document.getElementById('btn-generator')?.addEventListener('click', openGeneratorPage);
  document.getElementById('btn-inspector')?.addEventListener('click', handleInspectorToggle);
  setupBrowserEvents();
  setupCharacterPanelEvents();
  setCharacterPanelVisible(false);
}

function openGeneratorPage(): void {
  window.location.href = '/index-generator.html';
}

// ==================== 壁纸浏览器 ====================

interface WallpaperEntry {
  id: string;
  title: string;
  preview: string | null;
  type: string;
  tags: string[];
  source: 'local' | 'steam';
}

let cachedWallpapers: WallpaperEntry[] | null = null;
let activeSourceFilter: 'all' | 'local' | 'steam' = 'all';

async function fetchWallpaperList(): Promise<WallpaperEntry[]> {
  if (cachedWallpapers) return cachedWallpapers;
  const resp = await fetch('/api/wallpapers');
  if (!resp.ok) throw new Error(`获取壁纸列表失败: ${resp.status}`);
  cachedWallpapers = await resp.json();
  return cachedWallpapers!;
}

function openBrowser(): void {
  const browser = document.getElementById('wallpaper-browser')!;
  const grid = document.getElementById('browser-grid')!;
  const loading = document.getElementById('browser-loading')!;
  const empty = document.getElementById('browser-empty')!;
  const searchInput = document.getElementById('browser-search') as HTMLInputElement;

  browser.classList.add('open');
  loading.style.display = 'flex';
  empty.style.display = 'none';
  grid.innerHTML = '';
  searchInput.value = '';
  cachedWallpapers = null;

  // 重置来源标签
  activeSourceFilter = 'all';
  document.querySelectorAll('.source-tab').forEach(t => {
    t.classList.toggle('active', (t as HTMLElement).dataset.source === 'all');
  });

  fetchWallpaperList()
    .then((wallpapers) => {
      loading.style.display = 'none';
      updateSourceTabCounts();
      applyBrowserFilters();
    })
    .catch((err) => {
      loading.textContent = `加载失败: ${(err as Error).message}`;
    });
}

function closeBrowser(): void {
  document.getElementById('wallpaper-browser')!.classList.remove('open');
}

function renderWallpaperGrid(wallpapers: WallpaperEntry[]): void {
  const grid = document.getElementById('browser-grid')!;
  const empty = document.getElementById('browser-empty')!;

  grid.innerHTML = '';

  if (wallpapers.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const wp of wallpapers) {
    const card = document.createElement('div');
    card.className = 'wallpaper-card';
    card.dataset.id = wp.id;
    card.title = wp.title;

    const img = document.createElement('img');
    img.className = 'card-preview';
    img.alt = wp.title;
    img.loading = 'lazy';
    if (wp.preview) {
      img.src = wp.preview;
    } else {
      img.style.background = '#0f3460';
      img.src = 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect fill="#0f3460" width="320" height="180"/><text x="160" y="95" fill="#64748b" font-size="14" text-anchor="middle" font-family="sans-serif">无预览</text></svg>`
      );
    }

    const badge = document.createElement('span');
    badge.className = `card-source ${wp.source}`;
    badge.textContent = wp.source === 'steam' ? 'Steam' : '本地';

    const info = document.createElement('div');
    info.className = 'card-info';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = wp.title;

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const typeSpan = document.createElement('span');
    typeSpan.className = 'card-type';
    typeSpan.textContent = wp.type;
    meta.appendChild(typeSpan);

    if (wp.tags.length > 0) {
      meta.appendChild(document.createTextNode(' ' + wp.tags.join(', ')));
    }

    info.appendChild(title);
    info.appendChild(meta);
    card.appendChild(img);
    card.appendChild(badge);
    card.appendChild(info);
    grid.appendChild(card);

    card.addEventListener('click', () => {
      closeBrowser();
      const wallpaperPath = wp.source === 'steam'
        ? `/steam-wallpapers/${wp.id}`
        : `/wallpapers/${wp.id}`;
      loadWallpaper(wallpaperPath);
    });
  }
}

function applyBrowserFilters(): void {
  if (!cachedWallpapers) return;

  let filtered = cachedWallpapers;

  if (activeSourceFilter !== 'all') {
    filtered = filtered.filter(wp => wp.source === activeSourceFilter);
  }

  const query = (document.getElementById('browser-search') as HTMLInputElement)?.value?.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter(
      wp =>
        wp.title.toLowerCase().includes(query) ||
        wp.id.includes(query) ||
        wp.tags.some(t => t.toLowerCase().includes(query)),
    );
  }

  renderWallpaperGrid(filtered);
}

function updateSourceTabCounts(): void {
  if (!cachedWallpapers) return;
  const allCount = cachedWallpapers.length;
  const localCount = cachedWallpapers.filter(wp => wp.source === 'local').length;
  const steamCount = cachedWallpapers.filter(wp => wp.source === 'steam').length;

  document.querySelectorAll('.source-tab').forEach(tab => {
    const src = (tab as HTMLElement).dataset.source;
    if (src === 'all') tab.textContent = `全部 (${allCount})`;
    else if (src === 'local') tab.textContent = `本地 (${localCount})`;
    else if (src === 'steam') tab.textContent = `Steam (${steamCount})`;
  });
}

function setupBrowserEvents(): void {
  document.getElementById('btn-browser-close')?.addEventListener('click', closeBrowser);

  document.getElementById('wallpaper-browser')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeBrowser();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const browser = document.getElementById('wallpaper-browser');
      if (browser?.classList.contains('open')) closeBrowser();
    }
  });

  // 来源标签页切换
  document.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeSourceFilter = ((tab as HTMLElement).dataset.source || 'all') as typeof activeSourceFilter;
      applyBrowserFilters();
    });
  });

  // 搜索过滤
  const searchInput = document.getElementById('browser-search') as HTMLInputElement;
  searchInput?.addEventListener('input', () => applyBrowserFilters());
}

// ==================== 场景加载 ====================

async function loadTestScene(): Promise<void> {
  if (!state.engine) {
    updateInfo('引擎未初始化');
    return;
  }
  
  try {
    updateInfo('正在加载测试场景...');
    if (state.characterPartTimer !== null) {
      window.clearInterval(state.characterPartTimer);
      state.characterPartTimer = null;
    }
    state.demoCharacterLayer = null;
    state.engine.clearLayers();
    
    // 创建测试图片
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 800;
    testCanvas.height = 600;
    const ctx = testCanvas.getContext('2d')!;
    
    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(0.5, '#764ba2');
    gradient.addColorStop(1, '#f093fb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    
    // 装饰
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 800, Math.random() * 600, Math.random() * 50 + 10, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 文字
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Wallpaper Engine Renderer', 400, 280);
    ctx.font = '24px Arial';
    ctx.fillText('测试场景 - 渲染正常', 400, 330);
    
    const texture = state.engine.backend.createTexture({ source: testCanvas });
    
    const layer = createImageLayer({
      id: 'test-layer',
      name: 'Test Layer',
      width: state.engine.width,
      height: state.engine.height,
      source: texture,
      x: state.engine.width / 2,
      y: state.engine.height / 2,
    });
    
    await state.engine.addLayer(layer);

    const characterDef = createDemoCharacterDef();
    const characterLayer = createCharacterLayer({
      id: 'character-demo',
      name: 'Character Demo',
      width: 512,
      height: 512,
      x: state.engine.width * 0.5,
      y: state.engine.height * 0.55,
      zIndex: 10,
      characterDef,
      autoAnimate: false,
      defaultAnimation: 'talk',
    });
    await state.engine.addLayer(characterLayer);
    state.demoCharacterLayer = characterLayer;
    setCharacterPanelVisible(true);
    syncCharacterPanelFromLayer(characterLayer);

    const panel = getCharacterPanel();
    panel.autoBlink.checked = true;
    panel.mouthPart.value = 'auto';
    let blinkTimer = 0;
    let blinkState: 'wait' | 'closing' | 'opening' = 'wait';
    let nextBlinkIn = 2.5 + Math.random() * 2.5;
    state.characterPartTimer = window.setInterval(() => {
      const dt = 0.12;
      const isOpen = characterLayer.parameters.getValue('ParamMouthOpenY') > 0.4;
      if (panel.mouthPart.value === 'auto') {
        characterLayer.setPart('mouth', isOpen ? 'mouth_open' : 'mouth_smile');
      }
      if (panel.autoBlink.checked) {
        blinkTimer += dt;
        if (blinkState === 'wait') {
          if (blinkTimer >= nextBlinkIn) {
            blinkTimer = 0;
            blinkState = 'closing';
          }
        } else if (blinkState === 'closing') {
          const t = Math.min(1, blinkTimer / 0.08);
          const v = 1 - t;
          characterLayer.setParameter('ParamEyeLOpen', v);
          characterLayer.setParameter('ParamEyeROpen', v);
          panel.eyeL.value = String(v);
          panel.eyeR.value = String(v);
          if (t >= 1) {
            blinkTimer = 0;
            blinkState = 'opening';
          }
        } else {
          const t = Math.min(1, blinkTimer / 0.12);
          const v = t;
          characterLayer.setParameter('ParamEyeLOpen', v);
          characterLayer.setParameter('ParamEyeROpen', v);
          panel.eyeL.value = String(v);
          panel.eyeR.value = String(v);
          if (t >= 1) {
            blinkTimer = 0;
            blinkState = 'wait';
            nextBlinkIn = 2.5 + Math.random() * 2.5;
          }
        }
      } else {
        characterLayer.setParameter('ParamEyeLOpen', Number(panel.eyeL.value));
        characterLayer.setParameter('ParamEyeROpen', Number(panel.eyeR.value));
      }
      panel.mouthOpen.value = String(characterLayer.parameters.getValue('ParamMouthOpenY'));
    }, 120);

    state.currentPath = '测试场景';
    refreshInspector();
    updateInfo('测试场景已加载（含二次元角色演示）');
    
  } catch (error) {
    console.error('加载测试场景失败:', error);
    updateInfo(`加载失败: ${(error as Error).message}`);
  }
}

async function loadSampleWallpaper(): Promise<void> {
  if (!state.engine) {
    updateInfo('引擎未初始化');
    return;
  }
  
  try {
    updateInfo('正在加载示例壁纸...');
    
    // 清除现有状态
    if (state.characterPartTimer !== null) {
      window.clearInterval(state.characterPartTimer);
      state.characterPartTimer = null;
    }
    state.demoCharacterLayer = null;
    setCharacterPanelVisible(false);
    state.engine.clearLayers();
    state.irisLayers = [];
    state.mouseTrailLayers = [];
    
    // 从 URL 参数获取壁纸路径
    const urlParams = new URLSearchParams(window.location.search);
    const wallpaperPath = urlParams.get('wallpaper') || '/wallpapers/3462491575';
    
    // 加载壁纸
    const { projectJson, result } = await state.scene!.load(wallpaperPath);
    
    // 更新状态
    state.irisLayers = result.irisLayers;
    state.mouseTrailLayers = result.mouseTrailLayers;
    state.currentPath = wallpaperPath;
    maybeSwitchPowerPreferenceForVideoWallpaper();
    refreshInspector();
    
    updateInfo(projectJson?.title ? `已加载: ${projectJson.title}` : '示例壁纸已加载');
    
  } catch (error) {
    console.error('加载示例壁纸失败:', error);
    updateInfo(`加载失败: ${(error as Error).message}`);
  }
}

function openWallpaper(): void {
  openBrowser();
}

async function loadWallpaper(wallpaperPathOrLocal: string): Promise<void> {
  if (!state.engine) {
    updateInfo('引擎未初始化');
    return;
  }
  
  try {
    updateInfo('正在加载壁纸...');
    
    // 清除现有状态
    if (state.characterPartTimer !== null) {
      window.clearInterval(state.characterPartTimer);
      state.characterPartTimer = null;
    }
    state.demoCharacterLayer = null;
    setCharacterPanelVisible(false);
    state.engine.clearLayers();
    state.irisLayers = [];
    state.mouseTrailLayers = [];
    
    // 兼容：如果是本地路径（带 project.json 或绝对路径），转换为 HTTP URL
    let wallpaperPath = wallpaperPathOrLocal;
    if (wallpaperPath.endsWith('project.json')) {
      wallpaperPath = wallpaperPath.replace(/[/\\]project\.json$/i, '');
    }
    const wallpapersMatch = wallpaperPath.match(/[/\\]resources[/\\]wallpapers[/\\](.+)$/);
    if (wallpapersMatch) {
      wallpaperPath = `/wallpapers/${wallpapersMatch[1]}`;
    }
    
    console.log('加载壁纸路径:', wallpaperPath);
    
    // 使用统一的加载函数
    const sceneLoadStart = performance.now();
    const { projectJson, result } = await state.scene!.load(wallpaperPath);
    const sceneLoadMs = performance.now() - sceneLoadStart;
    
    // 更新状态
    state.irisLayers = result.irisLayers;
    state.mouseTrailLayers = result.mouseTrailLayers;
    state.currentPath = wallpaperPath;
    maybeSwitchPowerPreferenceForVideoWallpaper();
    refreshInspector();
    
    // 使缓存失效，以便下次打开浏览器时重新高亮当前壁纸
    updateInfo(projectJson?.title ? `已加载: ${projectJson.title}` : `已加载: ${getFileName(wallpaperPath)}`);
    if (wallpaperPath.includes('/wallpapers/3581882134')) {
      console.log(`[LoadProfile] renderer.sceneLoad=${sceneLoadMs.toFixed(1)}ms path=${wallpaperPath}`);
    }

    // 平台布局诊断日志（用于排查 macOS vs Windows 位置偏差）
    dumpLayoutDiagnostics(state.engine!, wallpaperPath);
    
  } catch (error) {
    console.error('加载壁纸失败:', error);
    updateInfo(`加载失败: ${(error as Error).message}`);
  }
}

async function reloadWallpaper(): Promise<void> {
  if (state.currentPath && state.engine) {
    await loadWallpaper(state.currentPath);
  } else {
    updateInfo('没有已加载的壁纸');
  }
}

async function exportWallpaperData(): Promise<void> {
  const wallpaperPath = state.scene?.wallpaperPath;
  if (!wallpaperPath) {
    updateInfo('没有可导出的壁纸，请先加载壁纸');
    return;
  }

  try {
    updateInfo('正在导出数据...');
    const inspector = state.scene?.lastLoadResult?.inspector;
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallpaperPath,
        descriptor: inspector?.descriptor ?? null,
        sceneJson: inspector?.sceneJson ?? null,
        originalSceneJson: inspector?.originalSceneJson ?? null,
      }),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      error?: string;
      exportPath?: string;
      fileCount?: number;
      warnings?: string[];
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || `导出失败(${response.status})`);
    }

    const warningCount = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
    if (warningCount > 0) {
      console.warn('导出警告:', payload.warnings);
    }
    updateInfo(
      `导出完成: ${payload.fileCount ?? 0} 个文件` +
        (warningCount > 0 ? `（警告 ${warningCount} 条）` : ''),
    );
  } catch (error) {
    console.error('导出数据失败:', error);
    updateInfo(`导出失败: ${(error as Error).message}`);
  }
}

// ==================== 启动 ====================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
