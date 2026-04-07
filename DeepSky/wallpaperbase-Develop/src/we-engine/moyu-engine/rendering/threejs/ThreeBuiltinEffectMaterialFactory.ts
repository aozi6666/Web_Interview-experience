import { BuiltinEffect } from '../interfaces/IRenderBackend';
import { BlendMode, type IMaterial, type UniformValue } from '../interfaces/IMaterial';
import { BUILTIN_EFFECT_SHADERS } from './ThreeBuiltinShaders';
import { buildEffectMaterialProps } from '../EffectDefaults';

export function createBuiltinEffectMaterial(
  effect: BuiltinEffect,
  uniforms: Record<string, UniformValue>,
  createMaterial: (props: {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, UniformValue>;
    blendMode: BlendMode;
    transparent: boolean;
    depthTest: boolean;
    depthWrite: boolean;
  }) => IMaterial,
): IMaterial {
  const create = (
    vertexShader: string,
    fragmentShader: string,
    transparent: boolean,
  ): IMaterial => createMaterial(buildEffectMaterialProps({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent,
    blendMode: BlendMode.None,
  }));
  switch (effect) {
    case BuiltinEffect.SpritesheetExtract:
      return create(
        BUILTIN_EFFECT_SHADERS.spritesheetExtract.vertex,
        BUILTIN_EFFECT_SHADERS.spritesheetExtract.fragment,
        false,
      );
    case BuiltinEffect.CircleMask:
      return create(
        BUILTIN_EFFECT_SHADERS.circleMask.vertex,
        BUILTIN_EFFECT_SHADERS.circleMask.fragment,
        true,
      );
    case BuiltinEffect.Passthrough:
      return create(
        BUILTIN_EFFECT_SHADERS.passthrough.vertex,
        BUILTIN_EFFECT_SHADERS.passthrough.fragment,
        false,
      );
    case BuiltinEffect.PuppetSway:
      return create(
        BUILTIN_EFFECT_SHADERS.puppetSway.vertex,
        BUILTIN_EFFECT_SHADERS.puppetSway.fragment,
        true,
      );
    default:
      return create(
        BUILTIN_EFFECT_SHADERS.passthrough.vertex,
        BUILTIN_EFFECT_SHADERS.passthrough.fragment,
        false,
      );
  }
}
