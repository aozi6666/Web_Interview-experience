import * as THREE from 'three';
import type { IRenderTarget } from '../interfaces/IRenderBackend';
import type { IMaterial } from '../interfaces/IMaterial';
import { ThreeMaterial } from './ThreeMaterial';
import { createEffectFallbackMaterial, renderEffectPassInternal } from './ThreeEffectRenderer';
import type { EffectPassOptions } from '../interfaces/IRenderBackend';

export interface EffectPassRuntimeState {
  fullscreenQuad: THREE.Mesh | null;
  fullscreenScene: THREE.Scene | null;
  fullscreenCamera: THREE.OrthographicCamera | null;
  effectFallbackMaterial: THREE.ShaderMaterial | null;
  effectPassErrorSignatures: Set<string>;
  effectPassLinkErrorSignatures: Set<string>;
  threeProgramDiagSignatures: Set<string>;
}

export interface RenderEffectPassRuntimeInput {
  renderer: THREE.WebGLRenderer | null;
  target: IRenderTarget;
  material: IMaterial;
  debugLabel?: string;
  verboseShaderLogs: boolean;
  logShaderErrorContext: (tag: string, source: string, log: string, radius?: number) => void;
  options?: EffectPassOptions;
  state: EffectPassRuntimeState;
}

export interface RenderEffectPassRuntimeResult extends EffectPassRuntimeState {}

export function renderEffectPassRuntime(
  input: RenderEffectPassRuntimeInput,
): RenderEffectPassRuntimeResult {
  if (!input.renderer) {
    return input.state;
  }
  const nativeTarget = (input.target as unknown as { _nativeTarget: THREE.WebGLRenderTarget })._nativeTarget;
  const nativeMaterial = (input.material as ThreeMaterial).getNativeMaterial();
  const shaderMat = nativeMaterial as THREE.ShaderMaterial & {
    userData?: Record<string, unknown>;
    uniforms?: Record<string, { value: unknown }>;
  };
  const result = renderEffectPassInternal({
    renderer: input.renderer,
    target: nativeTarget,
    nativeMaterial,
    shaderMaterialLike: shaderMat,
    debugLabel: input.debugLabel,
    fullscreenQuad: input.state.fullscreenQuad,
    fullscreenScene: input.state.fullscreenScene,
    fullscreenCamera: input.state.fullscreenCamera,
    effectFallbackMaterial: input.state.effectFallbackMaterial ?? createEffectFallbackMaterial(),
    effectPassErrorSignatures: input.state.effectPassErrorSignatures,
    effectPassLinkErrorSignatures: input.state.effectPassLinkErrorSignatures,
    threeProgramDiagSignatures: input.state.threeProgramDiagSignatures,
    verboseShaderLogs: input.verboseShaderLogs,
    logShaderErrorContext: input.logShaderErrorContext,
    clear: input.options?.clear !== false,
    resetTarget: input.options?.resetTarget !== false,
  });
  return {
    ...input.state,
    fullscreenQuad: result.fullscreenQuad,
    fullscreenScene: result.fullscreenScene,
    fullscreenCamera: result.fullscreenCamera,
    effectFallbackMaterial: result.effectFallbackMaterial,
  };
}
