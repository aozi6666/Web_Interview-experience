import type { IMaterial, UniformValue } from '../../rendering/interfaces/IMaterial';
import { ScriptEngine, type ScriptProgram } from '../scripting/ScriptEngine';
import type { GenericEffectPassConfig } from './EffectPipeline';

export interface EffectUniformScriptEntry {
  uniformName: string;
  program: ScriptProgram;
  initDeferred?: { value: unknown; retries: number };
}

export interface EffectUniformTimelineEntry {
  uniformName: string;
  animation: import('../animation/TimelineAnimation').TimelineAnimation;
  kind: UniformValueKind;
}

export interface EffectUniformDriverState {
  scripts: Map<number, EffectUniformScriptEntry[]>;
  timelines: Map<number, EffectUniformTimelineEntry[]>;
}

const enum UniformValueKind {
  Scalar = 0,
  Array = 1,
  Vec = 2,
  Color = 3,
}

function detectUniformValueKind(value: UniformValue | undefined): UniformValueKind {
  if (Array.isArray(value)) return UniformValueKind.Array;
  if (value && typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if ('r' in obj || 'g' in obj || 'b' in obj) {
      return UniformValueKind.Color;
    }
    return UniformValueKind.Vec;
  }
  return UniformValueKind.Scalar;
}

export function initEffectUniformDriverState(options: {
  passes: GenericEffectPassConfig[];
  engine: import('../../scenario/Engine').Engine | null;
  layerProxy: Record<string, unknown>;
}): EffectUniformDriverState {
  const scripts = new Map<number, EffectUniformScriptEntry[]>();
  const timelines = new Map<number, EffectUniformTimelineEntry[]>();
  for (let passIndex = 0; passIndex < options.passes.length; passIndex += 1) {
    const pass = options.passes[passIndex];
    const scriptBindings = pass.uniformScriptBindings ?? [];
    const timelineBindings = pass.uniformTimelineBindings ?? [];
    if (timelineBindings.length > 0) {
      const entries: EffectUniformTimelineEntry[] = [];
      for (const binding of timelineBindings) {
        if (!binding?.uniformName || !binding.animation) continue;
        const initial = pass.uniforms?.[binding.uniformName] as UniformValue | undefined;
        entries.push({
          uniformName: binding.uniformName,
          animation: binding.animation,
          kind: detectUniformValueKind(initial),
        });
      }
      if (entries.length > 0) {
        timelines.set(passIndex, entries);
      }
    }
    if (scriptBindings.length === 0) continue;
    const entries: EffectUniformScriptEntry[] = [];
    for (const binding of scriptBindings) {
      if (!binding.uniformName || !binding.script) continue;
      const program = ScriptEngine.instance.compile({
        code: binding.script,
        scriptProperties: binding.scriptProperties ?? {},
        engine: options.engine,
        thisLayer: options.layerProxy,
        thisObject: options.layerProxy,
        thisScene: ScriptEngine.instance.createSceneApi(options.engine),
      });
      const initial = binding.value ?? pass.uniforms[binding.uniformName];
      let initOk = false;
      try {
        const initResult = program.init(initial);
        if (initResult !== undefined) {
          pass.uniforms[binding.uniformName] = initResult as UniformValue;
        }
        initOk = true;
      } catch {
        // init may fail when parent layers are not yet available; defer to first update
      }
      const entry: EffectUniformScriptEntry = { uniformName: binding.uniformName, program };
      if (!initOk) {
        entry.initDeferred = { value: initial, retries: 0 };
      }
      entries.push(entry);
    }
    if (entries.length > 0) {
      scripts.set(passIndex, entries);
    }
  }
  return { scripts, timelines };
}

export function applyTimelineUniforms(
  material: IMaterial,
  timelines: EffectUniformTimelineEntry[] | undefined,
  deltaTime: number,
): void {
  if (!timelines || timelines.length === 0) return;
  for (const item of timelines) {
    item.animation.update(deltaTime);
    const value = item.animation.sample();
    switch (item.kind) {
      case UniformValueKind.Scalar: {
        const current = material.getUniform(item.uniformName) as number | undefined;
        material.setUniform(item.uniformName, value[0] ?? current ?? 0);
        break;
      }
      case UniformValueKind.Array: {
        const current = material.getUniform(item.uniformName);
        const base = Array.isArray(current) ? current : [];
        const next = [...base];
        for (let i = 0; i < next.length; i += 1) {
          next[i] = value[i] ?? next[i];
        }
        material.setUniform(item.uniformName, next as UniformValue);
        break;
      }
      case UniformValueKind.Vec: {
        const current = material.getUniform(item.uniformName);
        const nextObj: Record<string, unknown> = (current && typeof current === 'object')
          ? { ...(current as unknown as Record<string, unknown>) }
          : { x: 0, y: 0, z: 0, w: 0 };
        const keys = ['x', 'y', 'z', 'w'] as const;
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (key in nextObj) {
            nextObj[key] = value[i] ?? Number(nextObj[key] ?? 0);
          }
        }
        material.setUniform(item.uniformName, nextObj as unknown as UniformValue);
        break;
      }
      case UniformValueKind.Color: {
        const current = material.getUniform(item.uniformName);
        const nextObj: Record<string, unknown> = (current && typeof current === 'object')
          ? { ...(current as unknown as Record<string, unknown>) }
          : { r: 0, g: 0, b: 0, a: 0 };
        nextObj.r = value[0] ?? Number(nextObj.r ?? 0);
        nextObj.g = value[1] ?? Number(nextObj.g ?? 0);
        nextObj.b = value[2] ?? Number(nextObj.b ?? 0);
        if ('a' in nextObj) {
          nextObj.a = value[3] ?? Number(nextObj.a ?? 0);
        }
        material.setUniform(item.uniformName, nextObj as unknown as UniformValue);
        break;
      }
    }
  }
}

export function applyScriptedUniforms(
  material: IMaterial,
  scripts: EffectUniformScriptEntry[] | undefined,
  engine: import('../../scenario/Engine').Engine | null,
  deltaTime: number,
): void {
  if (!scripts || scripts.length === 0) return;
  ScriptEngine.instance.beginFrame(engine, deltaTime);
  for (const item of scripts) {
    const deferredInit = item.initDeferred;
    if (deferredInit) {
      try {
        const initResult = item.program.init(deferredInit.value);
        if (initResult !== undefined) {
          material.setUniform(item.uniformName, initResult as UniformValue);
        }
        item.initDeferred = undefined;
      } catch {
        deferredInit.retries += 1;
        if (deferredInit.retries >= 10) {
          item.initDeferred = undefined;
        }
      }
    }
    const current = material.getUniform(item.uniformName);
    try {
      const next = item.program.update(current);
      if (next !== undefined) {
        material.setUniform(item.uniformName, next as UniformValue);
      }
    } catch {
      // update 异常静默
    }
  }
}
