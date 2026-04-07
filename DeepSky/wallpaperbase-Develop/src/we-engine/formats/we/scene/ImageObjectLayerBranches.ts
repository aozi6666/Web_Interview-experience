import { Engine } from 'moyu-engine';
import { getTransparent1x1Texture } from 'moyu-engine/rendering/EffectDefaults';
import { BlendMode } from 'moyu-engine/rendering/interfaces/IMaterial';
import { createImageLayer } from 'moyu-engine/scenario/layers';
import type { Layer as EngineLayer } from 'moyu-engine/scenario/layers/Layer';
import type { ProjectJson, SceneEffect, SceneObject } from '../LoaderTypes';
import {
  buildTimelineDefaults,
  computeSceneLayout,
  getWeLayerMetadata,
  parseBlendMode,
  parseObjColor,
  parseVector2,
  resolveLayerSceneOffset,
  resolveObjectAlpha,
  resolveObjectTransform,
  toSourceAngles,
  toSourceScale,
  type TimelineDefaults,
} from '../LoaderUtils';
import { getMimeType, parsePkg } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import { loadGenericImageEffects } from './EffectLoader';

type PkgData = ReturnType<typeof parsePkg>;

type DynamicBindingApplier = (
  layer: EngineLayer,
  obj: SceneObject,
  projectJson: ProjectJson | null | undefined,
  defaults: TimelineDefaults,
) => void;

type DynamicRtBinder = (
  layer: EngineLayer & { addDynamicTextureBind: (passIndex: number, slotIndex: number, texturePath: string) => void },
  effects: SceneEffect[] | undefined,
  normalizeAlias: boolean,
) => void;

function effectsReferenceSceneCapture(effects: SceneEffect[] | undefined): boolean {
  if (!effects) return false;
  for (const effect of effects) {
    if (!effect.passes) continue;
    for (const pass of effect.passes) {
      const textures = pass.textures ?? [];
      for (const texturePath of textures) {
        if (texturePath === '_rt_FullFrameBuffer') {
          return true;
        }
      }
      const userTextures = pass.usertextures;
      if (!userTextures) continue;
      for (const userTexture of userTextures) {
        if (!userTexture) continue;
        if (userTexture.name === '_rt_FullFrameBuffer' || userTexture.type === '_rt_FullFrameBuffer') {
          return true;
        }
      }
    }
  }
  return false;
}

export function shouldUsePostProcessForComposeLikeLayer(input: {
  isFullscreenLike: boolean;
  copybackground: boolean;
  effects: SceneEffect[] | undefined;
}): boolean {
  if (input.isFullscreenLike) return true;
  if (input.copybackground) return true;
  return effectsReferenceSceneCapture(input.effects);
}

export async function loadSolidLayerBranch(input: {
  engine: Engine;
  pkg: PkgData | null;
  obj: SceneObject;
  sceneSize: { width: number; height: number };
  basePath: string;
  materialBlend: BlendMode | undefined;
  materialReceivesLighting: boolean;
  initialVisible: boolean;
  projectJson?: ProjectJson | null;
  applyDynamicBindingsToLayer: DynamicBindingApplier;
}): Promise<boolean> {
  const {
    engine,
    pkg,
    obj,
    sceneSize,
    basePath,
    materialBlend,
    materialReceivesLighting,
    initialVisible,
    projectJson,
    applyDynamicBindingsToLayer,
  } = input;
  const deps = ((obj as Record<string, unknown>).dependencies as number[] | undefined) ?? [];
  console.log(`[FBO] solidlayer "${obj.name}" (id=${(obj as Record<string, unknown>).id}): 创建固体颜色基础纹理, deps=${deps}`);

  const specifiedSize = parseVector2(obj.size);
  const size: [number, number] = specifiedSize && specifiedSize[0] > 0
    ? specifiedSize : [100, 100];

  const alpha = resolveObjectAlpha(obj.alpha, projectJson, 1);
  const { coverScale, overflow } = computeSceneLayout(engine.width, engine.height, sceneSize);
  const displayWidth = size[0] * coverScale;
  const displayHeight = size[1] * coverScale;
  const [layerOffsetX, layerOffsetY] = resolveLayerSceneOffset(obj.alignment, overflow.x, overflow.y);

  const effectResult = obj.effects
    ? await loadGenericImageEffects(engine, pkg, basePath, obj.effects, [size[0], size[1]], parseObjColor(obj.color, projectJson), projectJson, String(obj.name ?? obj.id))
    : { passes: [], fbos: [] };

  const transform = resolveObjectTransform(obj, sceneSize);
  const layerOrigin = transform.origin;
  const x = layerOrigin[0] * coverScale - layerOffsetX;
  const y = layerOrigin[1] * coverScale - layerOffsetY;
  const parallaxDepth = transform.parallaxDepth;

  const objColor = parseObjColor(obj.color, projectJson);
  const solidData = new Uint8Array([
    Math.round(objColor.r * 255), Math.round(objColor.g * 255),
    Math.round(objColor.b * 255), 255
  ]);
  const solidTexture = engine.backend.createTextureFromRGBA(solidData, 1, 1);

  const objectBlend = parseBlendMode(obj);
  const blendMode = objectBlend ?? materialBlend;

  const layer = createImageLayer({
    id: `layer-${(obj as Record<string, unknown>).id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || 'Solid Layer',
    width: displayWidth,
    height: displayHeight,
    x,
    y,
    sourceSize: [size[0], size[1]],
    sourceOrigin: [layerOrigin[0], layerOrigin[1]],
    sourceScale: toSourceScale(transform.scaleVec),
    sourceAngles: toSourceAngles(transform.anglesVec),
    coverScale,
    sceneOffset: [overflow.x / 2, overflow.y / 2],
    zIndex: (obj as Record<string, unknown>)._zIndex as number ?? (obj as Record<string, unknown>).id as number ?? 0,
    blendMode,
    opacity: alpha,
    source: solidTexture,
    effectPasses: effectResult.passes,
    effectFbos: effectResult.fbos,
    parallaxDepth,
    textureSize: [size[0], size[1]],
    brightness: 1.0,
    color: objColor,
    userAlpha: alpha,
    alignment: obj.alignment,
    receiveLighting: materialReceivesLighting,
    visible: initialVisible,
    ...getWeLayerMetadata(obj),
  });
  applyDynamicBindingsToLayer(layer, obj, projectJson, {
    ...buildTimelineDefaults(layerOrigin, transform.scaleVec, transform.anglesVec, alpha, objColor),
  });

  const depLayerIds = deps.map(id => `layer-${id}`);
  await engine.addLayer(layer);
  if (depLayerIds.length > 0) {
    engine.setLayerDependencies(layer.id, depLayerIds);
  }

  let passIdx = 0;
  if (obj.effects) {
    for (const effect of obj.effects) {
      if (!effect.passes) continue;
      for (const pass of effect.passes) {
        const passTextures = pass.textures || [];
        for (let slotIdx = 0; slotIdx < passTextures.length; slotIdx++) {
          const texPath = passTextures[slotIdx];
          if (texPath && texPath.startsWith('_rt_')) {
            layer.addDynamicTextureBind(passIdx, slotIdx, texPath);
            console.log(`[FBO] solidlayer "${obj.name}" pass ${passIdx} slot ${slotIdx} → 动态绑定 "${texPath}"`);
          }
        }
        passIdx++;
      }
    }
  }

  console.log(`[FBO] solidlayer "${obj.name}" 已加载 (${effectResult.passes.length} effects, ${depLayerIds.length} deps)`);
  return true;
}

export async function loadComposeOrFullscreenLayerBranch(input: {
  engine: Engine;
  pkg: PkgData | null;
  obj: SceneObject;
  sceneSize: { width: number; height: number };
  basePath: string;
  materialBlend: BlendMode | undefined;
  materialReceivesLighting: boolean;
  initialVisible: boolean;
  projectJson?: ProjectJson | null;
  applyDynamicBindingsToLayer: DynamicBindingApplier;
  bindDynamicRtTextures: DynamicRtBinder;
}): Promise<boolean> {
  const {
    engine,
    pkg,
    obj,
    sceneSize,
    basePath,
    materialBlend,
    materialReceivesLighting,
    initialVisible,
    projectJson,
    applyDynamicBindingsToLayer,
    bindDynamicRtTextures,
  } = input;
  const imageRef = obj.image ?? '';
  const isComposelayer = imageRef.includes('composelayer');
  const isFullscreenlayer = imageRef.includes('fullscreenlayer');
  const isProjectlayer = imageRef.includes('projectlayer');
  if (!isComposelayer && !isFullscreenlayer && !isProjectlayer) {
    return false;
  }
  const specifiedSize = parseVector2(obj.size);
  const specifiedOrSceneSize: [number, number] =
    specifiedSize && specifiedSize[0] > 0 ? specifiedSize : [sceneSize.width, sceneSize.height];
  // composelayer 即便尺寸 >= 场景尺寸，也不应被视为全屏层：
  //   • 全屏层（fullscreenlayer/projectlayer）才应覆盖引擎视口并进入 PostProcess 阶段；
  //   • scene-sized composelayer 仍应按自身坐标/尺寸渲染，z-order 由场景决定。
  //   • 若需要访问场景捕获，copybackground 或 effectsReferenceSceneCapture 会单独处理。
  const isFullscreenLike = isFullscreenlayer || isProjectlayer;
  const size: [number, number] = isFullscreenLike
    ? [sceneSize.width, sceneSize.height]
    : specifiedOrSceneSize;

  const { coverScale, overflow } = computeSceneLayout(engine.width, engine.height, sceneSize);
  const displayWidth = isFullscreenLike ? engine.width : size[0] * coverScale;
  const displayHeight = isFullscreenLike ? engine.height : size[1] * coverScale;
  const [layerOffsetX, layerOffsetY] = resolveLayerSceneOffset(obj.alignment, overflow.x, overflow.y);

  let effectsForLoading: SceneEffect[] | undefined = obj.effects;
  if (isComposelayer && obj.effects) {
    effectsForLoading = obj.effects.map((eff) => {
      if (!eff.passes) return eff;
      return {
        ...eff,
        passes: eff.passes.map((p) => {
          if (p.combos && p.combos['TRANSPARENCY'] === 0) {
            return { ...p, combos: { ...p.combos, TRANSPARENCY: 1 } };
          }
          return p;
        }),
      };
    });
  }

  const effectResult = effectsForLoading
    ? await loadGenericImageEffects(engine, pkg, basePath, effectsForLoading, [size[0], size[1]], parseObjColor(obj.color, projectJson), projectJson, String(obj.name ?? obj.id))
    : { passes: [], fbos: [] };
  if (effectResult.passes.length === 0) {
    const typeLabel = isProjectlayer ? 'projectlayer' : isFullscreenlayer ? 'fullscreenlayer' : 'composelayer';
    console.log(`跳过 ${typeLabel} (无效果): ${obj.name || obj.id}`);
    return false;
  }

  const transform = resolveObjectTransform(obj, sceneSize);
  const layerOrigin = transform.origin;
  const x = isFullscreenLike
    ? engine.width / 2
    : layerOrigin[0] * coverScale - layerOffsetX;
  const y = isFullscreenLike
    ? engine.height / 2
    : layerOrigin[1] * coverScale - layerOffsetY;
  const parallaxDepth = transform.parallaxDepth;

  const alpha = resolveObjectAlpha(obj.alpha, projectJson, 1);

  const baseTexture = getTransparent1x1Texture(engine.backend);

  const objectBlend = parseBlendMode(obj);
  const blendMode = objectBlend ?? materialBlend ?? BlendMode.Normal;
  // effectsReferenceSceneCapture 只检查 scene.json pass.textures，
  // 但 effectcomposebackground 的 _rt_FullFrameBuffer 引用来自 shader 默认值。
  // 检查加载后的 effectResult.passes 的 binds 兜底。
  const effectUsesSceneCapture = effectResult.passes.some(
    p => p.binds && Object.values(p.binds).includes('_rt_FullFrameBuffer')
  );
  let shouldUsePostProcess = shouldUsePostProcessForComposeLikeLayer({
    isFullscreenLike,
    copybackground: isProjectlayer || obj.copybackground === true || effectUsesSceneCapture,
    effects: obj.effects,
  });
  if (!shouldUsePostProcess && effectUsesSceneCapture) {
    shouldUsePostProcess = true;
  }

  // fullscreenlayer/projectlayer 内部坐标系统一用显示像素空间（coverScale=1，sourceSize=displaySize）。
  // 若沿用场景坐标（sourceSize=sceneSize, coverScale=max(w/W,h/H)），在非 16:9 窗口下
  // this.width = sceneW * coverScale > engine.width，sprite 宽于屏幕，FBO 内容横向拉伸。
  const fsSourceSize: [number, number] = isFullscreenLike
    ? [displayWidth, displayHeight]
    : [size[0], size[1]];
  const fsCoverScale = isFullscreenLike ? 1 : coverScale;
  const fsSourceOrigin: [number, number] = isFullscreenLike
    ? [displayWidth / 2, displayHeight / 2]
    : [layerOrigin[0], layerOrigin[1]];
  const fsSceneOffset: [number, number] = isFullscreenLike
    ? [0, 0]
    : [overflow.x / 2, overflow.y / 2];

  const layer = createImageLayer({
    id: `layer-${(obj as Record<string, unknown>).id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || (isProjectlayer ? 'Project Layer' : isFullscreenlayer ? 'Fullscreen Layer' : 'Compose Layer'),
    width: displayWidth,
    height: displayHeight,
    x,
    y,
    sourceSize: fsSourceSize,
    sourceOrigin: fsSourceOrigin,
    sourceScale: toSourceScale(transform.scaleVec),
    sourceAngles: toSourceAngles(transform.anglesVec),
    coverScale: fsCoverScale,
    sceneOffset: fsSceneOffset,
    zIndex: (obj as Record<string, unknown>)._zIndex as number ?? (obj as Record<string, unknown>).id as number ?? 0,
    blendMode,
    opacity: alpha,
    source: baseTexture,
    effectPasses: effectResult.passes,
    effectFbos: effectResult.fbos,
    parallaxDepth,
    textureSize: isFullscreenLike ? undefined : [size[0], size[1]],
    brightness: typeof (obj as Record<string, unknown>).brightness === 'number'
      ? (obj as Record<string, unknown>).brightness as number : 1.0,
    userAlpha: alpha,
    alignment: obj.alignment,
    receiveLighting: materialReceivesLighting,
    passthrough: true,
    copybackground: isProjectlayer || obj.copybackground === true || effectUsesSceneCapture,
    isPostProcess: shouldUsePostProcess,
    visible: initialVisible,
    ...getWeLayerMetadata(obj),
  });
  applyDynamicBindingsToLayer(layer, obj, projectJson, {
    ...buildTimelineDefaults(
      layerOrigin,
      transform.scaleVec,
      transform.anglesVec,
      alpha,
      parseObjColor(obj.color, projectJson),
    ),
  });

  const deps = (obj as Record<string, unknown>).dependencies as number[] | undefined;
  if (deps && deps.length > 0) {
    const depLayerIds = deps.map(id => `layer-${id}`);
    await engine.addLayer(layer);
    engine.setLayerDependencies(layer.id, depLayerIds);
  } else {
    await engine.addLayer(layer);
  }

  bindDynamicRtTextures(layer, obj.effects, false);

  const layerType = isProjectlayer ? 'projectlayer' : isFullscreenlayer ? 'fullscreenlayer' : 'composelayer';
  const copyBgLabel = (isProjectlayer || obj.copybackground) ? ' [copybackground]' : '';
  console.log(`[${layerType}] "${obj.name}" 已加载 (${effectResult.passes.length} effects, ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)})${copyBgLabel}`);
  return true;
}

export async function loadPlainImageLayerBranch(input: {
  engine: Engine;
  pkg: PkgData | null;
  obj: SceneObject;
  imagePath: string;
  sceneSize: { width: number; height: number };
  modelFullscreen: boolean;
  modelWidth: number | undefined;
  modelHeight: number | undefined;
  materialBlend: BlendMode | undefined;
  materialReceivesLighting: boolean;
  initialVisible: boolean;
  basePath: string;
  projectJson?: ProjectJson | null;
  applyDynamicBindingsToLayer: DynamicBindingApplier;
  io?: ResourceIO;
}): Promise<boolean> {
  const {
    engine,
    pkg,
    obj,
    imagePath,
    sceneSize,
    modelFullscreen,
    modelWidth,
    modelHeight,
    materialBlend,
    materialReceivesLighting,
    initialVisible,
    basePath,
    projectJson,
    applyDynamicBindingsToLayer,
    io,
  } = input;
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  const imageUrl = resourceIO.loadBlobUrl(imagePath, getMimeType(imagePath)) ?? `${basePath}/${imagePath}`;

  let size: [number, number];
  if (modelFullscreen) {
    size = [sceneSize.width, sceneSize.height];
  } else {
    const specifiedSize = parseVector2(obj.size);
    if (specifiedSize && specifiedSize[0] > 0 && specifiedSize[1] > 0) {
      size = specifiedSize;
    } else if (modelWidth && modelHeight) {
      size = [modelWidth, modelHeight];
    } else {
      size = [100, 100];
    }
  }
  const alpha = resolveObjectAlpha(obj.alpha, projectJson, 1);

  const objectBlend = parseBlendMode(obj);
  const blendMode = objectBlend ?? materialBlend;
  const transform = resolveObjectTransform(obj, sceneSize);
  const { coverScale, overflow } = computeSceneLayout(engine.width, engine.height, sceneSize);
  const [layerOffsetX, layerOffsetY] = resolveLayerSceneOffset(obj.alignment, overflow.x, overflow.y);
  const layerOriginNonTex: [number, number] = modelFullscreen
    ? [sceneSize.width / 2, sceneSize.height / 2]
    : transform.origin;
  const x = layerOriginNonTex[0] * coverScale - layerOffsetX;
  const y = layerOriginNonTex[1] * coverScale - layerOffsetY;
  const parallaxDepth = transform.parallaxDepth;

  const layer = createImageLayer({
    id: `layer-${obj.id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || 'Image Layer',
    width: size[0] * coverScale,
    height: size[1] * coverScale,
    x,
    y,
    sourceSize: [size[0], size[1]],
    sourceOrigin: [layerOriginNonTex[0], layerOriginNonTex[1]],
    sourceScale: toSourceScale(transform.scaleVec),
    sourceAngles: toSourceAngles(transform.anglesVec),
    coverScale,
    sceneOffset: [overflow.x / 2, overflow.y / 2],
    zIndex: (obj as Record<string, unknown>)._zIndex as number ?? obj.id ?? 0,
    blendMode,
    opacity: alpha,
    source: imageUrl,
    parallaxDepth,
    alignment: obj.alignment,
    receiveLighting: materialReceivesLighting,
    visible: initialVisible,
    ...getWeLayerMetadata(obj),
  });
  applyDynamicBindingsToLayer(layer, obj, projectJson, {
    ...buildTimelineDefaults(
      [layerOriginNonTex[0], layerOriginNonTex[1]],
      transform.scaleVec,
      transform.anglesVec,
      alpha,
      parseObjColor(obj.color, projectJson),
    ),
  });

  await engine.addLayer(layer);
  return true;
}
