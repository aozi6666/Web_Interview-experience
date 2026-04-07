import type { Engine } from 'moyu-engine';
import { ImageLayer } from 'moyu-engine/scenario/layers';
import { createTextLayer } from 'moyu-engine/scenario/layers';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from 'moyu-engine/components/scripting';
import { parsePkg } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import type { LoadResult, ProjectJson, SceneObject } from '../LoaderTypes';
import {
  computeSceneLayout,
  getWeLayerMetadata,
  resolveObjectTransform,
  resolveScriptPropertyUserValues,
  toSourceAngles,
  toSourceScale,
  toScriptBindingConfig,
} from '../LoaderUtils';
import { loadImageObject } from './ImageObjectLoader';
import { loadParticleObject } from '../particle/ParticleObjectLoader';
import { loadEffectObject } from './EffectObjectLoader';
import { loadTextObject } from './TextObjectLoader';
import { loadSoundObject } from './SoundObjectLoader';

type PkgData = ReturnType<typeof parsePkg>;

function hasRenderablePayload(obj: SceneObject): boolean {
  if (obj.image || obj.text || obj.particle) return true;
  if (obj.sound && obj.sound.length > 0) return true;
  if (obj.effects && obj.shape) return true;
  return false;
}

function hasScriptDrivenTransform(obj: SceneObject): boolean {
  return !!toScriptBindingConfig('origin', obj.origin)
    || !!toScriptBindingConfig('scale', obj.scale)
    || !!toScriptBindingConfig('angles', obj.angles);
}

function buildGhostScriptBindings(obj: SceneObject, projectJson: ProjectJson | null): ScriptBindingConfig[] {
  const bindings: ScriptBindingConfig[] = [];
  const candidates = [
    toScriptBindingConfig('origin', obj.origin),
    toScriptBindingConfig('scale', obj.scale),
    toScriptBindingConfig('angles', obj.angles),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (projectJson && candidate.scriptProperties) {
      resolveScriptPropertyUserValues(candidate.scriptProperties, projectJson);
    }
    bindings.push(candidate);
  }
  return bindings;
}

function createGhostParentLayer(
  engine: Engine,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  zIndex: number,
  projectJson: ProjectJson | null,
): void {
  const transform = resolveObjectTransform(obj, sceneSize);
  const originParsed = transform.origin;
  const { coverScale, sceneOffset } = computeSceneLayout(engine.width, engine.height, sceneSize);
  const x = originParsed[0] * coverScale - sceneOffset[0];
  const y = originParsed[1] * coverScale - sceneOffset[1];
  const layer = createTextLayer({
    id: `layer-${obj.id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || `Ghost Parent ${String(obj.id ?? '')}`,
    width: 1,
    height: 1,
    sourceSize: [1, 1],
    sourceOrigin: [originParsed[0], originParsed[1]],
    sourceScale: toSourceScale(transform.scaleVec) ?? [1, 1, 1],
    sourceAngles: toSourceAngles(transform.anglesVec) ?? [0, 0, 0],
    coverScale,
    sceneOffset,
    x,
    y,
    parallaxDepth: transform.parallaxDepth,
    zIndex,
    opacity: 0,
    visible: false,
    text: '',
    pointSize: 8,
    padding: 0,
    ...getWeLayerMetadata(obj),
  });
  const scriptBindings = buildGhostScriptBindings(obj, projectJson);
  if (scriptBindings.length > 0) {
    layer.setScriptBindings(createScriptBindingsForLayer(layer, scriptBindings));
  }
  engine.addLayer(layer);
}

export async function dispatchSceneObjects(
  engine: Engine,
  pkg: PkgData,
  sortedObjects: Record<string, unknown>[],
  sceneSize: { width: number; height: number },
  wallpaperPath: string,
  result: LoadResult,
  projectJson: ProjectJson | null,
  dependencyLayerIds: Set<number>,
  io?: ResourceIO,
): Promise<{ hasImageLayer: boolean }> {
  const resourceIO = io ?? new ResourceIO(pkg, wallpaperPath);
  ImageLayer.clearFboRegistry();
  let hasImageLayer = false;
  let loadedEffectObjects = 0;
  let loadedImageObjects = 0;
  let loadedParticleObjects = 0;
  let loadedTextObjects = 0;
  let loadedSoundObjects = 0;
  let loadedGhostParents = 0;
  let objectErrorCount = 0;
  let seenProjectLayer = false;
  const parentReferencedIds = new Set<number>();
  for (const rawObject of sortedObjects) {
    const parentId = (rawObject as SceneObject).parent;
    if (typeof parentId === 'number') {
      parentReferencedIds.add(parentId);
    }
  }
  const ghostLoadedIds = new Set<number>();
  const runLoaderWithGuard = async <T>(
    obj: SceneObject,
    label: string,
    loader: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await loader();
    } catch (e) {
      objectErrorCount += 1;
      console.warn(`${label}加载失败: ${obj.name || obj.id}`, e);
      return null;
    }
  };

  for (let idx = 0; idx < sortedObjects.length; idx++) {
    const obj = sortedObjects[idx] as SceneObject;
    (obj as Record<string, unknown>)._zIndex = idx;
    const imageRef = typeof obj.image === 'string' ? obj.image : '';
    if (imageRef.includes('projectlayer')) {
      seenProjectLayer = true;
    }
    const objId = (obj as Record<string, unknown>).id as number;
    // 声音对象也可能携带场景切换等脚本（绑在 origin 上），
    // 需要为其创建 ghost layer 来宿主脚本执行。
    const isSoundOnlyWithScript = !!(obj.sound && obj.sound.length > 0 && !obj.image && !obj.particle && !obj.text)
      && hasScriptDrivenTransform(obj);
    if (
      typeof objId === 'number'
      && !ghostLoadedIds.has(objId)
      && hasScriptDrivenTransform(obj)
      && (isSoundOnlyWithScript || (parentReferencedIds.has(objId) && !hasRenderablePayload(obj)))
    ) {
      const ghostCreated = await runLoaderWithGuard(obj, '脚本父容器', async () => {
        createGhostParentLayer(engine, obj, sceneSize, -100000 + idx, projectJson);
        return true;
      });
      if (ghostCreated) {
        ghostLoadedIds.add(objId);
        loadedGhostParents += 1;
      }
    }

    const isDependencyLayer = dependencyLayerIds.has(objId);

    if (obj.effects && obj.shape) {
      const loaded = await runLoaderWithGuard(obj, '效果对象', async () => {
        await loadEffectObject(engine, pkg, obj, sceneSize, wallpaperPath, resourceIO);
        return true;
      });
      if (loaded) loadedEffectObjects += 1;
    }

    if (obj.image) {
      const success = await runLoaderWithGuard(obj, '图像对象', async () => loadImageObject(
          engine,
          pkg,
          obj,
          sceneSize,
          wallpaperPath,
          result,
          isDependencyLayer,
          projectJson,
          resourceIO,
        ));
      if (success) {
        hasImageLayer = true;
        loadedImageObjects += 1;
      }
    }

    if (obj.particle) {
      const loaded = await runLoaderWithGuard(obj, '粒子', async () => {
        await loadParticleObject(engine, pkg, obj, sceneSize, wallpaperPath, result, projectJson);
        return true;
      });
      if (loaded) loadedParticleObjects += 1;
    }

    if (obj.text) {
      const loaded = await runLoaderWithGuard(obj, '文本对象', async () => {
        await loadTextObject(engine, pkg, obj, sceneSize, wallpaperPath, idx, projectJson, seenProjectLayer, resourceIO);
        return true;
      });
      if (loaded) loadedTextObjects += 1;
    }

    if (obj.sound && obj.sound.length > 0) {
      const loaded = await runLoaderWithGuard(obj, '音频对象', async () => {
        loadSoundObject(engine, pkg, obj, wallpaperPath, resourceIO);
        return true;
      });
      if (loaded) loadedSoundObjects += 1;
    }
  }

  console.log(
    `[LoaderSummary] 对象=${sortedObjects.length}, 图像=${loadedImageObjects}, 效果=${loadedEffectObjects}, `
    + `粒子=${loadedParticleObjects}, 文本=${loadedTextObjects}, 音频=${loadedSoundObjects}, `
    + `GhostParent=${loadedGhostParents}, `
    + `错误=${objectErrorCount}`,
  );
  return { hasImageLayer };
}
