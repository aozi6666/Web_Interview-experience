/**
 * Wallpaper Engine 图像对象加载器
 *
 * 负责加载 scene.json 中的 image 类型对象（图层、solidlayer、composelayer 等）
 */

import { Engine } from 'moyu-engine';
import { createImageLayer, createVideoLayer } from 'moyu-engine/scenario/layers';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from 'moyu-engine/components/scripting';
import { BlendMode } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { ImageLayerConfig } from 'moyu-engine/scenario/layers/ImageLayer';
import type { Layer as EngineLayer } from 'moyu-engine/scenario/layers/Layer';
import { parsePkg, listFiles } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import { parseTex, texToUrl } from '../texture/TexLoader';
import { parseMdl } from '../mdl/MdlLoader';
import type { LoadResult, ProjectJson, SceneEffect, SceneObject } from '../LoaderTypes';
import { logLoaderVerbose } from '../LoaderUtils';
import {
  buildTimelineDefaults,
  computeSceneLayout,
  type ParsedTimelineAnimation,
  type TimelineDefaults,
  getWeLayerMetadata,
  getScriptFieldValue,
  normalizeMediaTextureAlias,
  parseTimelineAnimation,
  parseBlendMode,
  parseMaterialBlendMode,
  parseObjColor,
  resolveLayerSceneOffset,
  resolveObjectAlpha,
  resolveObjectTransform,
  parseVector2,
  toSourceAngles,
  toSourceScale,
  resolveScriptPropertyUserValues,
  resolveUserProperty,
  toScriptBindingConfig,
} from '../LoaderUtils';
import {
  imageTexCache,
  imageTexPending,
  loadJsonFile,
  loadTexData,
} from '../TextureLoader';
import {
  loadComposeOrFullscreenLayerBranch,
  loadPlainImageLayerBranch,
  loadSolidLayerBranch,
} from './ImageObjectLayerBranches';

const console = { ...globalThis.console, log: logLoaderVerbose };
import { loadGenericImageEffects, createPuppetSwayPass } from './EffectLoader';

type PkgData = ReturnType<typeof parsePkg>;

export function collectPropertyScriptBindings(obj: SceneObject, projectJson?: ProjectJson | null): ScriptBindingConfig[] {
  const bindings: ScriptBindingConfig[] = [];
  const candidates = [
    toScriptBindingConfig('origin', obj.origin),
    toScriptBindingConfig('scale', obj.scale),
    toScriptBindingConfig('angles', obj.angles),
    toScriptBindingConfig('color', obj.color),
    toScriptBindingConfig('alpha', obj.alpha),
    toScriptBindingConfig('visible', obj.visible),
  ];
  for (const c of candidates) {
    if (c) {
      if (projectJson && c.scriptProperties) {
        resolveScriptPropertyUserValues(c.scriptProperties, projectJson);
      }
      bindings.push(c);
    }
  }
  return bindings;
}

function extractAnimationPayload(field: unknown): { animation: unknown; value?: unknown } | null {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return null;
  const obj = field as Record<string, unknown>;
  if (!('animation' in obj) || !obj.animation) return null;
  if ('script' in obj && typeof obj.script === 'string') return null;
  return {
    animation: obj.animation,
    value: obj.value,
  };
}

function createTimelineBinding(
  target: 'origin' | 'scale' | 'angles' | 'alpha' | 'color',
  parsed: ParsedTimelineAnimation | null,
): { target: 'origin' | 'scale' | 'angles' | 'alpha' | 'color'; animation: ParsedTimelineAnimation['animation'] } | null {
  if (!parsed) return null;
  return {
    target,
    animation: parsed.animation,
  };
}

function collectPropertyTimelineBindings(
  obj: SceneObject,
  defaults: TimelineDefaults,
): Array<{ target: 'origin' | 'scale' | 'angles' | 'alpha' | 'color'; animation: ParsedTimelineAnimation['animation'] }> {
  type TimelineTarget = 'origin' | 'scale' | 'angles' | 'alpha' | 'color';
  const parseTimelineTarget = (key: string | undefined): TimelineTarget | undefined => {
    if (!key) return undefined;
    const normalized = key.trim().toLowerCase();
    if (
      normalized === 'origin'
      || normalized === 'scale'
      || normalized === 'angles'
      || normalized === 'alpha'
      || normalized === 'color'
    ) {
      return normalized;
    }
    // parent.key 在 WE 中可能出现为 "scale.animation" / "image.scale" 等形式，
    // 这里按 token 搜索可识别目标属性，避免误匹配到 "animation" 之类后缀。
    const tokens = normalized.split(/[^a-z]+/g).filter(Boolean);
    for (const token of tokens) {
      if (
        token === 'origin'
        || token === 'scale'
        || token === 'angles'
        || token === 'alpha'
        || token === 'color'
      ) {
        return token;
      }
    }
    return undefined;
  };

  const bindings: Array<{ target: 'origin' | 'scale' | 'angles' | 'alpha' | 'color'; animation: ParsedTimelineAnimation['animation'] }> = [];
  const parsedByTarget = new Map<TimelineTarget, ParsedTimelineAnimation>();
  const originPayload = extractAnimationPayload(obj.origin);
  if (originPayload) {
    const parsed = parseTimelineAnimation(originPayload.animation, [defaults.origin[0], defaults.origin[1], 0]);
    if (parsed) parsedByTarget.set('origin', parsed);
    const binding = createTimelineBinding('origin', parsed);
    if (binding) bindings.push(binding);
  }
  const scalePayload = extractAnimationPayload(obj.scale);
  if (scalePayload) {
    const parsed = parseTimelineAnimation(scalePayload.animation, defaults.scale);
    if (parsed) parsedByTarget.set('scale', parsed);
    const binding = createTimelineBinding('scale', parsed);
    if (binding) bindings.push(binding);
  }
  const anglesPayload = extractAnimationPayload(obj.angles);
  if (anglesPayload) {
    const parsed = parseTimelineAnimation(anglesPayload.animation, defaults.angles);
    if (parsed) parsedByTarget.set('angles', parsed);
    const binding = createTimelineBinding('angles', parsed);
    if (binding) bindings.push(binding);
  }
  const alphaPayload = extractAnimationPayload(obj.alpha);
  if (alphaPayload) {
    const parsed = parseTimelineAnimation(alphaPayload.animation, [defaults.alpha]);
    if (parsed) parsedByTarget.set('alpha', parsed);
    const binding = createTimelineBinding('alpha', parsed);
    if (binding) bindings.push(binding);
  }
  const colorPayload = extractAnimationPayload(obj.color);
  if (colorPayload) {
    const parsed = parseTimelineAnimation(colorPayload.animation, [defaults.color.r, defaults.color.g, defaults.color.b]);
    if (parsed) parsedByTarget.set('color', parsed);
    const binding = createTimelineBinding('color', parsed);
    if (binding) bindings.push(binding);
  }
  for (const parsed of parsedByTarget.values()) {
    if (parsed.animation.name) continue;
    const parentTarget = parseTimelineTarget(parsed.parentKey);
    if (!parentTarget) continue;
    const parent = parsedByTarget.get(parentTarget);
    if (!parent || !parent.animation.name) continue;
    parsed.animation.setName(parent.animation.name);
  }
  return bindings;
}

function collectParentOriginTimelineBinding(
  obj: SceneObject,
  defaults: TimelineDefaults,
): { target: 'origin'; animation: ParsedTimelineAnimation['animation'] } | null {
  const rawParentAnim = (obj as unknown as Record<string, unknown>)._parentOriginAnimation;
  if (!rawParentAnim || typeof rawParentAnim !== 'object') return null;
  const parsed = parseTimelineAnimation(rawParentAnim, [defaults.origin[0], defaults.origin[1], 0]);
  if (!parsed) return null;
  return {
    target: 'origin',
    animation: parsed.animation,
  };
}

function applyDynamicBindingsToLayer(
  layer: EngineLayer,
  obj: SceneObject,
  projectJson: ProjectJson | null | undefined,
  defaults: TimelineDefaults,
): void {
  const scriptBindings = collectPropertyScriptBindings(obj, projectJson);
  const timelineBindings = collectPropertyTimelineBindings(obj, defaults);
  const scriptTargets = new Set<string>(scriptBindings.map((item) => item.target));
  const filteredTimelineBindings = timelineBindings.filter((item) => !scriptTargets.has(item.target));
  const hasOriginBinding = scriptTargets.has('origin')
    || filteredTimelineBindings.some((binding) => binding.target === 'origin');
  if (!hasOriginBinding) {
    const parentOriginBinding = collectParentOriginTimelineBinding(obj, defaults);
    if (parentOriginBinding) {
      filteredTimelineBindings.push(parentOriginBinding);
    }
  }
  if (scriptBindings.length > 0) {
    layer.setScriptBindings(createScriptBindingsForLayer(layer, scriptBindings));
  }
  if (filteredTimelineBindings.length > 0) {
    layer.setTimelinePropertyBindings(filteredTimelineBindings);
  }
}

function hasMediaPlaybackVisibilityScript(obj: SceneObject): boolean {
  const visible = obj.visible as { script?: unknown } | undefined;
  return typeof visible?.script === 'string' && visible.script.includes('mediaPlaybackChanged');
}

export function hasRuntimeBindings(obj: SceneObject): boolean {
  const fields = [obj.origin, obj.scale, obj.angles, obj.color, obj.alpha, obj.visible];
  for (const field of fields) {
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      const payload = field as Record<string, unknown>;
      if (typeof payload.script === 'string') return true;
      if (payload.animation) return true;
    }
  }
  return false;
}

type ImageModelLoadContext = {
  modelFullscreen: boolean;
  modelAutosize: boolean;
  modelSolidlayer: boolean;
  modelPassthrough: boolean;
  modelWidth: number | undefined;
  modelHeight: number | undefined;
  modelCropoffset: [number, number] | null;
  modelPuppetPath: string | null;
  imagePath: string;
  materialBlend: BlendMode | undefined;
  materialReceivesLighting: boolean;
};

async function resolveImageModelContext(
  pkg: PkgData | null,
  basePath: string,
  imagePath: string,
  io?: ResourceIO,
): Promise<ImageModelLoadContext> {
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  const context: ImageModelLoadContext = {
    modelFullscreen: false,
    modelAutosize: false,
    modelSolidlayer: false,
    modelPassthrough: false,
    modelWidth: undefined,
    modelHeight: undefined,
    modelCropoffset: null,
    modelPuppetPath: null,
    imagePath,
    materialBlend: undefined,
    materialReceivesLighting: false,
  };
  if (!imagePath.endsWith('.json')) {
    return context;
  }
  const modelData = await resourceIO.loadJsonWithAssets<{
    material?: string;
    fullscreen?: boolean;
    solidlayer?: boolean;
    passthrough?: boolean;
    autosize?: boolean;
    cropoffset?: string;
    puppet?: string;
    width?: number;
    height?: number;
  }>(imagePath);
  if (!modelData) {
    return context;
  }
  context.modelFullscreen = modelData.fullscreen === true;
  context.modelAutosize = modelData.autosize === true;
  context.modelSolidlayer = modelData.solidlayer === true;
  context.modelPassthrough = modelData.passthrough === true;
  context.modelWidth = modelData.width;
  context.modelHeight = modelData.height;
  if (modelData.cropoffset) {
    const coParts = modelData.cropoffset.split(/\s+/).map(Number);
    if (coParts.length >= 2 && coParts.every((n) => !isNaN(n))) {
      context.modelCropoffset = [coParts[0], coParts[1]];
    }
  }
  if (modelData.puppet) {
    context.modelPuppetPath = modelData.puppet;
  }
  if (!modelData.material) {
    return context;
  }
  const materialData = await loadJsonFile<{ passes?: Array<{ textures?: string[]; blending?: string; combos?: Record<string, unknown> }> }>(
    pkg,
    modelData.material,
    basePath
  );
  if (materialData?.passes?.[0]?.textures?.[0]) {
    const textureName = materialData.passes[0].textures[0];
    if (pkg) {
      const fileList = listFiles(pkg);
      const possiblePaths = [textureName, `materials/${textureName}`, `${textureName}.tex`, `materials/${textureName}.tex`];
      for (const path of possiblePaths) {
        if (fileList.includes(path)) {
          context.imagePath = path;
          break;
        }
      }
    }
    if (context.imagePath === imagePath) {
      context.imagePath = textureName.includes('/') ? textureName : `materials/${textureName}`;
      if (!context.imagePath.endsWith('.tex')) context.imagePath += '.tex';
    }
  }
  context.materialBlend = parseMaterialBlendMode(materialData?.passes?.[0]?.blending);
  const lightingComboRaw = materialData?.passes?.[0]?.combos?.LIGHTING;
  context.materialReceivesLighting = Number(lightingComboRaw) === 1;
  return context;
}

function bindDynamicRtTextures(
  layer: EngineLayer & { addDynamicTextureBind: (passIndex: number, slotIndex: number, texturePath: string) => void },
  effects: SceneEffect[] | undefined,
  normalizeAlias: boolean,
): void {
  if (!effects) return;
  let passIdx = 0;
  for (const effect of effects) {
    if (!effect.passes) continue;
    for (const pass of effect.passes) {
      const passTextures = pass.textures || [];
      for (let slotIdx = 0; slotIdx < passTextures.length; slotIdx++) {
        const texPathRaw = passTextures[slotIdx];
        const texPath = normalizeAlias && texPathRaw
          ? normalizeMediaTextureAlias(texPathRaw)
          : texPathRaw;
        if (texPath && texPath.startsWith('_rt_')) {
          layer.addDynamicTextureBind(passIdx, slotIdx, texPath);
        }
      }
      passIdx++;
    }
  }
}

async function loadSolidLayer(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  materialBlend: BlendMode | undefined,
  materialReceivesLighting: boolean,
  initialVisible: boolean,
  projectJson?: ProjectJson | null,
): Promise<boolean> {
  return loadSolidLayerBranch({
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
  });
}

async function loadComposeOrFullscreenLayer(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  materialBlend: BlendMode | undefined,
  materialReceivesLighting: boolean,
  initialVisible: boolean,
  projectJson?: ProjectJson | null,
): Promise<boolean> {
  return loadComposeOrFullscreenLayerBranch({
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
  });
}

async function loadPlainImageLayer(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  imagePath: string,
  sceneSize: { width: number; height: number },
  modelFullscreen: boolean,
  modelWidth: number | undefined,
  modelHeight: number | undefined,
  materialBlend: BlendMode | undefined,
  materialReceivesLighting: boolean,
  initialVisible: boolean,
  basePath: string,
  projectJson?: ProjectJson | null,
  io?: ResourceIO,
): Promise<boolean> {
  return loadPlainImageLayerBranch({
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
  });
}

export async function loadImageObject(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  result: LoadResult,
  isDependencyLayer: boolean = false,
  projectJson?: ProjectJson | null,
  io?: ResourceIO,
): Promise<boolean> {
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  if (!obj.image) return false;

  // 可见性：visible=false 的层仍然加载（脚本可能在运行时切换可见性），
  // 只是 initialVisible 设为 false，不参与渲染直到脚本激活。
  const isVisible = resolveUserProperty(obj.visible, projectJson) !== false;
  const hasDynamicBindings = hasRuntimeBindings(obj);
  const hiddenByMediaPlayback = hasMediaPlaybackVisibilityScript(obj);
  const initialVisible = isVisible && !hiddenByMediaPlayback;
  const isAudioBarLayer = Number(obj.id) === 237 || String(obj.name || '').toLowerCase().includes('audio bar');
  if (isAudioBarLayer) {
    globalThis.console.log('[AudioBarDiag] loadImageObject visibility', {
      id: obj.id,
      name: obj.name,
      isVisible,
      isDependencyLayer,
      hasDynamicBindings,
      hiddenByMediaPlayback,
      initialVisible,
      visibleRaw: obj.visible,
    });
  }
  if (hiddenByMediaPlayback && isVisible) {
    console.log(`图层[${obj.name || obj.id}] 使用 mediaPlaybackChanged 可见性脚本，默认按停止状态隐藏`);
  }

  // 检测是否为有依赖的 solidlayer（需要加载为 FBO 混合目标，如 earthmap 地球）
  const hasDependencies = Array.isArray((obj as Record<string, unknown>).dependencies) &&
    ((obj as Record<string, unknown>).dependencies as number[]).length > 0;
  const isSolidlayerPath = obj.image.includes('solidlayer') || obj.image.includes('solid_instance_model');

  // 跳过特殊图层类型（但保留有依赖的 solidlayer）
  // composelayer / fullscreenlayer / projectlayer 现在支持加载（作为透明基础层 + 效果）
  if (isSolidlayerPath && !hasDependencies && !hasDynamicBindings && !initialVisible) {
    console.log(`跳过特殊图层: ${obj.name || obj.id} (${obj.image})`);
    return false;
  }

  // copybackground: true 表示该图层使用当前已渲染的场景作为输入纹理（g_Texture0）
  // 后处理图层可直接使用 _rt_FullFrameBuffer；普通图层 fallback 到自身纹理
  if (obj.copybackground) {
    console.log(`copybackground 图层: ${obj.name || obj.id}`);
  }

  let imagePath = obj.image;
  let materialBlend: BlendMode | undefined;
  let materialReceivesLighting = false;

  // 模型属性（来自 model JSON 的 fullscreen/solidlayer/passthrough 等标志）
  // 参考 linux-wallpaperengine ModelParser.cpp
  let modelFullscreen = false;
  let modelAutosize = false;
  let modelSolidlayer = false;
  let modelPassthrough = false;
  let modelWidth: number | undefined;
  let modelHeight: number | undefined;

  // 如果是模型文件，提取纹理路径、材质混合模式和模型属性
  let modelCropoffset: [number, number] | null = null;
  let modelPuppetPath: string | null = null;  // puppet .mdl 文件路径
  {
    const modelContext = await resolveImageModelContext(pkg, basePath, imagePath, resourceIO);
    modelFullscreen = modelContext.modelFullscreen;
    modelAutosize = modelContext.modelAutosize;
    modelSolidlayer = modelContext.modelSolidlayer;
    modelPassthrough = modelContext.modelPassthrough;
    modelWidth = modelContext.modelWidth;
    modelHeight = modelContext.modelHeight;
    modelCropoffset = modelContext.modelCropoffset;
    modelPuppetPath = modelContext.modelPuppetPath;
    imagePath = modelContext.imagePath;
    materialBlend = modelContext.materialBlend;
    materialReceivesLighting = modelContext.materialReceivesLighting;
  }
  if (isSolidlayerPath) {
    modelSolidlayer = true;
  }

  // 跳过无依赖的 solidlayer（有依赖的 solidlayer 继续加载）
  if (modelSolidlayer && !hasDependencies && !hasDynamicBindings && !initialVisible) {
    console.log(`跳过 solidlayer 图层: ${obj.name || obj.id} (${obj.image})`);
    return false;
  }

  // 跳过 passthrough 图层（无效果的 passthrough 不渲染任何内容）
  // 参考 linux-wallpaperengine CImage::setup: "passthrough images without effects are bad"
  if (modelPassthrough && (!obj.effects || obj.effects.length === 0)) {
    console.log(`跳过 passthrough 图层(无效果): ${obj.name || obj.id}`);
    return false;
  }

  if (modelSolidlayer) {
    return loadSolidLayer(engine, pkg, obj, sceneSize, basePath, materialBlend, materialReceivesLighting, initialVisible, projectJson);
  }
  const composeOrFullscreenHandled = await loadComposeOrFullscreenLayer(
    engine,
    pkg,
    obj,
    sceneSize,
    basePath,
    materialBlend,
    materialReceivesLighting,
    initialVisible,
    projectJson
  );
  if (composeOrFullscreenHandled) {
    return true;
  }
  // composelayer/fullscreenlayer/projectlayer 不应 fallthrough 到普通图片加载路径
  // 即使效果加载失败，composelayer.json 也不是图片纹理
  const isSpecialLayer = obj.image.includes('composelayer') || obj.image.includes('fullscreenlayer') || obj.image.includes('projectlayer');
  if (isSpecialLayer) {
    return false;
  }

  // 加载 .tex 文件
  if (imagePath.endsWith('.tex')) {
    // ★ 缓存key：basePath + imagePath（同一 tex 文件只解码一次）
    const imgCacheKey = `${basePath}::${imagePath}`;

    // 检查缓存
    let cached = imageTexCache.get(imgCacheKey);
    if (!cached) {
      // 检查是否有正在进行的解码
      let pending = imageTexPending.get(imgCacheKey);
      if (!pending) {
        // 创建解码 Promise
        pending = (async () => {
          const texData = await loadTexData(pkg, imagePath, basePath);
          if (!texData) return null;
          const texInfo = parseTex(new Uint8Array(texData).buffer);
          if (!texInfo) return null;
          const imageTexUrlOptions = { alphaMode: 'opaque' as const };
          if (texInfo.format === 'mp4') {
            // 视频不缓存，直接返回
            const videoUrl = await texToUrl(texInfo, imageTexUrlOptions);
            return videoUrl ? { texUrl: videoUrl, texInfo } : null;
          }
          let rawRGBA: { data: Uint8Array; width: number; height: number } | undefined;
          if (texInfo.format === 'raw') {
            const view = new DataView(texInfo.imageData.buffer, texInfo.imageData.byteOffset);
            rawRGBA = {
              width: view.getUint32(0, true),
              height: view.getUint32(4, true),
              data: new Uint8Array(texInfo.imageData.buffer, texInfo.imageData.byteOffset + 8),
            };
          }
          const texUrl = await texToUrl(texInfo, imageTexUrlOptions);
          if (!texUrl) return null;
          const result = { texUrl, texInfo, rawRGBA };
          imageTexCache.set(imgCacheKey, result);
          return result;
        })();
        imageTexPending.set(imgCacheKey, pending);
      }
      const result = await pending;
      imageTexPending.delete(imgCacheKey);
      if (!result) return false;
      cached = result;
    }

    const { texUrl, texInfo, rawRGBA } = cached;
    const directTexture = rawRGBA
      ? engine.backend.createTextureFromRGBA(rawRGBA.data, rawRGBA.width, rawRGBA.height)
      : undefined;

    // ★ TEX 内嵌视频检测：如果 TEX 容器中存储的是 MP4 视频，创建 VideoLayer
    if (texInfo.format === 'mp4') {
      console.log(`图层[${obj.name}]: 检测到内嵌 MP4 视频 (${texInfo.width}x${texInfo.height})`);

      // 使用 cover 缩放策略保持视频原始比例：
      // 视频等比缩放至恰好覆盖整个视口，多余部分裁剪
      const videoW = texInfo.width || 1920;
      const videoH = texInfo.height || 1080;
      const videoCoverScale = Math.max(engine.width / videoW, engine.height / videoH);
      const videoDisplayW = videoW * videoCoverScale;
      const videoDisplayH = videoH * videoCoverScale;

      const videoLayer = createVideoLayer({
        id: `layer-${obj.id || Math.random().toString(36).substr(2, 9)}`,
        name: obj.name || 'Video Layer',
        width: videoDisplayW,
        height: videoDisplayH,
        x: engine.width / 2,
        y: engine.height / 2,
        source: texUrl,
        loop: true,
        muted: true,
        autoplay: true,
        ...getWeLayerMetadata(obj),
      });

      await engine.addLayer(videoLayer);
      console.log(`视频图层已添加: ${obj.name} (cover: ${videoDisplayW.toFixed(0)}x${videoDisplayH.toFixed(0)})`);
      return true;
    }

    // 确定图层尺寸（严格参考 linux-wallpaperengine CImage.cpp 的尺寸确定逻辑）
    // Linux CImage::getSize() 优先返回纹理真实尺寸，obj.size 仅在无纹理时使用
    // 优先级：fullscreen → 纹理尺寸 → obj.size → 模型 width/height → 默认 100x100
    let size: [number, number];
    if (modelFullscreen) {
      // fullscreen 图层使用整个场景尺寸（CImage.cpp line 84-88）
      size = [sceneSize.width, sceneSize.height];
    } else if (texInfo.width > 0 && texInfo.height > 0) {
      // 纹理真实尺寸（CImage.cpp getSize() → texture->getRealWidth/Height）
      // 对于 spritesheet 动画纹理 (TEXS), CTexture::getWidth/Height 返回单帧尺寸
      if (texInfo.spritesheetCols && texInfo.spritesheetCols > 1) {
        const frameW = texInfo.spritesheetFrameWidth || (texInfo.width / texInfo.spritesheetCols);
        const frameH = texInfo.spritesheetFrameHeight || (texInfo.height / (texInfo.spritesheetRows || 1));
        size = [frameW, frameH];
      } else {
        size = [texInfo.width, texInfo.height];
      }
    } else {
      const specifiedSize = parseVector2(obj.size);
      if (specifiedSize && specifiedSize[0] > 0 && specifiedSize[1] > 0) {
        size = specifiedSize;
      } else if (modelWidth && modelHeight) {
        // 回退到模型 JSON 中的 width/height（CImage.cpp line 75-79）
        size = [modelWidth, modelHeight];
      } else {
        size = [100, 100];
      }
    }

    // alpha 可能是 0-1 范围或 0-255 范围，根据值判断
    const alpha = resolveObjectAlpha(obj.alpha, projectJson, 1);

    // 判断是否为背景图层：仅用于日志和单通道图层跳过逻辑
    const isBackground = modelFullscreen || (sceneSize.width > 0 && sceneSize.height > 0 &&
      Math.abs(size[0] - sceneSize.width) < 2 && Math.abs(size[1] - sceneSize.height) < 2);
    // ★ 图层的 fullscreen 标志（控制视差）：仅使用模型属性，不使用尺寸比较
    // Linux CImage::render() line 475: "!this->getImage().model->fullscreen"
    // 场景尺寸的非 fullscreen 图层（如 scale>1 的背景层）仍应有视差效果
    const isLayerFullscreen = modelFullscreen;

    // 跳过非背景的单通道图层（遮罩/位移图）
    // 这类图层在 WE 中通常依赖 copybackground 获取场景内容作为 g_Texture0，
    // 其自身的单通道纹理只是遮罩或位移数据，不应作为彩色内容直接渲染
    // 例外：依赖层（FBO 源）不跳过
    if (!isBackground && !isDependencyLayer && texInfo.channels === 1 && obj.effects && obj.effects.length > 0) {
      console.log(`跳过单通道效果覆盖层: ${obj.name || obj.id} (channels=${texInfo.channels}, ${obj.effects.length} effects, 需要 copybackground)`);
      return false;
    }

    const transform = resolveObjectTransform(obj, sceneSize);
    // 使用 cover 缩放策略对齐场景坐标（与背景/粒子一致）
    const { coverScale, overflow, sceneOffset } = computeSceneLayout(engine.width, engine.height, sceneSize);
    const displayWidth = size[0] * coverScale;
    const displayHeight = size[1] * coverScale;
    const [layerOffsetX, layerOffsetY] = resolveLayerSceneOffset(obj.alignment, overflow.x, overflow.y);

    // 通用效果加载（数据驱动）
    // 通用图层效果加载
    const effectResult = obj.effects
      ? await loadGenericImageEffects(engine, pkg, basePath, obj.effects, [size[0], size[1]], parseObjColor(obj.color, projectJson), projectJson, String(obj.name ?? obj.id))
      : { passes: [], fbos: [] };
    const effectPasses = effectResult.passes;
    if (isAudioBarLayer) {
      globalThis.console.log('[AudioBarDiag] effect load result', {
        id: obj.id,
        name: obj.name,
        effectCount: Array.isArray(obj.effects) ? obj.effects.length : 0,
        producedPasses: effectResult.passes.length,
        producedFbos: effectResult.fbos.length,
      });
    }

    // 解析混合模式（由 parseBlendMode 统一处理）
    const objectBlend = parseBlendMode(obj);
    let blendMode = objectBlend ?? materialBlend;

    // ===== colorBlendMode > 0: 仅保留对暂不支持模式的拦截 =====
    if (typeof obj.colorBlendMode === 'number' && obj.colorBlendMode > 0) {
      const blendModeValue = obj.colorBlendMode;
      const supportedColorBlendModes = new Set([1, 2, 5, 6, 7, 9, 10, 31]);
      if (!supportedColorBlendModes.has(blendModeValue)) {
        console.warn(`图层[${obj.name}]: colorBlendMode=${blendModeValue} 需要 g_Texture4 (暂不支持)，跳过整个图层`);
        return false; // 未创建图层，返回 false 以允许后续预览图回退
      }
      if (objectBlend) {
        blendMode = objectBlend;
        console.log(`图层[${obj.name}]: colorBlendMode=${blendModeValue} → GPU blending: ${objectBlend}`);
      }
    }

    // ★ 位置计算
    const layerOrigin: [number, number] = modelFullscreen
      ? [sceneSize.width / 2, sceneSize.height / 2]
      : transform.origin;
    const x = layerOrigin[0] * coverScale - layerOffsetX;
    const y = layerOrigin[1] * coverScale - layerOffsetY;
    const parallaxDepth = transform.parallaxDepth;

    // ★ Puppet mesh 加载：如果模型有 puppet .mdl 文件，解析 mesh 数据
    let puppetMeshConfig: { vertices: Float32Array; uvs: Float32Array; indices: Uint16Array } | undefined;
    let puppetAnimConfig: ImageLayerConfig['puppetAnimation'] | undefined;
    if (modelPuppetPath) {
      try {
        const mdlBuffer = await resourceIO.loadBinary(modelPuppetPath);
        if (mdlBuffer) {
          const meshData = parseMdl(mdlBuffer);
          if (meshData && meshData.triangleCount > 0) {
            const scaledVertices = new Float32Array(meshData.vertices.length);
            for (let vi = 0; vi < meshData.vertices.length; vi += 3) {
              scaledVertices[vi] = meshData.vertices[vi] * coverScale;
              scaledVertices[vi + 1] = meshData.vertices[vi + 1] * coverScale;
              scaledVertices[vi + 2] = meshData.vertices[vi + 2] * coverScale;
            }
            puppetMeshConfig = {
              vertices: scaledVertices,
              uvs: meshData.uvs,
              indices: meshData.indices,
            };

            if (meshData.bones && meshData.animations && meshData.boneIndices && meshData.boneWeights) {
              const mappedAnimLayers = (obj.animationlayers ?? []).map((al: Record<string, unknown>) => {
                const visible = al.visible as Record<string, unknown> | undefined;
                let startOffset: number | undefined;
                if (visible && typeof visible === 'object' && typeof visible.script === 'string') {
                  const sp = visible.scriptproperties as Record<string, unknown> | undefined;
                  if (sp) {
                    const pct = Number(sp.percentage);
                    if (Number.isFinite(pct) && pct > 0 && pct <= 1) startOffset = pct;
                  }
                }
                const rawAnim = getScriptFieldValue(al.animation);
                const rawRate = getScriptFieldValue(al.rate);
                const rawBlend = getScriptFieldValue(al.blend);
                return {
                  animation: rawAnim != null ? Number(rawAnim) : undefined,
                  rate: rawRate != null ? Number(rawRate) : undefined,
                  blend: rawBlend != null ? Number(rawBlend) : undefined,
                  visible: typeof visible === 'boolean' ? visible : (visible?.value as boolean | undefined),
                  name: al.name as string | undefined,
                  startOffset,
                };
              });
              puppetAnimConfig = {
                bones: meshData.bones,
                animations: meshData.animations,
                boneIndices: meshData.boneIndices,
                boneWeights: meshData.boneWeights,
                boneIndices4: meshData.boneIndices4,
                boneWeights4: meshData.boneWeights4,
                morphTargets: meshData.morphTargets,
                animationLayers: mappedAnimLayers,
                coverScale,
              };
              console.log(`图层[${obj.name}]: 加载 puppet mesh (${meshData.vertexCount} 顶点, ${meshData.triangleCount} 三角形) + 骨骼动画 (${meshData.bones.length} 骨骼, ${meshData.animations.length} 动画)`);
            } else {
              console.log(`图层[${obj.name}]: 加载 puppet mesh (${meshData.vertexCount} 顶点, ${meshData.triangleCount} 三角形)`);
            }
          }
        }
      } catch (e) {
        console.warn(`图层[${obj.name}]: puppet mesh 加载失败:`, e);
      }
    }

    // Puppet warp 动画层：回退到 puppet_sway 效果
    if (obj.animationlayers && obj.animationlayers.length > 0 && effectPasses.length === 0 && !puppetAnimConfig) {
      const animLayer = obj.animationlayers.find(a => a.visible !== false);
      if (animLayer) {
        const rate = animLayer.rate || 1.0;
        const swayPass = createPuppetSwayPass(rate);
        effectPasses.push(swayPass);
        console.log(`图层[${obj.name}]: 添加 puppet 摆动效果 (rate=${rate}) [无骨骼动画数据，使用 sway 回退]`);
      }
    }

    // ===== 解析 brightness/color (参考 CImage 属性) =====
    const objBrightness = obj.brightness !== undefined ? obj.brightness : 1.0;
    const objColor = parseObjColor(obj.color, projectJson);

    const layer = createImageLayer({
      id: `layer-${obj.id || Math.random().toString(36).substr(2, 9)}`,
      name: obj.name || 'Image Layer',
      width: displayWidth,
      height: displayHeight,
      x,
      y,
      sourceSize: [size[0], size[1]],
      sourceOrigin: [layerOrigin[0], layerOrigin[1]],
      sourceScale: toSourceScale(transform.scaleVec),
      sourceAngles: toSourceAngles(transform.anglesVec),
      coverScale,
      sceneOffset,
      zIndex: (obj as Record<string, unknown>)._zIndex as number ?? obj.id ?? 0,
      blendMode,
      opacity: alpha,
      source: directTexture ?? texUrl,
      effectPasses,
      effectFbos: effectResult.fbos,
      parallaxDepth,
      fullscreen: isLayerFullscreen,
      textureSize: [size[0], size[1]],
      puppetMesh: puppetMeshConfig,
      puppetAnimation: puppetAnimConfig,
      brightness: objBrightness,
      color: objColor,
      userAlpha: alpha,
      colorBlendMode: obj.colorBlendMode,
      alignment: obj.alignment,
      receiveLighting: materialReceivesLighting,
      passthrough: modelPassthrough,
      copybackground: obj.copybackground,
      spritesheetCols: texInfo.spritesheetCols,
      spritesheetRows: texInfo.spritesheetRows,
      spritesheetFrames: texInfo.spritesheetFrames,
      spritesheetDuration: texInfo.spritesheetDuration,
      spritesheetFrameWidth: texInfo.spritesheetFrameWidth,
      spritesheetFrameHeight: texInfo.spritesheetFrameHeight,
      spritesheetTexWidth: texInfo.width,
      spritesheetTexHeight: texInfo.height,
      visible: initialVisible,
      ...getWeLayerMetadata(obj),
    });
    applyDynamicBindingsToLayer(layer, obj, projectJson, {
      ...buildTimelineDefaults(layerOrigin, transform.scaleVec, transform.anglesVec, alpha, objColor),
    });

    await engine.addLayer(layer);

    // ===== 依赖层 FBO 注册（无论可见性） =====
    if (isDependencyLayer) {
      const objId = (obj as Record<string, unknown>).id;
      const fboName = `_rt_imageLayerComposite_${objId}_a`;
      layer.registerAsFboOutput(fboName);
      if (!isVisible) {
        layer.visible = false;
      }
      console.log(`[FBO] 依赖层 "${obj.name}" (id=${objId}) 注册为 FBO: ${fboName} (visible=${isVisible})`);
    }

    // ===== 动态纹理绑定：_rt_ 引用 =====
    bindDynamicRtTextures(layer, obj.effects, true);

    return true;
  }

  return loadPlainImageLayer(
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
    resourceIO,
  );
}
