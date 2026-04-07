import {
  parseComboDefaults,
  parseTextureDefaults,
  parseTextureCombos,
  parseUniformMaterialMap,
  isComboRequireSatisfied,
  type UniformMaterialInfo,
} from './ShaderMetadataParser';

const console = globalThis.console;

export interface TranspileResult {
  vertexShader: string;
  fragmentShader: string;
  textureDefaults: Record<string, string>;
  uniformDefaults: Record<string, UniformMaterialInfo>;
}

export interface ShaderEffectLoaderDeps {
  fetchShaderSource: (url: string) => Promise<string>;
  resolveIncludes: (source: string) => Promise<string>;
  preprocessShader: (source: string, defines: Record<string, number>) => string;
  transformWEToWebGL: (source: string, isVertex: boolean) => string;
  normalizeHlslNumericSuffix: (source: string) => string;
  capVaryingArrays: (vertSrc: string, fragSrc: string) => { vert: string; frag: string };
  fixVecDimMismatchInBinaryOps: (source: string) => string;
  fixBinaryOpVecConstructorMismatch: (source: string) => string;
  fixTexture2DCoordDimension: (source: string) => string;
}

export interface LoadWEEffectShadersArgs {
  effectName: string;
  combos: Record<string, number>;
  extraDefines?: Record<string, number>;
  runtimeDefines?: Record<string, number>;
  availableTextureSlots?: number[];
  preloadedSources?: { vert: string; frag: string };
  effectDirName?: string;
}

function patchAudioBarUvForFragmentShader(effectName: string, fragmentShader: string): string {
  const lowerName = effectName.toLowerCase();
  const isAudioBarShader = lowerName.includes('audio_bar') || lowerName.includes('audio_bars');
  if (!isAudioBarShader) return fragmentShader;
  if (!/\bvec2\s+shapeCoord\s*=\s*v_TexCoord\b/.test(fragmentShader) && !/\bcircleCoord\s*=\s*\(v_TexCoord\b/.test(fragmentShader)) {
    return fragmentShader;
  }

  let patched = fragmentShader;
  const hasWeUv = /\bvec2\s+weUV\s*=/.test(patched);
  if (!hasWeUv) {
    patched = patched.replace(
      /void\s+main\s*\(\s*\)\s*\{/,
      'void main() {\n\tvec2 weUV = vec2(v_TexCoord.x, 1.0 - v_TexCoord.y);'
    );
  }

  patched = patched.replace(/\bshapeCoord\s*=\s*v_TexCoord\b/g, 'shapeCoord = weUV');
  patched = patched.replace(/\bv_TexCoord\s*\.yx\b/g, 'weUV.yx');
  patched = patched.replace(/\bv_TexCoord\s*\.xy\b/g, 'weUV.xy');
  patched = patched.replace(/\bcircleCoord\s*=\s*\(v_TexCoord\b/g, 'circleCoord = (weUV');
  return patched;
}

export async function loadWEEffectShadersInternal(
  args: LoadWEEffectShadersArgs,
  deps: ShaderEffectLoaderDeps,
): Promise<TranspileResult | null> {
  const {
    effectName,
    combos,
    extraDefines = {},
    runtimeDefines = {},
    availableTextureSlots = [],
    preloadedSources,
    effectDirName,
  } = args;
  let vertSrc: string;
  let fragSrc: string;

  if (preloadedSources?.vert && preloadedSources?.frag) {
    vertSrc = preloadedSources.vert;
    fragSrc = preloadedSources.frag;
  } else {
    const dirName = effectDirName || effectName;
    const baseUrl = `/assets/effects/${dirName}`;
    vertSrc = await deps.fetchShaderSource(`${baseUrl}/shaders/effects/${effectName}.vert`);
    fragSrc = await deps.fetchShaderSource(`${baseUrl}/shaders/effects/${effectName}.frag`);
    if (!vertSrc || !fragSrc) {
      const globalBase = '/assets/shaders';
      vertSrc = vertSrc || await deps.fetchShaderSource(`${globalBase}/${effectName}.vert`);
      fragSrc = fragSrc || await deps.fetchShaderSource(`${globalBase}/${effectName}.frag`);
    }
  }

  if (!vertSrc || !fragSrc) {
    console.warn(`ShaderTranspiler: 无法加载 ${effectName} 的着色器`);
    return null;
  }

  const baseDefinesForComboResolve: Record<string, number> = {
    GLSL: 1,
    ...combos,
    ...runtimeDefines,
    ...extraDefines,
  };
  let comboDefaults = parseComboDefaults(fragSrc, baseDefinesForComboResolve);
  const textureDefaults = parseTextureDefaults(fragSrc);
  const uniformDefaults = parseUniformMaterialMap(vertSrc, fragSrc);
  let vertComboDefaults = parseComboDefaults(vertSrc, {
    ...baseDefinesForComboResolve,
    ...comboDefaults,
  });
  Object.assign(comboDefaults, vertComboDefaults);
  // 第二次收敛：处理 require 依赖其它默认 combo 的场景
  comboDefaults = {
    ...parseComboDefaults(fragSrc, {
      ...baseDefinesForComboResolve,
      ...comboDefaults,
    }),
    ...parseComboDefaults(vertSrc, {
      ...baseDefinesForComboResolve,
      ...comboDefaults,
    }),
  };

  const textureCombos = parseTextureCombos(fragSrc);
  const autoTextureCombos: Record<string, number> = {};
  for (const [slot, meta] of Object.entries(textureCombos)) {
    const bound = availableTextureSlots.includes(Number(slot));
    const hasPaintDefault = !bound && meta.paintDefaultColor
      && isComboRequireSatisfied(meta.require, { ...baseDefinesForComboResolve, ...comboDefaults });
    if (bound || hasPaintDefault) autoTextureCombos[meta.combo] = 1;
  }

  const defines: Record<string, number> = {
    GLSL: 1,
    ...comboDefaults,
    ...autoTextureCombos,
    ...combos,
    ...runtimeDefines,
    ...extraDefines,
  };

  console.log(`ShaderTranspiler: 转译 ${effectName}, defines =`, defines);

  const definesBlock = Object.entries(defines)
    .map(([k, v]) => {
      const num = Number(v);
      if (!Number.isNaN(num) && Number.isInteger(num)) {
        return `#define ${k} ${num}`;
      }
      return `#define ${k} ${v}`;
    })
    .join('\n') + '\n';

  const vertResolved = await deps.resolveIncludes(vertSrc);
  const vertProcessed = deps.preprocessShader(vertResolved, defines);
  let vertexShader = deps.transformWEToWebGL(definesBlock + vertProcessed, true);

  const fragResolved = await deps.resolveIncludes(fragSrc);
  const fragProcessed = deps.preprocessShader(fragResolved, defines);
  let fragmentShader = deps.transformWEToWebGL(definesBlock + fragProcessed, false);
  vertexShader = deps.normalizeHlslNumericSuffix(vertexShader);
  fragmentShader = deps.normalizeHlslNumericSuffix(fragmentShader);

  if (effectName.includes('oscilloscope')) {
    const varyingArrays = vertexShader.match(/varying\s+\w+\s+\w+\s*\[\s*\d+\s*\]\s*;/g) || [];
    const allVaryings = vertexShader.match(/varying\s+\w+\s+\w+[^;]*;/g) || [];
    console.log(`[DEBUG oscilloscope] defines:`, JSON.stringify(defines));
    console.log(`[DEBUG oscilloscope] vertex varying declarations:`, allVaryings);
    console.log(`[DEBUG oscilloscope] vertex varying arrays:`, varyingArrays);
    console.log(`[DEBUG oscilloscope] has GLSL in defines: ${'GLSL' in defines}`);
    console.log(`[DEBUG oscilloscope] vertex shader first 30 lines:\n`, vertexShader.split('\n').slice(0, 30).join('\n'));
  }

  const varyingRegex = /\bvarying\s+(vec[234]|float|mat[234]|int)\s+(\w+)\s*;/g;
  const fragVaryings = new Map<string, string>();
  let vm;
  while ((vm = varyingRegex.exec(fragmentShader)) !== null) {
    fragVaryings.set(vm[2], vm[1]);
  }

  // 收集顶点着色器的 varying 类型
  const vertVaryingTypes = new Map<string, string>();
  const vertVaryingRegex2 = /\bvarying\s+(vec[234]|float|mat[234]|int)\s+(\w+)\s*;/g;
  let vvm2;
  while ((vvm2 = vertVaryingRegex2.exec(vertexShader)) !== null) {
    vertVaryingTypes.set(vvm2[2], vvm2[1]);
  }

  // varying 类型不一致时，判断是否需要升级到较大维度
  // 只有当较小维度的着色器中实际使用了高维 swizzle（.z/.w/.b/.a）时才升级
  // 否则降级到较小维度（安全做法）
  function vecDim(type: string): number {
    if (type.startsWith('vec')) return parseInt(type[3]);
    if (type === 'float' || type === 'int') return 1;
    return 0;
  }
  function usesHighDimSwizzle(source: string, varName: string, smallDim: number): boolean {
    if (smallDim >= 4) return false;
    // 检查是否使用了超出 smallDim 的 swizzle 分量
    const swizzlePattern = new RegExp(`\\b${varName}\\s*\\.\\s*([xyzwrgba]{1,4})\\b`, 'g');
    let m;
    while ((m = swizzlePattern.exec(source)) !== null) {
      const swizzle = m[1];
      for (const ch of swizzle) {
        if (smallDim <= 1 && 'yzgba'.includes(ch)) return true;
        if (smallDim <= 2 && 'zwba'.includes(ch)) return true;
        if (smallDim <= 3 && 'wa'.includes(ch)) return true;
      }
    }
    return false;
  }
  if (fragVaryings.size > 0) {
    for (const [name, fragType] of fragVaryings) {
      const vertType = vertVaryingTypes.get(name);
      if (vertType && vertType !== fragType) {
        const fragDim = vecDim(fragType);
        const vertDim = vecDim(vertType);
        let useType: string;
        if (vertDim > fragDim) {
          // 顶点着色器维度更大，检查片段着色器是否用了高维 swizzle
          useType = usesHighDimSwizzle(fragmentShader, name, fragDim) ? vertType : fragType;
        } else {
          // 片段着色器维度更大，检查顶点着色器是否用了高维 swizzle
          useType = usesHighDimSwizzle(vertexShader, name, vertDim) ? fragType : vertType;
        }
        if (useType !== vertType) {
          vertexShader = vertexShader.replace(
            new RegExp(`\\bvarying\\s+${vertType}\\s+${name}\\s*;`),
            `varying ${useType} ${name};`
          );
        }
        if (useType !== fragType) {
          fragmentShader = fragmentShader.replace(
            new RegExp(`\\bvarying\\s+${fragType}\\s+${name}\\s*;`),
            `varying ${useType} ${name};`
          );
          // 更新 fragVaryings 以反映升级后的类型
          fragVaryings.set(name, useType);
        }
      }
    }
  }

  const vertVaryings = new Map<string, string>();
  const vertVaryingRegex = /\bvarying\s+(vec[234]|float|mat[234]|int)\s+(\w+)\s*;/g;
  let vvm;
  while ((vvm = vertVaryingRegex.exec(vertexShader)) !== null) {
    vertVaryings.set(vvm[2], vvm[1]);
  }
  const missingInFrag: string[] = [];
  for (const [name, type] of vertVaryings) {
    if (!fragVaryings.has(name) && new RegExp(`\\b${name}\\b`).test(fragmentShader)) {
      missingInFrag.push(`varying ${type} ${name};`);
    }
  }
  if (missingInFrag.length > 0) {
    const precisionMatch = fragmentShader.match(/precision\s+(highp|mediump|lowp)\s+float\s*;[^\n]*/);
    if (precisionMatch) {
      const insertIdx = fragmentShader.indexOf(precisionMatch[0]) + precisionMatch[0].length;
      fragmentShader = fragmentShader.substring(0, insertIdx) + '\n' + missingInFrag.join('\n') + fragmentShader.substring(insertIdx);
    } else {
      fragmentShader = missingInFrag.join('\n') + '\n' + fragmentShader;
    }
  }

  const fragTexCoordType = fragVaryings.get('v_TexCoord');
  if (fragTexCoordType === 'vec4') {
    vertexShader = vertexShader.replace(
      /\bv_TexCoord\s*=\s*v_TexCoord_WE\s*;/g,
      'v_TexCoord = vec4(v_TexCoord_WE, 0.0, 1.0);'
    );
  } else if (fragTexCoordType === 'vec3') {
    vertexShader = vertexShader.replace(
      /\bv_TexCoord\s*=\s*v_TexCoord_WE\s*;/g,
      'v_TexCoord = vec3(v_TexCoord_WE, 0.0);'
    );
  }

  if (fragTexCoordType && fragTexCoordType !== 'vec2') {
    fragmentShader = deps.fixVecDimMismatchInBinaryOps(fragmentShader);
    fragmentShader = deps.fixBinaryOpVecConstructorMismatch(fragmentShader);
  }
  // 顶点着色器也可能有 vec 维度不匹配（如 float = max(1, vec2)）
  vertexShader = deps.fixVecDimMismatchInBinaryOps(vertexShader);
  // texture2D 的 UV 坐标参数必须是 vec2
  fragmentShader = deps.fixTexture2DCoordDimension(fragmentShader);
  fragmentShader = patchAudioBarUvForFragmentShader(effectName, fragmentShader);

  const capped = deps.capVaryingArrays(vertexShader, fragmentShader);
  vertexShader = capped.vert;
  fragmentShader = capped.frag;

  return { vertexShader, fragmentShader, textureDefaults, uniformDefaults };
}
