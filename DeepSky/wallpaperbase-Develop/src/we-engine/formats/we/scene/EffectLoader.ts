/**
 * Wallpaper Engine 效果加载器
 *
 * 负责 uniform 映射、puppet 摆动效果和通用图像效果加载
 */

import { Engine } from 'moyu-engine';
import { ImageLayer } from 'moyu-engine/scenario/layers';
import { loadWEEffectShaders, type UniformMaterialInfo } from '../shader/ShaderTranspiler';
import { type UniformValue } from 'moyu-engine/rendering/interfaces/IMaterial';
import { BuiltinEffect } from 'moyu-engine/rendering/interfaces/IRenderBackend';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import { TextureFilter, TextureWrap } from 'moyu-engine/rendering/interfaces/ITexture';
import { getTransparent1x1Texture, getWhite1x1Texture } from 'moyu-engine/rendering/EffectDefaults';
import type { GenericEffectPassConfig } from 'moyu-engine/components/effects';
import type { EffectLoadResult, ProjectJson, SceneEffect } from '../LoaderTypes';
import { isScriptField, parsePropertyColor, parseTimelineAnimation, resolveUserProperty } from '../LoaderUtils';
import type { ScriptBindingConfig } from 'moyu-engine/components/scripting';
import {
  loadAssetTexture,
  loadJsonFile,
  tryCreateTexture,
} from '../TextureLoader';
import { parsePkg, extractTextFile } from '../PkgLoader';
import { fetchText, ResourceIO } from '../ResourceIO';
import { logLoaderVerbose, normalizeMediaTextureAlias } from '../LoaderUtils';

type PkgData = ReturnType<typeof parsePkg>;
const console = { ...globalThis.console, log: logLoaderVerbose };
const LIGHTSHAFTS_DIAG = false;

type LightShaftsDiagPayload = {
  effectName: string;
  source: 'effectObject' | 'imageEffect';
  layerName?: string;
  objectId?: number | string;
  combos?: Record<string, unknown>;
  uniforms?: Record<string, UniformValue>;
};

export function logLightShaftsDebugInfo(payload: LightShaftsDiagPayload): void {
  if (!LIGHTSHAFTS_DIAG) return;
  if (payload.effectName !== 'lightshafts') return;
  const u = payload.uniforms ?? {};
  globalThis.console.log('[LightShaftsDiag]', {
    source: payload.source,
    layerName: payload.layerName ?? '',
    objectId: payload.objectId ?? '',
    combos: payload.combos ?? {},
    g_Point0: u['g_Point0'],
    g_Point1: u['g_Point1'],
    g_Point2: u['g_Point2'],
    g_Point3: u['g_Point3'],
    g_Intensity: u['g_Intensity'],
  });
}

function normalizeUserTextureName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveSystemUserTextureBindingName(
  name: string | undefined,
  type: string | undefined,
): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return null;
  if (typeof type !== 'string' || normalizeUserTextureName(type) !== 'system') return null;
  const normalizedName = normalizeUserTextureName(name);
  if (normalizedName === '$mediathumbnail' || normalizedName === 'mediathumbnail') {
    return '_rt_AlbumCover';
  }
  if (normalizedName === '$mediapreviousthumbnail' || normalizedName === 'mediapreviousthumbnail') {
    return '_rt_AlbumCoverPrevious';
  }
  return null;
}

// ==================== 通用 uniform 映射 ====================

/**
 * 将 constantshadervalues 自动映射为 uniform 对象
 * 使用着色器注释中的 "material" 字段建立 key → GLSL uniform 名称的映射
 */
export function autoMapUniforms(
  values: Record<string, unknown>,
  uniformDefaults: Record<string, UniformMaterialInfo>,
  projectJson?: ProjectJson | null
): Record<string, UniformValue> {
  const uniforms: Record<string, UniformValue> = {};
  // 跟踪哪些 uniform 已经从 constantshadervalues 中获得了实际值（非默认值）
  const setFromValues = new Set<string>();

  // 构建大小写不敏感的查找表：scene.json constantshadervalues 的 key 大小写可能与
  // shader 注释中的 "material" 字段不一致（如 "Strength" vs "strength"）
  const valuesLowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(values)) {
    valuesLowerMap.set(k.toLowerCase(), v);
  }

  for (const [materialKey, info] of Object.entries(uniformDefaults)) {
    // 先尝试精确匹配，再尝试大小写不敏感匹配
    let rawValue = values[materialKey] ?? valuesLowerMap.get(materialKey.toLowerCase());

    // WE 用户属性对象格式: {"user":"propertyName","value":default}
    // 优先从 project.json 读取 user 对应值，找不到再回退到 value
    let resolvedFromProject = false;
    if (rawValue !== null && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const rawObj = rawValue as Record<string, unknown>;
      if ('user' in rawObj && rawObj.user !== undefined) {
        const userField = rawObj.user;
        const propName = typeof userField === 'string'
          ? userField
          : (typeof userField === 'object' && userField !== null && 'name' in userField
            ? String((userField as Record<string, unknown>).name ?? '')
            : '');
        const propValue = (propName && projectJson?.general?.properties?.[propName])
          ? projectJson.general.properties[propName].value
          : undefined;
        resolvedFromProject = propValue !== undefined;
        rawValue = propValue !== undefined ? propValue : rawObj.value;
      } else if ('value' in rawObj) {
        rawValue = rawObj.value;
      }
    }

    if (rawValue !== undefined) {
      // parsePropertyColor 遵循 C++ PropertyColor::update() 的整数/浮点判定规则:
      // 无小数点 → 整数模式 → ÷255。这只对 project.json 属性值正确
      // (例如 schemecolor "0 85 255")，对 constantshadervalues 的 "1 1 1" 会错误地
      // 变成 (0.004, 0.004, 0.004) ≈ 黑色。因此仅在值来自 project.json 时使用。
      const isColorUniform = materialKey.toLowerCase().includes('color') || info.uniformName.toLowerCase().includes('color');
      if (isColorUniform && info.type === 'vec3' && typeof rawValue === 'string' && resolvedFromProject) {
        const parsedColor = parsePropertyColor(rawValue);
        if (parsedColor) {
          uniforms[info.uniformName] = parsedColor;
          setFromValues.add(info.uniformName);
          continue;
        }
      }
      let parsedValue = parseUniformValueByType(rawValue, info.type);
      parsedValue = flipPositionUniformY(parsedValue, info);
      parsedValue = flipYAxisOffsetUniform(parsedValue, info);
      uniforms[info.uniformName] = parsedValue;
      setFromValues.add(info.uniformName);
    } else if (info.defaultValue !== undefined) {
      // 只在该 uniform 尚未从实际值设置过的情况下才用默认值
      // 防止 label 键（如 "ui_editor_properties_direction"）不在 constantshadervalues 中时
      // 覆盖已由 material 键（如 "direction"）正确设置的值
      if (!setFromValues.has(info.uniformName)) {
        let parsedDefault = parseUniformValueByType(info.defaultValue, info.type);
        parsedDefault = flipPositionUniformY(parsedDefault, info);
        parsedDefault = flipYAxisOffsetUniform(parsedDefault, info);
        uniforms[info.uniformName] = parsedDefault;
      }
    }
  }

  return uniforms;
}

function flipPositionUniformY(value: UniformValue, info: UniformMaterialInfo): UniformValue {
  // 位置类型 uniform（如 twirl 的 center）在 WE 中使用 Y=0 顶部，
  // 渲染管线中使用的 UV 为 Three.js 约定（Y=0 底部），因此要翻转 Y。
  if (
    info.isPosition === true &&
    info.type === 'vec2' &&
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value
  ) {
    // 部分 shader 作者对 size/scale 类 uniform 也标注了 position:true（用于编辑器控件），
    // 但这些值不是 UV 坐标，不应翻转 Y。例如 u_FixedSize 是宽高比参数，翻转后圆变椭圆。
    const name = info.uniformName.toLowerCase();
    if (name.includes('size') || name.includes('scale')) {
      return value;
    }
    const pos = value as { x: number; y: number };
    return { x: pos.x, y: 1.0 - pos.y };
  }
  return value;
}

const Y_AXIS_OFFSET_UNIFORMS = new Set(['g_ReflectionOffset']);

function flipYAxisOffsetUniform(value: UniformValue, info: UniformMaterialInfo): UniformValue {
  // WE 的 Y 轴偏移量基于 Y-down 坐标系，WebGL 使用 Y-up，需要取反。
  if (Y_AXIS_OFFSET_UNIFORMS.has(info.uniformName) && typeof value === 'number') {
    return -value;
  }
  return value;
}

// WE perspective 效果中 step(0.5, a_TexCoord.y) 在 DirectX (Y-down) 和 WebGL (Y-up)
// 中选择相反的半区，因此 g_Top 和 g_Bottom 需要交换。
const Y_AXIS_SWAP_PAIRS: Array<[string, string]> = [
  ['g_Top', 'g_Bottom'],
];

function swapYAxisPairUniforms(uniforms: Record<string, UniformValue>): void {
  for (const [a, b] of Y_AXIS_SWAP_PAIRS) {
    if (a in uniforms && b in uniforms) {
      const tmp = uniforms[a];
      uniforms[a] = uniforms[b];
      uniforms[b] = tmp;
    }
  }
}

/**
 * 根据 GLSL 类型解析值
 */
function parseUniformValueByType(value: string | number | boolean | unknown, type: string): UniformValue {
  if (typeof value === 'number') {
    switch (type) {
      case 'vec2':
        return { x: value, y: value };
      case 'vec3':
        return { r: value, g: value, b: value };
      case 'vec4':
        return { x: value, y: value, z: value, w: value };
      default:
        return value;
    }
  }
  if (typeof value === 'boolean') {
    return value ? 1.0 : 0.0;
  }
  // 非字符串类型（对象、数组等）转为字符串再解析
  const strValue = typeof value === 'string' ? value : String(value ?? '0');
  const parts = strValue.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

  switch (type) {
    case 'float':
    case 'int':
      return parts[0] ?? 0;
    case 'vec2':
      return { x: parts[0] ?? 0, y: parts[1] ?? 0 };
    case 'vec3':
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0 };
    case 'vec4':
      return { x: parts[0] ?? 0, y: parts[1] ?? 0, z: parts[2] ?? 0, w: parts[3] ?? 0 };
    default:
      return parts.length === 1 ? parts[0] : parts[0] ?? 0;
  }
}

function uniformValueToNumberArray(value: UniformValue): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.map((item) => Number(item));
  if (value && typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if ('r' in obj || 'g' in obj || 'b' in obj || 'a' in obj) {
      return [
        Number(obj.r ?? 0),
        Number(obj.g ?? 0),
        Number(obj.b ?? 0),
        Number(obj.a ?? 0),
      ];
    }
    return [
      Number(obj.x ?? 0),
      Number(obj.y ?? 0),
      Number(obj.z ?? 0),
      Number(obj.w ?? 0),
    ];
  }
  return [0];
}

// ==================== Puppet 摆动效果 ====================

/**
 * 创建 puppet 摆动效果 pass
 *
 * 用于模拟 WE puppet warp 骨骼动画产生的轻微摆动。
 * 通过在片段着色器中对 UV 进行正弦波位移实现：
 * - 位移从图像顶部（连接处，UV.y=1）到底部（末端，UV.y=0）递增
 * - 使用二次曲线使运动更自然（末端摆幅更大）
 *
 * @param rate 动画速率倍数（来自 animationlayers.rate）
 */
export function createPuppetSwayPass(rate: number): GenericEffectPassConfig {
  return {
    effectName: 'puppet_sway',
    builtinEffect: BuiltinEffect.PuppetSway,
    uniforms: {
      'g_Texture0': 0 as unknown as UniformValue,  // 由 ImageLayer 自动绑定
      'g_Time': 0,
      'u_SwayAmplitude': 0.1,  // UV 空间振幅（约 7% 图像宽度）
      'u_SwayFrequency': rate,  // 频率（rate=1.3 → ~1.6 rad/s，约 0.25Hz 周期）
    },
    needsClear: false,
  };
}

// ==================== 通用效果加载 ====================

/**
 * 通用加载图像图层效果
 * 替代旧的 parseEffects()，对所有效果使用相同的数据驱动流程：
 * 1. 加载效果定义 JSON → 获取 replacementkey
 * 2. 加载原始 WE 着色器 → 转译为 WebGL GLSL
 * 3. 自动映射 constantshadervalues → uniform
 * 4. 加载效果纹理
 */
export async function loadGenericImageEffects(
  engine: Engine,
  pkg: PkgData | null,
  basePath: string,
  effects: SceneEffect[],
  imageSize: [number, number],
  layerColor?: { r: number; g: number; b: number },
  projectJson?: ProjectJson | null,
  layerDebugName?: string,
): Promise<EffectLoadResult> {
  const passes: GenericEffectPassConfig[] = [];
  const fbos: EffectLoadResult['fbos'] = [];
  const io = new ResourceIO(pkg, basePath);
  const runtimeLightDefines = engine.lightManager.getShaderLightDefines();
  const shaderLanguage = engine.backend.getShaderLanguage();
  if (shaderLanguage !== 'glsl_webgl') {
    console.warn(`后端着色器语言 ${shaderLanguage} 暂未实现 WE 效果转译，跳过图像效果加载`);
    return { passes, fbos };
  }

  // ===== 辅助：加载单个纹理到 uniform =====
  async function loadTextureToUniforms(
    slotIndex: number, texPath: string, targetUniforms: Record<string, UniformValue>
  ): Promise<boolean> {
    if (slotIndex === 0) return true; // g_Texture0 由 ImageLayer 自动绑定
    const uniformName = `g_Texture${slotIndex}`;
    const resolvedPath = normalizeMediaTextureAlias(texPath);
    if (resolvedPath.startsWith('_rt_')) {
      const fboLayer = ImageLayer.getFboLayer(resolvedPath);
      if (fboLayer) {
        const fboTex = fboLayer.getOutputTexture();
        if (fboTex) { targetUniforms[uniformName] = fboTex; return true; }
      }
      targetUniforms[uniformName] = getTransparent1x1Texture(engine.backend);
      return false;
    } else {
      let texture: ITexture | null = await tryCreateTexture(engine, pkg, basePath, resolvedPath);
      if (!texture) {
        texture = await loadAssetTexture(engine, resolvedPath, {
          wrap: resolvedPath.includes('noise') ? 'repeat' : undefined,
        });
      }
      if (texture) {
        const lp = resolvedPath.toLowerCase();
        const isMask = lp.includes('mask') || lp.includes('opacity');
        if (!isMask) {
          texture.setWrap(TextureWrap.Repeat, TextureWrap.Repeat);
        }
        texture.setFilter(TextureFilter.Linear, TextureFilter.Linear);
        targetUniforms[uniformName] = texture;
        return true;
      } else {
        targetUniforms[uniformName] = getWhite1x1Texture(engine.backend);
        return false;
      }
    }
  }

  // ===== 辅助：为 uniform 设置 g_TextureNResolution =====
  function setTextureResolutionUniforms(targetUniforms: Record<string, UniformValue>) {
    targetUniforms['g_Texture0Resolution'] = { x: imageSize[0], y: imageSize[1], z: imageSize[0], w: imageSize[1] };
    for (const [uniformName, value] of Object.entries(targetUniforms)) {
      const texSlotMatch = uniformName.match(/^g_Texture(\d+)$/);
      if (!texSlotMatch) continue;
      const slot = parseInt(texSlotMatch[1], 10);
      if (slot === 0) continue;
      const resUniform = `g_Texture${slot}Resolution`;
      if (!targetUniforms[resUniform]) {
        const tex = value as ITexture;
        if (tex && typeof tex === 'object' && 'width' in tex && 'height' in tex) {
          targetUniforms[resUniform] = { x: tex.width, y: tex.height, z: tex.width, w: tex.height };
        }
      }
    }
  }

  // ===== zcompat 着色器名 → workshop ID 映射 =====
  // zcompat 目录包含已手动修复兼容性问题的着色器，按 workshop ID 组织
  // 不同壁纸可能使用不同 workshop ID 分发同一着色器，因此需要按名称查找
  const ZCOMPAT_NAME_MAP: Record<string, string> = {
    'Simple_Audio_Bars': '2084198056',
    'pixelate': '2078835426',
  };

  // workshop shader 名与 zcompat 文件名可能不一致（如 simple_gradient_audio_bar -> Simple_Audio_Bars）
  const ZCOMPAT_SHADER_ALIAS: Record<string, string> = {
    simple_gradient_audio_bar: 'Simple_Audio_Bars',
    enhanced_simple_audio_bars: 'Simple_Audio_Bars',
  };

  function _getZcompatIds(workshopId: string, shaderName: string): string[] {
    const ids: string[] = [workshopId]; // 先尝试实际 workshop ID
    const normalizedName = ZCOMPAT_SHADER_ALIAS[shaderName] || shaderName;
    const mapped = ZCOMPAT_NAME_MAP[normalizedName];
    if (mapped && mapped !== workshopId) ids.push(mapped); // 再尝试名称映射的 ID
    return ids;
  }

  // ===== 辅助：加载 shader (含回退策略) =====
  // effectDirName: 效果的基础目录名（如 "godrays"），pass shader 文件名可能不同（如 "godrays_cast"）
  async function loadShaderWithFallback(
    shaderName: string,
    combos: Record<string, number>,
    extraDefines: Record<string, number>,
    availableTextureSlots: number[],
    preloadedSources?: { vert: string; frag: string },
    effectDirName?: string,
  ) {
    // 首先用 effectDirName（如果提供）作为目录定位，shaderName 作为文件名
    let shaders = await loadWEEffectShaders(shaderName, combos, extraDefines, runtimeLightDefines, availableTextureSlots, preloadedSources, effectDirName);
    if (!shaders && !effectDirName) {
      // 仅在没有显式 effectDirName 时才尝试回退（有 effectDirName 说明目录已确定）
      const fallbackNames: string[] = [];
      const stripped = shaderName.replace(/_+$/, '');
      if (stripped !== shaderName) fallbackNames.push(stripped);
      // 逐级去除末尾 _segment 尝试（如 blur_gaussian_x → blur_gaussian → blur）
      const parts = stripped.split('_');
      for (let i = parts.length - 1; i >= 1; i--) {
        const candidate = parts.slice(0, i).join('_');
        if (candidate !== stripped && candidate.length > 0 && !fallbackNames.includes(candidate)) {
          fallbackNames.push(candidate);
        }
      }
      for (const fallback of fallbackNames) {
        shaders = await loadWEEffectShaders(fallback, combos, extraDefines, runtimeLightDefines, availableTextureSlots);
        if (shaders) {
          console.log(`效果 ${shaderName} → 使用回退名称 "${fallback}" 加载成功`);
          break;
        }
      }
    }
    if (!shaders && effectDirName) {
      // effectDirName 路径失败时，也尝试把 shaderName 当目录名（单 pass 效果）
      shaders = await loadWEEffectShaders(shaderName, combos, extraDefines, runtimeLightDefines, availableTextureSlots, preloadedSources);
    }
    // 有 effectDirName 但仍失败时，也尝试逐级去除后缀回退
    // （如 bloom 效果目录下的 blur_gaussian_x → 尝试 blur_gaussian 在 blur 目录）
    if (!shaders) {
      const stripped = shaderName.replace(/_+$/, '');
      const parts = stripped.split('_');
      for (let i = parts.length - 1; i >= 1 && !shaders; i--) {
        const candidate = parts.slice(0, i).join('_');
        if (candidate.length > 0 && candidate !== shaderName) {
          // 用候选名同时作为 shader 文件名和目录名尝试
          shaders = await loadWEEffectShaders(candidate, combos, extraDefines, runtimeLightDefines, availableTextureSlots);
          if (shaders) {
            console.log(`效果 ${shaderName} → 使用回退名称 "${candidate}" 加载成功`);
          }
        }
      }
    }
    return shaders;
  }

  // ===== 辅助：合并 effect.json bind 数组为 {slot → name} 映射，并覆盖 scene.json binds =====
  function mergeBinds(
    effectBinds?: Array<{ name: string; index: number }>,
    sceneBinds?: Record<string, string>,
  ): Record<number, string> | undefined {
    const merged: Record<number, string> = {};
    // effect.json 的 bind 数组: [{name: "_rt_HalfCompoBuffer1", index: 0}, ...]
    if (effectBinds) {
      for (const b of effectBinds) {
        merged[b.index] = b.name;
      }
    }
    // scene.json 的 binds 对象（覆盖）: {"1": "previous"}
    if (sceneBinds) {
      for (const [k, v] of Object.entries(sceneBinds)) {
        merged[Number(k)] = v;
      }
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  function hasDynamicShaderUniformUsage(vertexShader: string, fragmentShader: string): boolean {
    const source = `${vertexShader}\n${fragmentShader}`;
    return /\b(g_Time|g_Daytime|g_AudioSpectrum\w*|g_PointerPosition\w*|g_ParallaxPosition)\b/.test(source);
  }

  function hasExternalRtBind(binds?: Record<number, string>): boolean {
    if (!binds) return false;
    for (const bindName of Object.values(binds)) {
      if (typeof bindName === 'string' && bindName.startsWith('_rt_')) {
        return true;
      }
    }
    return false;
  }

  // ===== effect.json 完整类型 =====
  interface EffectJsonData {
    replacementkey?: string;
    passes?: Array<{
      material?: string;
      target?: string;
      command?: string;
      bind?: Array<{ name: string; index: number }>;
    }>;
    fbos?: Array<{ name: string; scale?: number; fit?: number; format?: string }>;
  }

  // ===== material.json 类型 =====
  interface MaterialJsonData {
    passes?: Array<{ shader?: string }>;
  }

  for (const effect of effects) {
    const isVisible = resolveUserProperty(effect.visible as SceneEffect['visible'], projectJson) !== false;
    if (!isVisible || !effect.file) continue;
    try {
    const effectPassesBefore = passes.length;

    // scene.json 中每个 effect 的 per-pass 覆盖数据
    const scenePasses = effect.passes || [];

    // 1. 加载效果定义 JSON（含 passes、fbos、replacementkey）
    const effectData: EffectJsonData | null = await io.loadJsonWithAssets<EffectJsonData>(effect.file);

    // 确定效果名称和效果目录名
    // effectName: 用于 shader 文件名查找（如 "caustics"）
    // effectDirName: 用于 shader 目录路径（如 "watercaustics"）
    // 区别：effect.json 的 replacementkey 是 shader 文件名（如 "caustics"），
    // 但实际目录可能不同（如 "watercaustics"）。两者必须分开使用。
    let effectName: string;
    let effectDirName: string | undefined;
    // workshop 效果路径: effects/workshop/<id>/<effectDir>/effect.json
    const workshopEffectMatch = effect.file.match(/effects\/workshop\/\d+\/([^/]+)\//);
    const simpleEffectMatch = effect.file.match(/effects\/([^/]+)\//);
    const effectPathCapture = workshopEffectMatch?.[1]
      ?? (simpleEffectMatch?.[1] !== 'workshop' ? simpleEffectMatch?.[1] : undefined);
    if (effectData?.replacementkey) {
      effectName = effectData.replacementkey;
      // 从 effect.file 路径提取真实目录名（可能与 replacementkey 不同）
      effectDirName = effectPathCapture;
    } else {
      effectName = effectPathCapture ?? effect.file.replace(/^.*\//, '').replace(/\.json$/, '');
    }
    if (!effectData) {
      console.warn(
        `[EffectLoader] effect.json 加载失败: file=${effect.file}, effectName=${effectName}, effectDirName=${effectDirName || '(none)'}`
      );
    }

    // 效果定义中的 pass 列表（每个 pass 有独立的 material/shader）
    const effectDefPasses = effectData?.passes || [];

    // 收集 FBO 定义
    if (effectData?.fbos) {
      for (const fbo of effectData.fbos) {
        // 避免重复添加同名 FBO
        if (!fbos.find(f => f.name === fbo.name)) {
          fbos.push({ name: fbo.name, scale: fbo.scale ?? 1, fit: fbo.fit });
        }
      }
    }

    // workshop 着色器预加载信息
    const workshopMatch = effect.file.match(/effects\/workshop\/(\d+)\//);
    const workshopId = workshopMatch?.[1];
    // effect.file 的目录前缀（如 "effects/godrays/"），用于解析 material 相对路径
    const effectDir = effect.file.replace(/[^/]+$/, '');

    // PKG 着色器头文件已在壁纸加载入口全局预注册（见 loadWallpaperFromPath）

    // ===== 确定总 pass 数量 =====
    // C++ 逻辑: effect.json 定义了 N 个 pass (每个有 material/shader)，
    // scene.json 提供 N 个 per-pass 覆盖 (combos, textures, constantshadervalues)。
    // 使用 effect.json 的 pass 数量作为权威来源；scene.json 按索引匹配。
    const numPasses = Math.max(effectDefPasses.length, scenePasses.length);

    for (let pi = 0; pi < numPasses; pi++) {
      const defPass = effectDefPasses[pi];   // effect.json 中的定义（可能不存在）
      const scenePass = scenePasses[pi] || {};  // scene.json 中的覆盖

      // ===== 命令类型 pass (copy/swap) 无需自定义 shader =====
      // effect.json 中的 pass 可能是命令类型（如 motionblur 的 copy pass），
      // 这类 pass 没有 material 字段，仅包含 command/target/source。
      // 使用直通着色器创建 pass，让 ImageLayer 的 copy/swap 命令处理器能正常工作。
      const defCommand = (defPass?.command || '').toLowerCase();
      if (defCommand && !defPass?.material) {
        const target = (scenePass as Record<string, unknown>).target as string
          || defPass?.target;
        passes.push({
          effectName: `${effectName}_cmd${pi}`,
          builtinEffect: BuiltinEffect.Passthrough,
          uniforms: {},
          binds: undefined,
          command: defCommand as 'copy' | 'swap',
          target,
          isDynamic: false,
          needsClear: false,
          debugLabel: `${layerDebugName || 'unknown-layer'}::${effectName}[${pi}](${defCommand})`,
        });
        continue;
      }

      // ===== 确定此 pass 的 shader 名称 =====
      let passShaderName = effectName; // 默认使用效果名称
      if (defPass?.material) {
        // 从 material JSON 获取 shader 名称
        // material 路径如: "materials/effects/godrays_combine.json"
        //           或: "materials/workshop/2822917890/effects/blur_gaussian_x.json"（workshop 效果）
        // 尝试路径顺序:
        // 1. PKG 内 effectDir + material (壁纸自带的效果，相对路径)
        // 2. PKG 内直接 material 路径 (workshop 效果使用绝对路径，如 materials/workshop/...)
        // 3. /assets/effectDir/material (内置效果目录下的 material)
        // 4. /assets/material (全局 assets 目录下的 material)
        const normalizedMaterialPath = defPass.material.replace(/^\/+/, '');
        const materialPathCandidates = normalizedMaterialPath.startsWith('materials/')
          ? [normalizedMaterialPath]
          : [`${effectDir}${normalizedMaterialPath}`, normalizedMaterialPath];
        let matData: MaterialJsonData | null = null;
        for (const materialPath of materialPathCandidates) {
          matData = await loadJsonFile<MaterialJsonData>(pkg, materialPath, basePath)
            || await loadJsonFile<MaterialJsonData>(null, materialPath, '/assets');
          if (matData) break;
        }
        // 5. 跨效果目录回退：当 material 不在当前效果目录下时（如 bloom 引用 blur 目录的 material），
        //    从 material 文件名推导可能的效果目录并逐级尝试。
        //    例如: "materials/effects/blur_gaussian_x.json" → 尝试 effects/blur/ 目录
        if (!matData) {
          const matFileMatch = defPass.material.match(/(?:^|\/)([\w-]+)\.json$/);
          if (matFileMatch) {
            const matBaseName = matFileMatch[1]; // e.g. "blur_gaussian_x"
            const parts = matBaseName.split('_');
            // 从短到长尝试不同的效果目录前缀
            for (let pLen = 1; pLen < parts.length && !matData; pLen++) {
              const candidateDir = parts.slice(0, pLen).join('_'); // "blur", "blur_gaussian", ...
              matData = await loadJsonFile<MaterialJsonData>(null, `effects/${candidateDir}/${defPass.material}`, '/assets');
            }
          }
        }
        if (matData?.passes?.[0]?.shader) {
          // shader 路径如: "effects/godrays_combine" → shader 名称 "godrays_combine"
          const shaderPath = matData.passes[0].shader;
          const shaderMatch = shaderPath.match(/effects\/(.+)/);
          passShaderName = shaderMatch ? shaderMatch[1] : shaderPath;
        } else {
          // material JSON 加载失败时，从 material 文件路径推导 shader 名称
          // "materials/effects/blur_downsample4.json" → "blur_downsample4"
          // "materials/effects/blur_gaussian.json" → "blur_gaussian"
          const matPathMatch = defPass.material.match(/(?:^|\/)([\w-]+)\.json$/);
          if (matPathMatch) {
            passShaderName = matPathMatch[1];
            console.log(`效果 ${effectName} pass ${pi}: 从 material 路径推导 shader 名 "${passShaderName}"`);
          }
        }
      }

      // ===== 合并 combos =====
      const passCombos: Record<string, number> = { ...(scenePass.combos || {}) };
      const sceneTextures = scenePass.textures || [];
      const userTextureBindings: Record<number, string> = {};
      const passUserTextures = Array.isArray(scenePass.usertextures) ? scenePass.usertextures : [];
      for (let slotIdx = 0; slotIdx < passUserTextures.length; slotIdx++) {
        const userTexture = passUserTextures[slotIdx];
        if (!userTexture || typeof userTexture !== 'object') continue;
        const bindingName = resolveSystemUserTextureBindingName(
          typeof userTexture.name === 'string' ? userTexture.name : undefined,
          typeof userTexture.type === 'string' ? userTexture.type : undefined,
        );
        if (bindingName) {
          userTextureBindings[slotIdx] = bindingName;
        }
      }
      const extraDefines: Record<string, number> = {};
      // 注意：不在此处强制 BLENDMODE=0！
      // 着色器的 [COMBO] 注释声明了 BLENDMODE 的默认值（如 shine_combine: 默认=9 即 screen blend），
      // 这些默认值在 ShaderTranspiler 中通过 comboDefaults 自动提取并作为最低优先级合并。
      // 如果强制 BLENDMODE=0，会覆盖着色器默认值，导致 shine_combine 等着色器
      // 走入错误的分支（BLENDMODE==0 丢弃原始图像，只输出光线/光晕）。

      // ===== 检测可用纹理槽位 =====
      const passTextures = sceneTextures;
      const availableTextureSlots = new Set<number>();
      for (let i = 0; i < passTextures.length; i++) {
        if (passTextures[i]) availableTextureSlots.add(i);
      }
      for (const slotStr of Object.keys(userTextureBindings)) {
        const slot = Number(slotStr);
        if (Number.isFinite(slot)) availableTextureSlots.add(slot);
      }

      // ===== 加载 shader =====
      let preloadedSources: { vert: string; frag: string } | undefined;
      if (workshopId) {
        // 优先尝试 zcompat 目录（包含已修复兼容性问题的着色器）
        // zcompat 按 shader 名查找：不同壁纸可能用不同 workshop ID 打包同一着色器
        const zcompatShaderName = ZCOMPAT_SHADER_ALIAS[passShaderName] || passShaderName;
        // 用 effectName（效果目录名，如 "enhanced_simple_audio_bars"）判断是否经过别名化：
        //   effectName 在 ZCOMPAT_SHADER_ALIAS 中 → workshop 改了 effect 名（升级版本）。
        //   passShaderName 由 material.json 中 shader 字段决定，两个 workshop 可能都叫 Simple_Audio_Bars，
        //   但 effectName 才是真正区分新旧版本的依据（来自 scene.json 中的 effect 目录名）。
        // 别名化时只试 workshop 自身的 zcompat（通常不存在），不走 ZCOMPAT_NAME_MAP 兜底，
        // 让其直接回退到 PKG 自身的现代 shader。
        const isAliasedShader = effectName in ZCOMPAT_SHADER_ALIAS;
        const zcompatIds = isAliasedShader ? [workshopId] : _getZcompatIds(workshopId, passShaderName);
        for (const zId of zcompatIds) {
          if (preloadedSources) break;
          try {
            const zcompatVert = `/assets/zcompat/scene/shaders/${zId}/${zcompatShaderName}.vert`;
            const zcompatFrag = `/assets/zcompat/scene/shaders/${zId}/${zcompatShaderName}.frag`;
            const [zVertSrc, zFragSrc] = await Promise.all([fetchText(zcompatVert), fetchText(zcompatFrag)]);
            if (zVertSrc && zFragSrc) {
              preloadedSources = { vert: zVertSrc, frag: zFragSrc };
              console.log(`[zcompat] 使用兼容着色器: ${passShaderName} -> ${zcompatShaderName} (zcompat ${zId})`);
            }
          } catch { /* zcompat 不可用，忽略 */ }
        }

        // 回退到 PKG 提取的原始着色器
        if (!preloadedSources && pkg) {
          const vertPath = `shaders/workshop/${workshopId}/effects/${passShaderName}.vert`;
          const fragPath = `shaders/workshop/${workshopId}/effects/${passShaderName}.frag`;
          const vertSrc = extractTextFile(pkg, vertPath);
          const fragSrc = extractTextFile(pkg, fragPath);
          if (vertSrc && fragSrc) preloadedSources = { vert: vertSrc, frag: fragSrc };
        }
      }

      // 非 workshop 自定义着色器：从 PKG 的 shaders/effects/ 目录提取
      // 壁纸创作者可能自定义效果（如 rotate3d, rotate2d, t2 等），
      // 这些着色器存储在 PKG 的 shaders/effects/{name}.vert/frag 中，
      // 而非 /assets/effects/ 内置目录。
      if (!preloadedSources && pkg) {
        const vertPath = `shaders/effects/${passShaderName}.vert`;
        const fragPath = `shaders/effects/${passShaderName}.frag`;
        const vertSrc = extractTextFile(pkg, vertPath);
        const fragSrc = extractTextFile(pkg, fragPath);
        if (vertSrc && fragSrc) {
          preloadedSources = { vert: vertSrc, frag: fragSrc };
          console.log(`[PKG] 从 PKG 提取自定义着色器: ${passShaderName}`);
        }
      }

      // effectDirName 或 effectName 用作目录定位（如 "watercaustics"/"godrays"）
      // passShaderName 是具体 pass 的 shader 名（如 "caustics"/"godrays_cast"），用作文件名
      let shaders = await loadShaderWithFallback(
        passShaderName,
        passCombos,
        extraDefines,
        Array.from(availableTextureSlots),
        preloadedSources,
        effectDirName || effectName,
      );
      if (!shaders) {
        console.warn(
          `[EffectLoader] shader 加载失败，跳过 pass: effectFile=${effect.file}, effectName=${effectName}, effectDir=${effectDirName || effectName}, pass=${pi}, shader=${passShaderName}, workshopId=${workshopId || '(none)'}`
        );
        continue;
      }

      // 把着色器默认纹理槽位也纳入可用槽位，确保对应 combo（如 MASK/TIMEOFFSET）可被自动激活。
      let hasNewDefaultSlot = false;
      for (const uniformName of Object.keys(shaders.textureDefaults)) {
        const match = /^g_Texture(\d+)$/.exec(uniformName);
        if (!match) continue;
        const slot = Number(match[1]);
        if (!Number.isFinite(slot) || slot < 0) continue;
        if (!availableTextureSlots.has(slot)) {
          availableTextureSlots.add(slot);
          hasNewDefaultSlot = true;
        }
      }
      if (hasNewDefaultSlot) {
        const reloaded = await loadShaderWithFallback(
          passShaderName,
          passCombos,
          extraDefines,
          Array.from(availableTextureSlots),
          preloadedSources,
          effectDirName || effectName,
        );
        if (reloaded) {
          shaders = reloaded;
        }
      }

      // ===== 映射 uniform =====
      const values = scenePass.constantshadervalues || {};
      const uniforms = autoMapUniforms(values, shaders.uniformDefaults, projectJson);
      swapYAxisPairUniforms(uniforms);
      const uniformScriptBindings: ScriptBindingConfig[] = [];
      const uniformTimelineBindings: Array<{ uniformName: string; animation: import('moyu-engine/components/animation/TimelineAnimation').TimelineAnimation }> = [];
      const uniformDefaultsLower = new Map<string, { uniformName: string; type: string }>();
      for (const [materialKey, info] of Object.entries(shaders.uniformDefaults)) {
        uniformDefaultsLower.set(materialKey.toLowerCase(), { uniformName: info.uniformName, type: info.type });
      }
      for (const [materialKey, rawValue] of Object.entries(values)) {
        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
          const rawObj = rawValue as unknown as Record<string, unknown>;
          if ('animation' in rawObj && rawObj.animation) {
            const lowerInfo = uniformDefaultsLower.get(materialKey.toLowerCase());
            const info = shaders.uniformDefaults[materialKey];
            const uniformName = shaders.uniformDefaults[materialKey]?.uniformName
              ?? lowerInfo?.uniformName
              ?? materialKey;
            const uniformType = info?.type ?? lowerInfo?.type ?? 'float';
            const initialValue = uniforms[uniformName]
              ?? parseUniformValueByType(rawObj.value, uniformType);
            const base = uniformValueToNumberArray(initialValue);
            const parsedTimeline = parseTimelineAnimation(rawObj.animation, base);
            if (parsedTimeline) {
              uniformTimelineBindings.push({
                uniformName,
                animation: parsedTimeline.animation,
              });
            }
          }
        }
        if (!isScriptField(rawValue)) continue;
        const uniformName = shaders.uniformDefaults[materialKey]?.uniformName
          ?? uniformDefaultsLower.get(materialKey.toLowerCase())?.uniformName
          ?? materialKey;
        uniformScriptBindings.push({
          target: 'uniform',
          uniformName,
          script: rawValue.script,
          scriptProperties: rawValue.scriptproperties ?? {},
          value: rawValue.value,
        });
      }

      // 通用颜色回退：当场景未显式配置颜色参数时，使用图层 color。
      // 这覆盖 iris/shimmer 等常见颜色 uniform（g_EyeColor/u_color/color）。
      if (layerColor) {
        const valueKeys = new Set(Object.keys(values).map((k) => k.toLowerCase()));
        const hasExplicitColorValue = Array.from(valueKeys).some((k) =>
          k === 'color'
          || k.includes('ui_editor_properties_color')
          || k.includes('background_color')
          || k.includes('eyecolor')
        );
        const prefersColorFallback = !hasExplicitColorValue;
        if (prefersColorFallback) {
          if (uniforms['g_EyeColor'] === undefined) uniforms['g_EyeColor'] = layerColor;
          if (uniforms['u_color'] === undefined) uniforms['u_color'] = layerColor;
          if (uniforms['color'] === undefined) uniforms['color'] = layerColor;
          for (const [materialKey, info] of Object.entries(shaders.uniformDefaults)) {
            if (info.type !== 'vec3') continue;
            const mk = materialKey.toLowerCase();
            const uname = info.uniformName.toLowerCase();
            const isColorUniform =
              mk === 'color'
              || mk.includes('ui_editor_properties_color')
              || mk.includes('background_color')
              || mk.includes('eyecolor')
              || uname.includes('color');
            if (isColorUniform && uniforms[info.uniformName] === undefined) {
              uniforms[info.uniformName] = layerColor;
            }
          }
        }
      }

      // ===== 加载纹理 =====
      const textureSlotPaths: Record<number, string> = {};
      // 来源 A: shader 默认路径（仅当 uniform 在编译后的 shader 中实际存在时才采纳，
      //   避免 #if 条件编译排除的 uniform 默认值产生误判）
      for (const [uName, defaultPath] of Object.entries(shaders.textureDefaults)) {
        const slotMatch = uName.match(/g_Texture(\d+)/);
        if (!slotMatch) continue;
        const uniformPattern = new RegExp(`\\b${uName}\\b`);
        if (!uniformPattern.test(shaders.fragmentShader)) continue;
        textureSlotPaths[parseInt(slotMatch[1], 10)] = defaultPath;
      }
      // 来源 B: scene.json pass 中指定的纹理（覆盖）
      for (let i = 0; i < passTextures.length; i++) {
        if (passTextures[i]) textureSlotPaths[i] = passTextures[i]!;
      }
      // 来源 C: scene.json pass.usertextures（system）覆盖
      for (const [slotStr, bindingName] of Object.entries(userTextureBindings)) {
        textureSlotPaths[Number(slotStr)] = bindingName;
      }
      // 加载
      const textureSlotLoadState = new Map<number, boolean>();
      for (const [slotStr, texPath] of Object.entries(textureSlotPaths)) {
        const slot = parseInt(slotStr, 10);
        const loaded = await loadTextureToUniforms(slot, texPath, uniforms);
        textureSlotLoadState.set(slot, loaded);
      }

      if (effectName === 'gradientopacity') {
        const multiplyRaw = values['multiply'] ?? values['Multiply'] ?? uniforms['u_Multiply'];
        const multiply = typeof multiplyRaw === 'number' ? multiplyRaw : Number(multiplyRaw);
        const hasMaskTexture = textureSlotPaths[1] !== undefined;
        const maskLoaded = textureSlotLoadState.get(1) === true;
        if (!Number.isFinite(multiply) || multiply <= 0 || !hasMaskTexture || !maskLoaded) {
          console.warn(
            `[gradientopacity-fallback] 跳过 pass: multiply=${String(multiplyRaw)}, hasMaskTexture=${hasMaskTexture}, maskLoaded=${maskLoaded}`,
          );
          continue;
        }
      }

      // 设置 resolution uniform
      setTextureResolutionUniforms(uniforms);
      uniforms['g_Time'] = 0;

      // ===== 合并 binds (effect.json bind 数组 + scene.json binds 对象) =====
      let binds = mergeBinds(defPass?.bind, scenePass.binds);

      // _rt_ 纹理需每帧动态解析，加入 binds 触发 EffectPipeline 的 resolveExternalBinding
      for (const [slotStr, texPath] of Object.entries(textureSlotPaths)) {
        if (texPath.startsWith('_rt_')) {
          const slot = parseInt(slotStr, 10);
          if (!binds) binds = {};
          if (!(slot in binds)) {
            binds[slot] = texPath;
          }
        }
      }

      // ===== pass 命令和 target =====
      const command = (scenePass.command || defPass?.command || '')
        .toLowerCase() as 'copy' | 'swap' | 'render' | undefined;
      const target = scenePass.target || defPass?.target;
      const isDynamic = hasDynamicShaderUniformUsage(shaders.vertexShader, shaders.fragmentShader)
        || uniformScriptBindings.length > 0
        || uniformTimelineBindings.length > 0
        || hasExternalRtBind(binds);
      // 全屏 pass 默认可不 clear；若 shader 使用 discard，保守保留 clear 避免残留像素。
      const needsClear = /\bdiscard\b/.test(shaders.fragmentShader);

      passes.push({
        effectName: numPasses > 1 ? `${effectName}_pass${pi}` : effectName,
        vertexShader: shaders.vertexShader,
        fragmentShader: shaders.fragmentShader,
        uniforms,
        binds,
        command: command || 'render',
        target,
        isDynamic,
        needsClear,
        debugLabel: `${layerDebugName || 'unknown-layer'}::${effectName}[${pi}](${effect.file})`,
        uniformScriptBindings,
        uniformTimelineBindings,
      });
    }

    const producedPasses = passes.length - effectPassesBefore;
    console.log(`图像效果 ${effectName} 已加载 (produced=${producedPasses}/${numPasses}, ${fbos.length} fbos)`);
    } catch (e) {
      globalThis.console.warn(
        `[EffectLoader] 图像效果加载异常: layer=${layerDebugName || 'unknown-layer'}, effect=${effect.file}`,
        e
      );
      console.warn(`图像效果加载异常，已跳过: ${effect.file}`, e);
    }
  }

  if (passes.some((p) => /\bg_AudioSpectrum\w*\b/.test(`${p.vertexShader}\n${p.fragmentShader}`))) {
    engine.setAudioEnabled(true);
  }

  return { passes, fbos };
}
