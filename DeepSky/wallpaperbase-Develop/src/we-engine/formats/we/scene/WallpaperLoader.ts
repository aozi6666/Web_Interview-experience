/**
 * Wallpaper Engine 壁纸加载器
 *
 * 负责从 PKG 文件加载场景、图片和粒子对象
 * 支持 scene 和 video 类型壁纸
 */

import type { BloomConfig } from 'moyu-engine';
import { Engine } from 'moyu-engine';
import type {
  TimelineAnimationConfig,
  TimelineKeyframe,
} from 'moyu-engine/components/animation/TimelineAnimation';
import type { SceneLightingState } from 'moyu-engine/components/lighting';
import { createScriptBindingsForLayer } from 'moyu-engine/components/scripting';
import type { CameraIntroConfig } from 'moyu-engine/scenario/Engine';
import {
  createImageLayer,
  createVideoLayer,
  EffectableLayer,
  Layer,
  RenderPhase,
  type TimelinePropertyBinding,
} from 'moyu-engine/scenario/layers';
import { SceneBuilder } from 'moyu-engine/scenario/scene-model';
import { parseObjectOriginXY, parseVec3Array } from 'moyu-engine/utils';
import type { LoadResult, ProjectJson, SceneObject } from '../LoaderTypes';
import { parseTimelineAnimation, resolveUserProperty } from '../LoaderUtils';
import {
  extractJsonFile,
  extractTextFile,
  listFiles,
  parsePkg,
} from '../PkgLoader';
import { fetchBinary, fetchHead, fetchJson, ResourceIO } from '../ResourceIO';
import { registerIncludeSource } from '../shader/ShaderTranspiler';
import { clearLoaderCaches } from '../TextureLoader';
import type { WESceneJson } from '../types';
import { WEAdapter } from '../WEAdapter';
import {
  collectPropertyScriptBindings,
  hasRuntimeBindings,
} from './ImageObjectLoader';
import { resolveSceneHierarchy } from './SceneHierarchyResolver';
import { dispatchSceneObjects } from './SceneObjectDispatcher';
import { applyResolvedSceneLighting, applySceneSetup } from './SceneSetup';
import { clearSoundObjectAudio } from './SoundObjectLoader';

type PkgData = ReturnType<typeof parsePkg>;

// Re-export for external consumers
export type { LoadResult, ProjectJson } from '../LoaderTypes';

function isVerboseLoaderLogEnabled(): boolean {
  return (
    (globalThis as { __WE_VERBOSE_LOGS?: boolean }).__WE_VERBOSE_LOGS === true
  );
}

function logLoaderVerbose(...args: unknown[]): void {
  if (isVerboseLoaderLogEnabled()) {
    console.log(...args);
  }
}

class RuntimeContainerLayer extends Layer {
  readonly kind = 'runtime-container';
  protected async onInitialize(): Promise<void> {}
  protected onUpdate(_deltaTime: number): void {}
  protected onDispose(): void {}
  override toRuntimeState(): undefined {
    return undefined;
  }
  override toDescriptor(): Record<string, unknown> {
    return {
      kind: this.kind,
      ...this.buildBaseDescriptor(),
    };
  }
}

function cloneTimelineTrack(track: TimelineKeyframe[]): TimelineKeyframe[] {
  return track.map((keyframe) => ({
    frame: keyframe.frame,
    value: keyframe.value,
    back: { ...keyframe.back },
    front: { ...keyframe.front },
    lockangle: keyframe.lockangle,
    locklength: keyframe.locklength,
  }));
}

function parseTimelineConfig(
  field: unknown,
  baseValues: number[],
): TimelineAnimationConfig | undefined {
  if (!field || typeof field !== 'object' || Array.isArray(field))
    return undefined;
  if (!('animation' in (field as Record<string, unknown>))) return undefined;
  const rawAnimation = (field as Record<string, unknown>).animation;
  const parsed = parseTimelineAnimation(rawAnimation, baseValues);
  if (!parsed) return undefined;
  const config: TimelineAnimationConfig = {
    tracks: parsed.tracks.map(cloneTimelineTrack),
    fps: parsed.fps,
    lengthFrames: parsed.lengthFrames,
    mode: parsed.mode,
  };
  const options =
    rawAnimation &&
    typeof rawAnimation === 'object' &&
    !Array.isArray(rawAnimation) &&
    typeof (rawAnimation as Record<string, unknown>).options === 'object'
      ? ((rawAnimation as Record<string, unknown>).options as Record<
          string,
          unknown
        >)
      : null;
  if (options) {
    if (options.wraploop === true) config.wrapLoop = true;
    const rate = Number(options.rate);
    if (Number.isFinite(rate)) config.rate = rate;
    if (typeof options.name === 'string') config.name = options.name;
  }
  return config;
}

function resolveCameraIntroConfig(
  rawObjects: Array<Record<string, unknown>>,
  projectJson: ProjectJson | null,
): CameraIntroConfig | null {
  for (const rawObj of rawObjects) {
    const cameraObj = rawObj as SceneObject;
    if ((cameraObj.camera || '').toLowerCase() !== 'default') continue;
    const cameraVisible = resolveUserProperty(cameraObj.visible, projectJson);
    if (cameraVisible === false) continue;

    const originField = cameraObj.origin as unknown;
    const originRaw =
      originField &&
      typeof originField === 'object' &&
      !Array.isArray(originField) &&
      'value' in (originField as Record<string, unknown>)
        ? (originField as Record<string, unknown>).value
        : originField;
    const originFallback = parseVec3Array(originRaw, [0, 0, 0]);
    const zoomResolved = resolveUserProperty(cameraObj.zoom, projectJson);
    const zoomFallbackRaw =
      typeof zoomResolved === 'number' ? zoomResolved : Number(zoomResolved);
    const zoomFallback = Number.isFinite(zoomFallbackRaw) ? zoomFallbackRaw : 1;
    const originTimeline = parseTimelineConfig(cameraObj.origin, [
      originFallback[0],
      originFallback[1],
      originFallback[2],
    ]);
    const zoomTimeline = parseTimelineConfig(cameraObj.zoom, [zoomFallback]);
    return {
      enabled: true,
      origin: originTimeline,
      zoom: zoomTimeline,
      originFallback,
      zoomFallback,
    };
  }
  return null;
}

function getRawSceneLayerId(obj: SceneObject): string | null {
  if (typeof obj.id !== 'number') return null;
  if (typeof obj.particle === 'string' && obj.particle.length > 0) {
    return `particle-${obj.id}`;
  }
  const isStandaloneEffectObject =
    Array.isArray(obj.effects) &&
    obj.effects.length > 0 &&
    !obj.image &&
    !obj.text &&
    !obj.sound &&
    !obj.particle;
  if (isStandaloneEffectObject) {
    return `effect-${obj.id}`;
  }
  return `layer-${obj.id}`;
}

function setupRenderGroups(
  engine: Engine,
  rawObjects: Array<Record<string, unknown>>,
): void {
  const containers = rawObjects.filter((rawObj) => {
    const obj = rawObj as SceneObject;
    return (
      typeof obj.id === 'number' &&
      typeof obj.image === 'string' &&
      obj.image.includes('composelayer') &&
      obj.copybackground !== true
    );
  });
  let appliedContainers = 0;
  let appliedChildren = 0;
  for (const rawContainer of containers) {
    const containerObj = rawContainer as SceneObject;
    const containerLayerId = `layer-${containerObj.id}`;
    const containerLayer = engine.getLayer(containerLayerId);
    if (!containerLayer || !(containerLayer instanceof EffectableLayer))
      continue;
    if (containerLayer.renderPhase !== RenderPhase.PostProcess) continue;

    const childLayerIds = new Set<string>();
    const pushChildLayerId = (layerId: string): void => {
      if (!engine.getLayer(layerId)) return;
      childLayerIds.add(layerId);
      // 粒子对象可能拆出 event/static 子粒子层（particle-<id>-child-*），
      // 这些层也必须进入同一 render group，否则会绕过容器遮罩直出到主场景。
      if (!layerId.startsWith('particle-')) return;
      const childPrefix = `${layerId}-child-`;
      for (const layer of engine.layers) {
        if (layer.id.startsWith(childPrefix)) {
          childLayerIds.add(layer.id);
        }
      }
    };
    for (const rawObj of rawObjects) {
      const obj = rawObj as SceneObject & { _weParentId?: unknown };
      const parentId =
        typeof obj._weParentId === 'number'
          ? obj._weParentId
          : typeof obj.parent === 'number'
            ? obj.parent
            : undefined;
      if (parentId !== containerObj.id) continue;
      const layerId = getRawSceneLayerId(obj);
      if (!layerId) continue;
      pushChildLayerId(layerId);
    }

    const childIds = [...childLayerIds];
    containerLayer.setRenderGroupChildren(childIds);
    for (const childLayerId of childIds) {
      const childLayer = engine.getLayer(childLayerId);
      childLayer?.setRenderGroupContainer(containerLayerId);
    }
    if (childIds.length > 0) {
      appliedContainers += 1;
      appliedChildren += childIds.length;
    }
  }

  engine.rebuildRenderPlan();
  logLoaderVerbose(
    `[RenderGroup] setup: containers=${appliedContainers}, children=${appliedChildren}`,
  );
}

// ==================== 主加载函数 ====================

/**
 * 加载壁纸
 * 支持 scene 和 video 类型
 */
export async function loadWallpaperFromPath(
  engine: Engine,
  wallpaperPath: string,
): Promise<{ projectJson: ProjectJson | null; result: LoadResult }> {
  const loadStart = performance.now();
  let legacyMs = 0;
  let descriptorMs = 0;
  let sceneBuildMs = 0;
  const capturedLayers: Layer[] = [];
  const capturedDependencies: Record<string, string[]> = {};
  let capturedClearColor:
    | { r: number; g: number; b: number; a: number }
    | undefined;
  let capturedBloom: BloomConfig | null | undefined;
  let capturedLighting: SceneLightingState | undefined;
  let capturedParallax:
    | {
        enabled: boolean;
        amount: number;
        delay: number;
        mouseInfluence: number;
      }
    | undefined;
  let capturedShake:
    | { enabled: boolean; amplitude: number; roughness: number; speed: number }
    | undefined;
  let capturedCameraIntro: CameraIntroConfig | null | undefined;
  let capturedAudioElement: HTMLMediaElement | null = null;
  let capturedAudioEnabled = false;
  let capturedScriptSceneState:
    | {
        clearenabled?: boolean;
        camerafade?: boolean;
        fov?: number;
        nearz?: number;
        farz?: number;
        perspectiveoverridefov?: number;
      }
    | undefined;

  const originalAddLayer = (engine as any).addLayer;
  const originalSetLayerDependencies = (engine as any).setLayerDependencies;
  const originalSetBackgroundColor = (engine as any).setBackgroundColor;
  const originalSetBloom = (engine as any).setBloom;
  const originalSetLighting = (engine as any).setLighting;
  const originalSetParallax = (engine as any).setParallax;
  const originalSetShake = (engine as any).setShake;
  const originalSetCameraIntro = (engine as any).setCameraIntro;
  const originalRegisterAudioElement = (engine as any).registerAudioElement;
  const originalSetAudioEnabled = (engine as any).setAudioEnabled;

  (engine as any).addLayer = async (layer: Layer) => {
    capturedLayers.push(layer);
  };
  (engine as any).setLayerDependencies = (
    layerId: string,
    depLayerIds: string[],
  ) => {
    capturedDependencies[layerId] = [...depLayerIds];
  };
  (engine as any).setBackgroundColor = (
    r: number,
    g: number,
    b: number,
    a = 1,
  ) => {
    capturedClearColor = { r, g, b, a };
  };
  (engine as any).setBloom = (config: BloomConfig | null) => {
    capturedBloom = config ? { ...config } : null;
  };
  (engine as any).setLighting = (state: SceneLightingState) => {
    capturedLighting = {
      ambientColor: { ...state.ambientColor },
      skylightColor: { ...state.skylightColor },
      config: { ...state.config },
      lights: [...state.lights],
    };
  };
  (engine as any).setParallax = (
    enabled: boolean,
    amount = 1,
    delay = 0.1,
    mouseInfluence = 1,
  ) => {
    capturedParallax = { enabled, amount, delay, mouseInfluence };
  };
  (engine as any).setShake = (
    enabled: boolean,
    amplitude = 0,
    roughness = 0,
    speed = 1,
  ) => {
    capturedShake = { enabled, amplitude, roughness, speed };
  };
  (engine as any).setCameraIntro = (config: CameraIntroConfig | null) => {
    capturedCameraIntro = config
      ? (JSON.parse(JSON.stringify(config)) as CameraIntroConfig)
      : null;
  };
  (engine as any).registerAudioElement = (element: HTMLMediaElement) => {
    capturedAudioElement = element;
  };
  (engine as any).setAudioEnabled = (enabled: boolean) => {
    if (enabled) capturedAudioEnabled = true;
  };

  let loaded: {
    projectJson: ProjectJson | null;
    result: LoadResult;
    rawObjects: Array<Record<string, unknown>>;
  };
  try {
    const legacyStart = performance.now();
    loaded = await loadWallpaperFromPathLegacy(engine, wallpaperPath);
    legacyMs = performance.now() - legacyStart;
  } finally {
    (engine as any).addLayer = originalAddLayer;
    (engine as any).setLayerDependencies = originalSetLayerDependencies;
    (engine as any).setBackgroundColor = originalSetBackgroundColor;
    (engine as any).setBloom = originalSetBloom;
    (engine as any).setLighting = originalSetLighting;
    (engine as any).setParallax = originalSetParallax;
    (engine as any).setShake = originalSetShake;
    (engine as any).setCameraIntro = originalSetCameraIntro;
    (engine as any).registerAudioElement = originalRegisterAudioElement;
    (engine as any).setAudioEnabled = originalSetAudioEnabled;
  }

  const descriptorStart = performance.now();
  const sceneScriptStateRaw = (
    engine as unknown as { _sceneScriptState?: Record<string, unknown> }
  )._sceneScriptState;
  if (sceneScriptStateRaw && typeof sceneScriptStateRaw === 'object') {
    capturedScriptSceneState = {
      clearenabled:
        typeof sceneScriptStateRaw.clearenabled === 'boolean'
          ? sceneScriptStateRaw.clearenabled
          : undefined,
      camerafade:
        typeof sceneScriptStateRaw.camerafade === 'boolean'
          ? sceneScriptStateRaw.camerafade
          : undefined,
      fov:
        typeof sceneScriptStateRaw.fov === 'number'
          ? sceneScriptStateRaw.fov
          : undefined,
      nearz:
        typeof sceneScriptStateRaw.nearz === 'number'
          ? sceneScriptStateRaw.nearz
          : undefined,
      farz:
        typeof sceneScriptStateRaw.farz === 'number'
          ? sceneScriptStateRaw.farz
          : undefined,
      perspectiveoverridefov:
        typeof sceneScriptStateRaw.perspectiveoverridefov === 'number'
          ? sceneScriptStateRaw.perspectiveoverridefov
          : undefined,
    };
  }
  const descriptor = WEAdapter.toDescriptor({
    wallpaperPath,
    projectJson: loaded.projectJson,
    scene: {
      width: engine.width,
      height: engine.height,
      clearColor: capturedClearColor,
      bloom: capturedBloom,
      cameraIntro: capturedCameraIntro,
      lighting: capturedLighting,
      parallax: capturedParallax,
      shake: capturedShake,
      scriptSceneState: capturedScriptSceneState,
    },
    layers: capturedLayers,
    layerDependencies: capturedDependencies,
    specialLayerIds: {
      irisLayerIds: loaded.result.irisLayers.map((layer) => layer.id),
      mouseTrailLayerIds: loaded.result.mouseTrailLayers.map(
        (layer) => layer.id,
      ),
    },
  });
  descriptorMs = performance.now() - descriptorStart;

  // SceneBuilder.build 从 descriptor 重建所有 layer，
  // 但 descriptor 不含 timeline property bindings，需从 captured layers 迁移。
  const savedTimelineBindings = new Map<string, TimelinePropertyBinding[]>();
  for (const layer of capturedLayers) {
    if (layer.timelinePropertyBindings.length > 0) {
      savedTimelineBindings.set(layer.id, [...layer.timelinePropertyBindings]);
    }
  }

  const sceneBuildStart = performance.now();
  const buildResult = await SceneBuilder.build(engine, descriptor);
  sceneBuildMs = performance.now() - sceneBuildStart;

  if (capturedAudioEnabled) {
    if (capturedAudioElement) {
      engine.connectAudioElement(capturedAudioElement);
    } else {
      engine.setAudioEnabled(true);
    }
  }

  if (savedTimelineBindings.size > 0) {
    for (const layer of engine.layers) {
      const bindings = savedTimelineBindings.get(layer.id);
      if (bindings) {
        layer.setTimelinePropertyBindings(bindings);
      }
    }
  }

  const referencedParentIds = new Set<number>();
  for (const rawObj of loaded.rawObjects) {
    const parentId = (rawObj as { parent?: unknown }).parent;
    if (typeof parentId === 'number') {
      referencedParentIds.add(parentId);
    }
  }
  for (const rawObj of loaded.rawObjects) {
    const so = rawObj as SceneObject & Record<string, unknown>;
    const rawId = so.id;
    if (typeof rawId !== 'number') continue;
    if (
      so.image ||
      so.particle ||
      so.text ||
      so.sound ||
      (Array.isArray(so.effects) && so.effects.length > 0)
    ) {
      continue;
    }
    const hasScriptBindings = hasRuntimeBindings(so);
    const isReferencedParent = referencedParentIds.has(rawId);
    if (!hasScriptBindings && !isReferencedParent) continue;

    const layerId = `layer-${rawId}`;
    if (engine.getLayer(layerId)) continue;

    const origin = parseObjectOriginXY(so.origin) ?? [0, 0];
    const layer = new RuntimeContainerLayer({
      id: layerId,
      name: typeof so.name === 'string' && so.name ? so.name : layerId,
      width: 0,
      height: 0,
      x: origin[0],
      y: origin[1],
      sourceSize: [0, 0],
      sourceOrigin: [origin[0], origin[1]],
      sourceScale: [1, 1, 1],
      sourceAngles: [0, 0, 0],
      visible: false,
      zIndex: typeof so._zIndex === 'number' ? so._zIndex : 0,
      weRelativeOrigin: Array.isArray(so._weRelativeOrigin)
        ? (so._weRelativeOrigin as [number, number])
        : undefined,
      weParentId:
        typeof so._weParentId === 'number'
          ? `layer-${so._weParentId}`
          : undefined,
      weAttachment:
        typeof so._weAttachment === 'string' ? so._weAttachment : undefined,
    });
    await engine.addLayer(layer);

    const scriptBindings = collectPropertyScriptBindings(
      so,
      loaded.projectJson,
    );
    if (scriptBindings.length > 0) {
      layer.setScriptBindings(
        createScriptBindingsForLayer(layer, scriptBindings),
      );
    }
  }

  setupRenderGroups(engine, loaded.rawObjects);

  const totalMs = performance.now() - loadStart;
  logLoaderVerbose(
    `[LoadProfile] ${wallpaperPath} total=${totalMs.toFixed(1)}ms legacy=${legacyMs.toFixed(1)}ms toDescriptor=${descriptorMs.toFixed(1)}ms sceneBuild=${sceneBuildMs.toFixed(1)}ms layers=${capturedLayers.length}`,
  );
  return {
    projectJson: loaded.projectJson,
    result: {
      irisLayers: buildResult.irisLayers,
      mouseTrailLayers: buildResult.mouseTrailLayers,
      inspector: {
        wallpaperPath,
        sceneJson: loaded.result.inspector?.sceneJson ?? null,
        originalSceneJson: loaded.result.inspector?.originalSceneJson ?? null,
        descriptor,
      },
    },
  };
}

/**
 * 旧版加载流程（直接创建并添加图层）
 * 现用于构建中间数据模型前的“采集执行”阶段。
 */
async function loadWallpaperFromPathLegacy(
  engine: Engine,
  wallpaperPath: string,
): Promise<{
  projectJson: ProjectJson | null;
  result: LoadResult;
  rawObjects: Array<Record<string, unknown>>;
}> {
  // 清除上一次壁纸遗留的模块级缓存（blob URL、纹理对象等）
  clearLoaderCaches(clearSoundObjectAudio);

  const result: LoadResult = {
    irisLayers: [],
    mouseTrailLayers: [],
    inspector: {
      wallpaperPath,
      sceneJson: null,
      originalSceneJson: null,
    },
  };

  // 加载 project.json
  let projectJson: ProjectJson | null = null;
  let sceneFile = 'scene.json';
  projectJson = await fetchJson<ProjectJson>(`${wallpaperPath}/project.json`);
  if (projectJson?.file) sceneFile = projectJson.file;

  // 根据壁纸类型选择加载方式（WE project.json 中 type 可能大小写不一致，如 "Video" / "video"）
  const wallpaperType = (projectJson?.type || 'scene').toLowerCase();

  if (wallpaperType === 'video') {
    engine.setCameraIntro(null);
    // 加载视频壁纸
    await loadVideoWallpaper(engine, wallpaperPath, projectJson);
    return { projectJson, result, rawObjects: [] };
  }

  // 以下是 scene 类型的加载逻辑
  // 加载 PKG — 文件名从 project.json 的 file 字段推导
  // 如 file="gifscene.json" → PKG 为 "gifscene.pkg"
  // 如 file="scene.json" → PKG 为 "scene.pkg"
  const pkgName = sceneFile.replace(/\.json$/i, '.pkg');
  const pkgBuffer = await fetchBinary(`${wallpaperPath}/${pkgName}`);
  if (!pkgBuffer) {
    throw new Error(`无法加载场景包 ${pkgName}`);
  }

  const pkg = parsePkg(pkgBuffer);
  const io = new ResourceIO(pkg, wallpaperPath);
  const fileList = listFiles(pkg);

  // ===== 预注册 PKG 中的着色器头文件 =====
  // Workshop 壁纸的 PKG 可能包含自定义 .h 头文件（用于 #include）
  // 在加载任何着色器之前，将它们注册到 ShaderTranspiler 的缓存中
  for (const fileName of fileList) {
    if (fileName.endsWith('.h') && fileName.startsWith('shaders/')) {
      const hSource = extractTextFile(pkg, fileName);
      if (hSource) {
        // 注册完整子路径（如 "workshop/123/effects/helper.h"）
        const subPath = fileName.substring('shaders/'.length);
        registerIncludeSource(subPath, hSource);
        // 也注册仅文件名（常见的 #include 写法，如 #include "common_sway.h"）
        const baseName = fileName.substring(fileName.lastIndexOf('/') + 1);
        if (baseName !== subPath) {
          registerIncludeSource(baseName, hSource);
        }
      }
    }
  }

  // 提取场景 JSON
  const sceneFileName = sceneFile.endsWith('.json') ? sceneFile : 'scene.json';
  let sceneJson = extractJsonFile<WESceneJson>(pkg, sceneFileName);

  if (!sceneJson) {
    const jsonFiles = fileList.filter(
      (f) => f.endsWith('.json') && !f.includes('/'),
    );
    if (jsonFiles.length > 0) {
      sceneJson = extractJsonFile<WESceneJson>(pkg, jsonFiles[0]);
    }
  }

  if (!sceneJson) {
    throw new Error('无法从 PKG 中提取场景配置');
  }

  const originalSceneJson = JSON.parse(
    JSON.stringify(sceneJson),
  ) as WESceneJson;
  if (result.inspector) {
    result.inspector.originalSceneJson = originalSceneJson;
  }

  // 解析场景尺寸
  const ortho = sceneJson.general?.orthogonalprojection;
  const sceneSize =
    ortho && typeof ortho === 'object' && 'width' in ortho
      ? {
          width: ortho.width || engine.width,
          height: ortho.height || engine.height,
        }
      : { width: engine.width, height: engine.height };
  engine.setScriptWorldSize(sceneSize.width, sceneSize.height);

  const { rawObjects } = applySceneSetup(
    engine,
    sceneJson,
    projectJson,
    resolveCameraIntroConfig,
  );

  const hierarchy = resolveSceneHierarchy(
    rawObjects as Array<Record<string, unknown>>,
    projectJson,
    pkg,
  );
  const sortedObjects = hierarchy.sortedObjects;
  applyResolvedSceneLighting(
    engine,
    sceneJson,
    sortedObjects as Array<Record<string, unknown>>,
    projectJson,
  );
  const dependencyLayerIds = hierarchy.dependencyLayerIds;
  const dispatchResult = await dispatchSceneObjects(
    engine,
    pkg,
    sortedObjects as Record<string, unknown>[],
    sceneSize,
    wallpaperPath,
    result,
    projectJson,
    dependencyLayerIds,
    io,
  );

  // 加载预览图作为背景（如果没有图片图层）
  if (!dispatchResult.hasImageLayer) {
    await loadPreviewAsBackground(engine, wallpaperPath, projectJson);
  }

  if (result.inspector) {
    result.inspector.sceneJson = sceneJson;
  }

  return {
    projectJson,
    result,
    rawObjects: rawObjects as Array<Record<string, unknown>>,
  };
}

/**
 * Electron 的 WE 渲染窗口（WERenderer/WeRuntime）下壁纸基址为 we-asset://local/...；
 * fetch() 可用，但 Chromium 媒体管线无法可靠用自定义协议驱动 video 元素。
 * 转为 file:/// 供 VideoLayer / probeVideoSize 使用（相关窗口已允许 file: 媒体源）。
 */
function weAssetToFileUrl(src: string): string {
  const prefix = 'we-asset://local/';
  if (!src.startsWith(prefix)) return src;
  return `file:///${src.slice(prefix.length)}`;
}

/**
 * 加载视频类型壁纸
 */
async function loadVideoWallpaper(
  engine: Engine,
  wallpaperPath: string,
  projectJson: ProjectJson | null,
): Promise<void> {
  const videoFile = projectJson?.file;
  if (!videoFile) {
    throw new Error('视频壁纸缺少视频文件配置');
  }

  const videoPath = weAssetToFileUrl(`${wallpaperPath}/${videoFile}`);
  console.log('加载视频壁纸:', videoPath);

  // 先探测视频原始尺寸，再用 cover 缩放保持比例
  const videoSize = await probeVideoSize(videoPath);
  const videoCoverScale = Math.max(
    engine.width / videoSize.width,
    engine.height / videoSize.height,
  );
  const videoDisplayW = videoSize.width * videoCoverScale;
  const videoDisplayH = videoSize.height * videoCoverScale;

  const videoLayer = createVideoLayer({
    id: 'main_video',
    name: 'Main Video',
    width: videoDisplayW,
    height: videoDisplayH,
    x: engine.width / 2,
    y: engine.height / 2,
    source: videoPath,
    loop: true,
    muted: false,
    autoplay: true,
  });

  await engine.addLayer(videoLayer);
  console.log(
    `视频壁纸已加载 (cover: ${videoDisplayW.toFixed(0)}x${videoDisplayH.toFixed(0)}, 原始: ${videoSize.width}x${videoSize.height})`,
  );
}

/** 探测视频文件的原始尺寸（通过临时 <video> 加载 metadata） */
function probeVideoSize(
  videoUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onError);
      video.src = '';
    };

    const onMeta = () => {
      const w = video.videoWidth || 1920;
      const h = video.videoHeight || 1080;
      cleanup();
      resolve({ width: w, height: h });
    };

    const onError = () => {
      cleanup();
      // 探测失败时回退到 16:9
      resolve({ width: 1920, height: 1080 });
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onError);
    video.src = videoUrl;
  });
}

async function loadPreviewAsBackground(
  engine: Engine,
  basePath: string,
  projectJson?: ProjectJson | null,
): Promise<void> {
  const possiblePreviews = [
    projectJson?.preview,
    'preview.jpg',
    'preview.png',
    'preview.gif',
  ].filter(Boolean) as string[];

  for (const previewFile of possiblePreviews) {
    try {
      const previewUrl = `${basePath}/${previewFile}`;
      const exists = await fetchHead(previewUrl);
      if (!exists) continue;

      const layer = createImageLayer({
        id: 'preview-layer',
        name: 'Preview',
        width: engine.width,
        height: engine.height,
        x: engine.width / 2,
        y: engine.height / 2,
        sourceSize: [engine.width, engine.height],
        sourceOrigin: [engine.width / 2, engine.height / 2],
        sourceScale: [1, 1, 1],
        sourceAngles: [0, 0, 0],
        source: previewUrl,
      });

      await engine.addLayer(layer);
      return;
    } catch {
      // 继续尝试
    }
  }
}
