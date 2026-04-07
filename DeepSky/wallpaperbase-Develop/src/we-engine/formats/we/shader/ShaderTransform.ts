import {
  fixBinaryOpVecConstructorMismatch,
  fixFloatArrayIndex,
  fixForLoopFloatToInt,
  fixImplicitVecTruncation,
  fixIntFloatImplicitConversion,
  fixMixArgTypeMismatch,
  fixPowArgTypeMismatch,
  fixTexture2DCoordDimension,
  fixVecDimMismatchInBinaryOps,
  fixWaveMaskIntFloatMismatch,
  removeUnusedSamplers,
} from './ShaderSyntaxFixes';

function findClosingParen(source: string, startPos: number): number {
  let depth = 1;
  for (let i = startPos; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelArgs(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function replaceFuncCall(
  source: string,
  funcName: string,
  replacer: (args: string[]) => string,
): string {
  let result = '';
  let pos = 0;
  const pattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
  while (pos < source.length) {
    pattern.lastIndex = pos;
    const match = pattern.exec(source);
    if (!match) {
      result += source.slice(pos);
      break;
    }
    result += source.slice(pos, match.index);
    const argsStart = match.index + match[0].length;
    const closePos = findClosingParen(source, argsStart);
    if (closePos === -1) {
      result += match[0];
      pos = argsStart;
      continue;
    }
    const argsStr = source.slice(argsStart, closePos);
    const args = splitTopLevelArgs(argsStr);
    result += replacer(args);
    pos = closePos + 1;
  }
  return result;
}

export interface ShaderTransformHooks {
  fixModuloOperator: (source: string) => string;
  fixConstIntUsage: (source: string) => string;
  fixIntLiteralsForGLSL: (source: string) => string;
  fixIntCastInComparisons: (source: string) => string;
  fixBoolArithmetic: (source: string) => string;
  fixMaxMinArgOrder: (source: string) => string;
  fixVaryingModificationInFragment: (source: string) => string;
  fixFloatUniformInForLoop: (source: string) => string;
  fixIntMacroFloatComparison: (source: string) => string;
}

export function transformWEToWebGL(source: string, isVertex: boolean, hooks: ShaderTransformHooks): string {
  let result = source;
  result = result.replace(/\battribute\s+vec3\s+a_Position\s*;/g, '');
  result = result.replace(/\battribute\s+vec2\s+a_TexCoord\s*;/g, '');
  result = result.replace(/\buniform\s+mat4\s+g_ModelViewProjectionMatrix\s*;/g, '');
  result = result.replace(/(uniform\s+\w+\s+\w+\s*;)\s*\/\/.*/g, '$1');
  result = replaceFuncCall(result, 'texSample2DLod', (args) => `texture2D(${args[0]}, ${args[1]})`);
  result = replaceFuncCall(result, 'texSample2D', (args) => `texture2D(${args.join(', ')})`);
  result = replaceFuncCall(result, 'CAST2', (args) => `vec2(${args.join(', ')})`);
  result = replaceFuncCall(result, 'CAST3', (args) => `vec3(${args.join(', ')})`);
  result = replaceFuncCall(result, 'CAST4', (args) => `vec4(${args.join(', ')})`);
  result = replaceFuncCall(result, 'CAST3X3', (args) => `mat3(${args.join(', ')})`);
  result = replaceFuncCall(result, 'mul', (args) => `(${args[1]} * ${args[0]})`);
  result = result.replace(/\bfrac\b(?!\w)/g, 'fract');
  result = replaceFuncCall(result, 'saturate', (args) => `clamp(${args[0]}, 0.0, 1.0)`);
  result = replaceFuncCall(result, 'atan2', (args) => `atan(${args.join(', ')})`);
  result = replaceFuncCall(result, 'lerp', (args) => `mix(${args.join(', ')})`);
  result = replaceFuncCall(result, 'fmod', (args) => `mod(${args.join(', ')})`);
  result = result.replace(/\bddx\b(?!\w)/g, 'dFdx');
  result = result.replace(/\bddy\b(?!\w)/g, 'dFdy');
  result = replaceFuncCall(result, 'clip', (args) => `{ if ((${args[0]}) < 0.0) discard; }`);
  result = result.replace(/\buint\b/g, 'int');
  result = result.replace(/\bfloat2\b/g, 'vec2');
  result = result.replace(/\bfloat3\b/g, 'vec3');
  result = result.replace(/\bfloat4\b/g, 'vec4');
  result = result.replace(/\bfloat2x2\b/g, 'mat2');
  result = result.replace(/\bfloat3x3\b/g, 'mat3');
  result = result.replace(/\bfloat4x4\b/g, 'mat4');
  result = result.replace(/\bint2\b/g, 'ivec2');
  result = result.replace(/\bint3\b/g, 'ivec3');
  result = result.replace(/\bint4\b/g, 'ivec4');
  result = result.replace(/\bhalf\b/g, 'float');
  result = result.replace(/\bhalf2\b/g, 'vec2');
  result = result.replace(/\bhalf3\b/g, 'vec3');
  result = result.replace(/\bhalf4\b/g, 'vec4');
  result = result.replace(/\bfixed\b/g, 'float');
  result = result.replace(/\bfixed2\b/g, 'vec2');
  result = result.replace(/\bfixed3\b/g, 'vec3');
  result = result.replace(/\bfixed4\b/g, 'vec4');

  if (isVertex) {
    result = result.replace(/\ba_Position\b/g, 'position');
    result = result.replace(/\ba_TexCoord\b/g, 'v_TexCoord_WE');
    result = result.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main() {\n\tvec2 v_TexCoord_WE = uv;');
    result = result.replace(/\bg_ModelViewProjectionMatrix\b/g, '(projectionMatrix * modelViewMatrix)');
    // Audio bar shaders 同时声明 p_TexCoord（纹理采样 UV）和 v_TexCoord（bar 形状 UV）。
    // WE shader 的 bar 形状数学使用 DirectX 坐标（y=0 在顶部），
    // 但 v_TexCoord_WE = uv 提供的是 OpenGL 坐标（y=0 在底部）。
    // 当检测到双 UV varying 模式时，对 v_TexCoord 的 y 轴取反以匹配 DirectX 约定。
    // 老 zcompat shader 只有单 v_TexCoord（无 p_TexCoord），不受此规则影响。
    if (/\bvarying\s+vec2\s+p_TexCoord\b/.test(result) && /\bvarying\s+vec2\s+v_TexCoord\b/.test(result)) {
      result = result.replace(
        /\bv_TexCoord\s*=\s*v_TexCoord_WE\s*;/g,
        'v_TexCoord = vec2(v_TexCoord_WE.x, 1.0 - v_TexCoord_WE.y);',
      );
    }
  } else {
    result = result.replace(/(vec2\s+flowMask\s*=\s*[^;]+;)/g, '$1\n\tflowMask.y = -flowMask.y;');
  }
  result = result.replace(/(vec2\s+scroll\s*=\s*[^;]+;)/g, '$1\n\tscroll.y = -scroll.y;');

  result = result.replace(/\bsample\b/g, 'sample_color');
  result = result.replace(/\binput\b/g, '_input');
  result = result.replace(
    /\bpreCalcNode\s*\(\s*(?:const\s+)?(?:in|out|inout)?\s*(?:(?:lowp|mediump|highp)\s+)?int\s+([A-Za-z_]\w*)/g,
    'preCalcNode(float $1'
  );
  result = result.replace(/\bstep\(\s*([^,]+),\s*nodeNum\s*\)/g, 'step($1, float(nodeNum))');
  result = result.replace(/\blinearStep\(\s*([^,]+),\s*([^,]+),\s*nodeNum\s*\)/g, 'linearStep($1, $2, float(nodeNum))');

  result = hooks.fixModuloOperator(result);
  result = hooks.fixConstIntUsage(result);
  result = hooks.fixIntLiteralsForGLSL(result);
  result = hooks.fixIntCastInComparisons(result);
  result = hooks.fixBoolArithmetic(result);
  result = hooks.fixMaxMinArgOrder(result);
  result = fixWaveMaskIntFloatMismatch(result);
  result = removeUnusedSamplers(result);
  result = fixImplicitVecTruncation(result);
  result = fixVecDimMismatchInBinaryOps(result);
  result = fixBinaryOpVecConstructorMismatch(result);
  result = fixTexture2DCoordDimension(result);
  result = fixFloatArrayIndex(result);
  result = fixForLoopFloatToInt(result);
  result = fixIntFloatImplicitConversion(result);
  result = fixMixArgTypeMismatch(result);
  result = fixPowArgTypeMismatch(result);

  if (/\blinearStep\s*\(/.test(result)) {
    const hasExistingDef = /float\s+linearStep\s*\(/.test(result);
    if (hasExistingDef) {
      result = result.replace(/\bfloat\s+linearStep\s*\(/g, 'float _we_linearStep(');
    }
    const macroLine = '#define linearStep(e0, e1, x) _we_linearStep(float(e0), float(e1), float(x))';
    const lines = result.split('\n');
    let lastDefineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#define\b/.test(lines[i])) lastDefineIdx = i;
    }
    if (!hasExistingDef) {
      const fullPolyfill =
`// [polyfill] linearStep
float _we_linearStep(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}
${macroLine}`;
      if (lastDefineIdx >= 0) {
        lines.splice(lastDefineIdx + 1, 0, fullPolyfill);
      } else {
        const mainIdx = result.search(/void\s+main\s*\(/);
        if (mainIdx >= 0) {
          result = result.substring(0, mainIdx) + fullPolyfill + '\n' + result.substring(mainIdx);
          lines.length = 0;
        }
      }
    } else if (lastDefineIdx >= 0) {
      lines.splice(lastDefineIdx + 1, 0, macroLine);
    }
    if (lines.length > 0) {
      result = lines.join('\n');
    }
  }

  if (
    /\binverse\s*\(/.test(result) &&
    !/\bmat3\s+inverse\s*\(\s*mat3\s+\w+\s*\)/.test(result) &&
    !/\bmat3\s+we_inverse_mat3\s*\(\s*mat3\s+\w+\s*\)/.test(result)
  ) {
    result = result.replace(/\binverse\s*\(/g, 'we_inverse_mat3(');
    const inverseMat3Def = `
// [polyfill] inverse(mat3) for GLSL ES 1.0
mat3 we_inverse_mat3(mat3 m) {
  vec3 a = m[0];
  vec3 b = m[1];
  vec3 c = m[2];
  vec3 r0 = cross(b, c);
  vec3 r1 = cross(c, a);
  vec3 r2 = cross(a, b);
  float det = dot(a, r0);
  if (abs(det) < 1e-8) {
    return mat3(1.0);
  }
  float invDet = 1.0 / det;
  return mat3(
    vec3(r0.x, r1.x, r2.x) * invDet,
    vec3(r0.y, r1.y, r2.y) * invDet,
    vec3(r0.z, r1.z, r2.z) * invDet
  );
}
`;
    const mainIdx = result.search(/void\s+main\s*\(/);
    if (mainIdx >= 0) {
      result = result.substring(0, mainIdx) + inverseMat3Def + result.substring(mainIdx);
    } else {
      result += `\n${inverseMat3Def}`;
    }
  }

  if (!isVertex) {
    result = hooks.fixVaryingModificationInFragment(result);
  }
  result = hooks.fixFloatUniformInForLoop(result);
  if (!result.includes('precision ')) {
    result = 'precision mediump float;\n' + result;
  }
  result = hooks.fixIntMacroFloatComparison(result);
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}
