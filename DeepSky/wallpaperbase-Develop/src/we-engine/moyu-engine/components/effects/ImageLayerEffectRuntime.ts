import type { IRenderBackend } from '../../rendering/interfaces/IRenderBackend';
import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type { EffectPipeline } from './EffectPipeline';
import { FBORegistry } from './FBORegistry';

export interface ImageLayerEffectRuntimeContext {
  id: string;
  deltaTime: number;
  backend: IRenderBackend;
  baseTexture: ITexture | null;
  isDynamicInput?: boolean;
  copybackgroundUVRegion?: { u0: number; v0: number; u1: number; v1: number };
  needsDiffPass?: boolean;
  effectPipeline: EffectPipeline | null;
  outputMaterial: IMaterial | null;
  setupPerFrameUniforms: (material: IMaterial, time: number, passIndex: number, deltaTime: number) => void;
}

export interface ImageLayerEffectRuntimeResult {
  outputTexture: ITexture | null;
}

export function updateImageLayerEffectRuntime(
  ctx: ImageLayerEffectRuntimeContext,
): ImageLayerEffectRuntimeResult {
  if (!ctx.effectPipeline || !ctx.baseTexture) {
    return { outputTexture: null };
  }

  const outputTexture = ctx.effectPipeline.execute(ctx.deltaTime, {
    baseTexture: ctx.baseTexture,
    isDynamicInput: ctx.isDynamicInput,
    copybackgroundUVRegion: ctx.copybackgroundUVRegion,
    needsDiffPass: ctx.needsDiffPass,
    onSetupPerFrameUniforms: (material, time, passIndex) => {
      ctx.setupPerFrameUniforms(material, time, passIndex, ctx.deltaTime);
    },
    resolveExternalBinding: (name) => {
      const layerTex = FBORegistry.getLayerOutputTexture(name);
      if (layerTex) return { texture: layerTex };
      const globalTex = FBORegistry.getGlobalTexture(name);
      if (globalTex) return { texture: globalTex };
      return null;
    },
  });

  if (ctx.outputMaterial && outputTexture) {
    ctx.outputMaterial.setTexture(outputTexture);
  }
  return { outputTexture };
}
