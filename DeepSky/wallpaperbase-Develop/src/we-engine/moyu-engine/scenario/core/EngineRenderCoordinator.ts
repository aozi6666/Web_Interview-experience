import type { IRenderBackend, ISceneGraph, ITexture, RenderObject } from '../../rendering/interfaces/IRenderBackend';
import { FBORegistry } from '../../components/effects/FBORegistry';
import { RenderPhase, type Layer } from '../layers/Layer';
import type { Color4 } from '../../math';

export const enum RenderMode {
  Simple = 0,
  TwoPhase = 1,
  TwoPhaseWithBloom = 2,
}

export interface RenderPlan {
  mode: RenderMode;
  normalLayers: Layer[];
  postProcessLayers: Layer[];
  useHdrCapture: boolean;
  needsSceneCapture: boolean;
}

export function buildRenderPlan(input: {
  layers: Layer[];
  bloomConfig: { enabled?: boolean; hdrEnabled?: boolean } | null;
  bloomOverrideEnabled: boolean | null;
}): RenderPlan {
  const normalLayers: Layer[] = [];
  const postProcessLayers: Layer[] = [];
  for (const layer of input.layers) {
    if (layer.renderPhase === RenderPhase.PostProcess) {
      postProcessLayers.push(layer);
    } else {
      normalLayers.push(layer);
    }
  }

  const hasPostProcess = postProcessLayers.length > 0;
  const hasBloom = input.bloomOverrideEnabled === false
    ? false
    : input.bloomConfig?.enabled === true;
  const mode = hasBloom
    ? RenderMode.TwoPhaseWithBloom
    : (hasPostProcess ? RenderMode.TwoPhase : RenderMode.Simple);
  const needsSceneCapture = hasPostProcess || hasBloom
    || normalLayers.some((l) => l.needsSceneCapture());
  return {
    mode,
    normalLayers,
    postProcessLayers,
    useHdrCapture: hasBloom && input.bloomConfig?.hdrEnabled === true,
    needsSceneCapture,
  };
}

export function collectRenderObjects(layers: Layer[]): RenderObject[] {
  const objects: RenderObject[] = [];
  for (const layer of layers) {
    const layerObjects = layer.getRenderObjects();
    for (let i = 0; i < layerObjects.length; i += 1) {
      objects.push(layerObjects[i]);
    }
  }
  return objects;
}

export function buildSceneGraph(input: {
  width: number;
  height: number;
  backgroundColor: Color4;
  objects: RenderObject[];
  cameraTransform?: Float32Array;
}): ISceneGraph {
  const { width, height, backgroundColor, objects, cameraTransform } = input;
  return {
    width,
    height,
    backgroundColor,
    cameraTransform,
    objects,
  };
}

export function registerCapturedSceneTextures(
  backend: IRenderBackend,
  fullFrameTexture: ITexture | null,
  mipFallbackTexture: ITexture | null,
): void {
  if (fullFrameTexture) {
    FBORegistry.setGlobalTexture('_rt_FullFrameBuffer', fullFrameTexture);
  }
  const mipMappedCapture = backend.getMipMappedSceneCaptureTexture();
  if (mipMappedCapture) {
    FBORegistry.setGlobalTexture('_rt_MipMappedFrameBuffer', mipMappedCapture);
  } else if (mipFallbackTexture) {
    FBORegistry.setGlobalTexture('_rt_MipMappedFrameBuffer', mipFallbackTexture);
  }
}

export function updatePostProcessLayers(layers: Layer[], deltaTime: number): void {
  for (const layer of layers) {
    if (!layer.visible && !layer.shouldUpdateWhenInvisible()) continue;
    layer.update(deltaTime);
  }
}
