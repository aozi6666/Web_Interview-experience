const MAX_VARYING_VEC4 = 24;

export function normalizeHlslNumericSuffix(source: string): string {
  return source.replace(/(\d+\.\d+|\d+)[fF]\b/g, '$1');
}

export function fixWaveMaskIntFloatMismatch(source: string): string {
  let result = source;
  result = result.replace(
    /\b((?:const\s+)?(?:in|out|inout)\s+)int\s+overflowable\b/g,
    '$1float overflowable'
  );
  result = result.replace(/\bint\s+overflowable\b/g, 'float overflowable');
  result = result.replace(
    /\bint\s+unfeatheredMask\s*=\s*max\s*\(/g,
    'float unfeatheredMask = max('
  );
  return result;
}

export function fixImplicitVecTruncation(source: string): string {
  const lines = source.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const assignMatch = line.match(/^(\s*)(vec[23]|float)\s+(\w+)\s*=\s*/);
    if (assignMatch) {
      const indent = assignMatch[1];
      const targetType = assignMatch[2];
      const varName = assignMatch[3];
      const rhsStart = assignMatch[0].length;
      const rest = line.slice(rhsStart).trimEnd();
      if (rest.endsWith(';')) {
        const rhs = rest.slice(0, -1).trim();
        // 处理 texture2D(...) 和 vec4/vec3(...) 构造器赋给低维类型的情况
        const funcMatch = rhs.match(/^(texture2D|vec([234]))\s*\(/);
        if (funcMatch) {
          const isVecCtor = !!funcMatch[2];
          const ctorDim = isVecCtor ? parseInt(funcMatch[2]) : 4; // texture2D returns vec4
          const targetDim = targetType === 'float' ? 1 : parseInt(targetType[3]);
          if (ctorDim > targetDim) {
            const parenStart = rhs.indexOf('(');
            let depth = 0;
            let parenEnd = -1;
            for (let i = parenStart; i < rhs.length; i++) {
              if (rhs[i] === '(') depth++;
              else if (rhs[i] === ')') {
                depth--;
                if (depth === 0) { parenEnd = i; break; }
              }
            }
            if (parenEnd === rhs.length - 1) {
              const swizzle = targetDim === 3 ? '.rgb'
                : targetDim === 2 ? '.rg'
                  : '.r';
              result.push(`${indent}${targetType} ${varName} = ${rhs}${swizzle};`);
              continue;
            }
          }
        }
      }
    }
    result.push(line);
  }
  return result.join('\n');
}

// GLSL 内置数学函数，参数类型可以是 float/vecN，不需要跳过维度修复
const GLSL_BUILTIN_MATH_FUNCS = new Set([
  'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp',
  'mix', 'step', 'smoothstep', 'pow', 'sqrt', 'inversesqrt', 'exp', 'exp2',
  'log', 'log2', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'normalize', 'reflect', 'refract',
]);

function isInsideFunctionCallParen(str: string, pos: number): boolean {
  const parenStack: { isFuncCall: boolean; funcName: string }[] = [];
  for (let i = 0; i < pos; i++) {
    if (str[i] === '(') {
      let j = i - 1;
      while (j >= 0 && str[j] === ' ') j--;
      const isFuncCall = j >= 0 && /\w/.test(str[j]);
      let funcName = '';
      if (isFuncCall) {
        const end = j + 1;
        while (j >= 0 && /\w/.test(str[j])) j--;
        funcName = str.substring(j + 1, end);
      }
      parenStack.push({ isFuncCall, funcName });
    } else if (str[i] === ')') {
      if (parenStack.length > 0) parenStack.pop();
    }
  }
  // 只有在非内置函数的函数调用括号内才返回 true
  return parenStack.some(entry => entry.isFuncCall && !GLSL_BUILTIN_MATH_FUNCS.has(entry.funcName));
}

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

function collectTypeMap(source: string): Map<string, number> {
  const typeMap = new Map<string, number>();
  const conflictSet = new Set<string>();
  const lines = source.split('\n');
  for (const line of lines) {
    const vecMatches = line.matchAll(/\b(vec[234]|ivec[234])\s+(\w+)/g);
    for (const m of vecMatches) {
      const name = m[2];
      const dim = parseInt(m[1][m[1].length - 1]);
      if (conflictSet.has(name)) continue;
      if (typeMap.has(name) && typeMap.get(name) !== dim) {
        typeMap.delete(name);
        conflictSet.add(name);
      } else {
        typeMap.set(name, dim);
      }
    }
  }
  for (const line of lines) {
    const scalarMatches = line.matchAll(/\b(float|int|bool)\s+(\w+)/g);
    for (const m of scalarMatches) {
      const name = m[2];
      if (conflictSet.has(name)) continue;
      if (typeMap.has(name) && typeMap.get(name) !== 1) {
        typeMap.delete(name);
        conflictSet.add(name);
      } else {
        typeMap.set(name, 1);
      }
    }
  }
  return typeMap;
}

function stripOuterParens(input: string): string {
  let value = input.trim();
  while (value.startsWith('(') && value.endsWith(')')) {
    let depth = 0;
    let valid = true;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i !== value.length - 1) {
          valid = false;
          break;
        }
      }
    }
    if (!valid || depth !== 0) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

/** Mask out arguments of GLSL functions that always return a scalar (float),
 *  so that vector variables inside them don't inflate dimension inference. */
function maskScalarReturningFuncArgs(expr: string): string {
  const scalarFuncs = ['length', 'distance', 'dot', 'determinant'];
  let result = expr;
  for (const fn of scalarFuncs) {
    const pattern = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    let m;
    while ((m = pattern.exec(result)) !== null) {
      const argsStart = m.index + m[0].length;
      const closePos = findClosingParen(result, argsStart);
      if (closePos === -1) continue;
      // Replace the function arguments with spaces (preserve length for stable indices)
      const before = result.slice(0, argsStart);
      const after = result.slice(closePos);
      const filler = ' '.repeat(closePos - argsStart);
      result = before + filler + after;
    }
  }
  return result;
}

function inferExprDim(expr: string, typeMap: Map<string, number>): number | null {
  const trimmed = stripOuterParens(expr);
  if (!trimmed) return null;

  const vecCtor = trimmed.match(/^(?:[ib]?vec)([234])\s*\(/);
  if (vecCtor) return parseInt(vecCtor[1], 10);

  if (/^(?:float|int|bool)\s*\(/.test(trimmed)) return 1;

  if (/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fF]?$/.test(trimmed)) {
    return 1;
  }

  const scalarLike = /^(?:true|false)$/;
  if (scalarLike.test(trimmed)) return 1;

  const swizzle = trimmed.match(/\.\s*([xyzwrgba]{1,4})$/);
  if (swizzle) return swizzle[1].length;

  if (/^[A-Za-z_]\w*$/.test(trimmed)) {
    return typeMap.get(trimmed) ?? null;
  }

  // Mask out arguments of scalar-returning functions (length, dot, etc.)
  // so vector variables inside them don't inflate dimension inference.
  const masked = maskScalarReturningFuncArgs(trimmed);

  let inferredDim = 1;
  let foundKnownToken = false;
  for (const [name, dim] of typeMap) {
    const tokenRegex = new RegExp(`(?<!\\.)\\b${name}\\b(?!\\s*[.\\[(])`);
    if (!tokenRegex.test(masked)) continue;
    foundKnownToken = true;
    if (dim > inferredDim) inferredDim = dim;
  }
  if (foundKnownToken) return inferredDim;

  return null;
}

export function fixMixArgTypeMismatch(source: string): string {
  const typeMap = collectTypeMap(source);
  if (typeMap.size === 0) return source;

  let result = '';
  let pos = 0;
  const pattern = /\bmix\s*\(/g;
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
    if (args.length !== 3) {
      result += source.slice(match.index, closePos + 1);
      pos = closePos + 1;
      continue;
    }

    let [a, b, t] = args;
    const dimA = inferExprDim(a, typeMap);
    const dimB = inferExprDim(b, typeMap);
    if (dimA && dimB && dimA !== dimB) {
      if (dimA === 1 && dimB >= 2 && dimB <= 4) {
        a = `vec${dimB}(${a.trim()})`;
      } else if (dimB === 1 && dimA >= 2 && dimA <= 4) {
        b = `vec${dimA}(${b.trim()})`;
      }
    }

    result += `mix(${a}, ${b}, ${t})`;
    pos = closePos + 1;
  }

  return result;
}

/**
 * pow(x, y) 要求两个参数维度一致。
 * WE 着色器中常见 pow(float, vec3) 或 pow(vec3, float)，HLSL 隐式广播但 GLSL 不行。
 * 修复：将标量参数包裹为 vecN 构造器。
 */
export function fixPowArgTypeMismatch(source: string): string {
  const typeMap = collectTypeMap(source);
  if (typeMap.size === 0) return source;

  let result = '';
  let pos = 0;
  const pattern = /\bpow\s*\(/g;
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
    if (args.length !== 2) {
      result += source.slice(match.index, closePos + 1);
      pos = closePos + 1;
      continue;
    }

    let [a, b] = args;
    const dimA = inferExprDim(a, typeMap);
    const dimB = inferExprDim(b, typeMap);
    // 处理维度不匹配：包括一方为 null（未知，视为标量）而另一方为已知 vec 的情况
    const effectiveDimA = dimA ?? 1;
    const effectiveDimB = dimB ?? 1;
    if (effectiveDimA !== effectiveDimB && (dimA !== null || dimB !== null)) {
      if (effectiveDimA === 1 && effectiveDimB >= 2 && effectiveDimB <= 4) {
        a = `vec${effectiveDimB}(${a.trim()})`;
      } else if (effectiveDimB === 1 && effectiveDimA >= 2 && effectiveDimA <= 4) {
        b = `vec${effectiveDimA}(${b.trim()})`;
      }
    }

    result += `pow(${a}, ${b})`;
    pos = closePos + 1;
  }

  return result;
}

export function fixVecDimMismatchInBinaryOps(source: string): string {
  const typeMap = new Map<string, number>();
  const conflictSet = new Set<string>();
  const lines = source.split('\n');
  for (const line of lines) {
    const vecMatches = line.matchAll(/\b(vec[234])\s+(\w+)/g);
    for (const m of vecMatches) {
      const name = m[2];
      const dim = parseInt(m[1][3]);
      if (conflictSet.has(name)) continue;
      if (typeMap.has(name) && typeMap.get(name) !== dim) {
        typeMap.delete(name);
        conflictSet.add(name);
      } else {
        typeMap.set(name, dim);
      }
    }
  }
  for (const line of lines) {
    const scalarMatches = line.matchAll(/\b(float|int)\s+(\w+)/g);
    for (const m of scalarMatches) {
      const name = m[2];
      if (typeMap.has(name)) {
        typeMap.delete(name);
        conflictSet.add(name);
      }
    }
  }
  if (typeMap.size === 0) return source;
  return lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return line;
    let targetDim: number | null = null;
    let prefix = '';
    let rhs = '';
    let suffix = '';
    let isCompoundAssign = false;
    const declMatch = line.match(/^(\s*(?:vec([23])|float)\s+\w+\s*=\s*)(.+)(;\s*)$/);
    if (declMatch) {
      prefix = declMatch[1];
      targetDim = declMatch[2] ? parseInt(declMatch[2]) : 1;
      rhs = declMatch[3];
      suffix = declMatch[4];
    }
    if (targetDim === null) {
      const reassignMatch = line.match(/^(\s*(\w+)\s*=\s*)(.+)(;\s*)$/);
      if (reassignMatch) {
        const varName = reassignMatch[2];
        if (!['if', 'for', 'while', 'return', 'uniform', 'varying', 'attribute', 'precision', 'else'].includes(varName)) {
          const knownDim = typeMap.get(varName);
          if (knownDim !== undefined && knownDim <= 3) {
            prefix = reassignMatch[1];
            targetDim = knownDim;
            rhs = reassignMatch[3];
            suffix = reassignMatch[4];
          }
        }
      }
    }
    if (targetDim === null) {
      const compoundMatch = line.match(/^(\s*(\w+)\s*(?:\+=|-=|\*=|\/=)\s*)(.+)(;\s*)$/);
      if (compoundMatch) {
        const varName = compoundMatch[2];
        if (!['if', 'for', 'while', 'return', 'uniform', 'varying', 'attribute', 'precision', 'else'].includes(varName)) {
          const knownDim = typeMap.get(varName);
          if (knownDim !== undefined && knownDim <= 3) {
            prefix = compoundMatch[1];
            targetDim = knownDim;
            rhs = compoundMatch[3];
            suffix = compoundMatch[4];
            isCompoundAssign = true;
          }
        }
      }
    }
    if (targetDim === null || !rhs) return line;
    let newRhs = rhs;
    let changed = false;
    for (const [varName, varDim] of typeMap) {
      if (varDim <= targetDim) continue;
      const swizzle = targetDim === 1 ? '.x' : targetDim === 2 ? '.xy' : '.xyz';
      const regex = new RegExp(`(?<!\\.)\\b${varName}\\b(?!\\s*[.\\[(])`, 'g');
      const replaced = newRhs.replace(regex, (match, offset) => {
        if (isInsideFunctionCallParen(newRhs, offset)) return match;
        return `${varName}${swizzle}`;
      });
      if (replaced !== newRhs) {
        newRhs = replaced;
        changed = true;
      }
    }
    for (const [varName] of typeMap) {
      const swizzleRegex = new RegExp(`(?<!\\.)\\b${varName}\\.([xyzwrgbastpq]{2,4})\\b`, 'g');
      const replaced = newRhs.replace(swizzleRegex, (fullMatch, swizzleChars: string, offset: number) => {
        const swizzleDim = swizzleChars.length;
        if (swizzleDim <= targetDim) return fullMatch;
        if (isInsideFunctionCallParen(newRhs, offset)) return fullMatch;
        const truncated = swizzleChars.slice(0, targetDim);
        return `${varName}.${truncated}`;
      });
      if (replaced !== newRhs) {
        newRhs = replaced;
        changed = true;
      }
    }
    if (!changed && targetDim >= 2 && !isCompoundAssign) {
      const hasVecConstructor = /\bvec[234]\s*\(/.test(newRhs);
      let hasKnownVecVar = false;
      for (const [varName, varDim] of typeMap) {
        if (varDim < 2) continue;
        const varRegex = new RegExp(`\\b${varName}\\b`);
        if (varRegex.test(newRhs)) {
          hasKnownVecVar = true;
          break;
        }
      }
      if (!hasVecConstructor && !hasKnownVecVar) {
        newRhs = `vec${targetDim}(${newRhs})`;
        changed = true;
      }
    }
    if (changed) return `${prefix}${newRhs}${suffix}`;
    return line;
  }).join('\n');
}

export function fixBinaryOpVecConstructorMismatch(source: string): string {
  const typeMap = new Map<string, number>();
  const conflictSet = new Set<string>();
  const lines = source.split('\n');
  for (const line of lines) {
    const vecMatches = line.matchAll(/\b(vec[234])\s+(\w+)/g);
    for (const m of vecMatches) {
      const name = m[2];
      const dim = parseInt(m[1][3]);
      if (conflictSet.has(name)) continue;
      if (typeMap.has(name) && typeMap.get(name) !== dim) {
        typeMap.delete(name);
        conflictSet.add(name);
      } else {
        typeMap.set(name, dim);
      }
    }
  }
  for (const line of lines) {
    const scalarMatches = line.matchAll(/\b(float|int)\s+(\w+)/g);
    for (const m of scalarMatches) {
      const name = m[2];
      if (typeMap.has(name)) {
        typeMap.delete(name);
        conflictSet.add(name);
      }
    }
  }
  if (typeMap.size === 0) return source;
  let result = source;
  for (const [varName, varDim] of typeMap) {
    const pattern = new RegExp(
      `(?<!\\.)\\b${varName}\\b(?!\\s*[.\\[(])` +
      `(\\s*[*\\/+\\-]\\s*)` +
      `vec([234])\\(`,
      'g'
    );
    result = result.replace(pattern, (match, opPart, vecDimStr) => {
      const constructorDim = parseInt(vecDimStr);
      if (varDim > constructorDim) {
        const swizzle = constructorDim === 1 ? '.x' : constructorDim === 2 ? '.xy' : '.xyz';
        return `${varName}${swizzle}${opPart}vec${vecDimStr}(`;
      }
      return match;
    });
    const pattern2 = new RegExp(
      `\\)` +
      `(\\s*[*\\/+\\-]\\s*)` +
      `(?<!\\.)\\b${varName}\\b(?!\\s*[.\\[(])`,
      'g'
    );
    result = result.replace(pattern2, (match, opPart, offset) => {
      const closeParenPos = offset;
      let depth = 0;
      let openParenPos = -1;
      for (let i = closeParenPos; i >= 0; i--) {
        if (result[i] === ')') depth++;
        else if (result[i] === '(') {
          depth--;
          if (depth === 0) { openParenPos = i; break; }
        }
      }
      if (openParenPos > 0) {
        const beforeParen = result.substring(Math.max(0, openParenPos - 4), openParenPos);
        const vecMatch = beforeParen.match(/vec([234])$/);
        if (vecMatch) {
          const constructorDim = parseInt(vecMatch[1]);
          if (varDim > constructorDim) {
            const swizzle = constructorDim === 1 ? '.x' : constructorDim === 2 ? '.xy' : '.xyz';
            return `)${opPart}${varName}${swizzle}`;
          }
        }
      }
      return match;
    });
  }
  return result;
}

export function capVaryingArrays(vertSrc: string, fragSrc: string): { vert: string; frag: string } {
  const declRegex = /\bvarying\s+(vec[234]|float|mat[234]|int|ivec[234])\s+(\w+)(?:\s*\[\s*(\d+)\s*\])?\s*;/g;
  interface VInfo { name: string; type: string; arrSize: number; vec4: number; }
  function slotsPerElem(type: string): number {
    if (type === 'mat4') return 4;
    if (type === 'mat3') return 3;
    if (type === 'mat2') return 2;
    return 1;
  }
  const varyings: VInfo[] = [];
  let m;
  while ((m = declRegex.exec(vertSrc)) !== null) {
    const type = m[1];
    const name = m[2];
    const arrSize = m[3] ? parseInt(m[3], 10) : 1;
    varyings.push({ name, type, arrSize, vec4: slotsPerElem(type) * arrSize });
  }
  const total = varyings.reduce((s, v) => s + v.vec4, 0);
  if (total <= MAX_VARYING_VEC4) return { vert: vertSrc, frag: fragSrc };
  const arrays = varyings.filter(v => v.arrSize > 1).sort((a, b) => b.vec4 - a.vec4);
  if (arrays.length === 0) {
    console.warn(`[VaryingCap] Total varying vec4 (${total}) exceeds ${MAX_VARYING_VEC4} but no arrays to reduce`);
    return { vert: vertSrc, frag: fragSrc };
  }
  let vert = vertSrc;
  let frag = fragSrc;
  let currentTotal = total;
  for (const arr of arrays) {
    if (currentTotal <= MAX_VARYING_VEC4) break;
    const spe = slotsPerElem(arr.type);
    const nonArraySlots = currentTotal - arr.vec4;
    const maxArrSlots = MAX_VARYING_VEC4 - nonArraySlots;
    const newSize = Math.max(1, Math.floor(maxArrSlots / spe));
    if (newSize >= arr.arrSize) continue;
    const pat = new RegExp(`(\\bvarying\\s+${arr.type}\\s+${arr.name}\\s*\\[\\s*)${arr.arrSize}(\\s*\\]\\s*;)`, 'g');
    vert = vert.replace(pat, `$1${newSize}$2`);
    frag = frag.replace(pat, `$1${newSize}$2`);
    console.warn(
      `[VaryingCap] Reduced varying ${arr.type} ${arr.name}[${arr.arrSize}] → [${newSize}]` +
      ` (${arr.arrSize * spe} → ${newSize * spe} vec4, limit=${MAX_VARYING_VEC4})`
    );
    currentTotal = nonArraySlots + newSize * spe;
  }
  return { vert, frag };
}

/**
 * GLSL ES 要求数组索引必须是整数表达式。
 * HLSL 允许 float 隐式转为 int 用作数组索引，但 GLSL ES 不行。
 * 例如: float i = floor(...); left[i] → left[int(i)]
 *
 * 检测 float 变量/表达式用作数组索引的情况，包裹 int()。
 */
export function fixFloatArrayIndex(source: string): string {
  // 收集 float 变量名（局部 float 声明 + uniform float）
  const floatVars = new Set<string>();
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // 跳过函数签名行: void func(float x, ...) 等
    if (/^\s*(?:void|float|vec[234]|int|mat[234]|bool|ivec[234])\s+\w+\s*\(/.test(trimmed)) continue;
    // float varName = ...; / uniform float varName;
    const floatDecls = trimmed.matchAll(
      /\b(?:uniform\s+)?(?:(?:lowp|mediump|highp)\s+)?float\s+(\w+)/g
    );
    for (const m of floatDecls) {
      floatVars.add(m[1]);
    }
  }
  if (floatVars.size === 0) return source;

  // 检查是否有 float 变量被用作数组索引
  const arrayIndexPattern = /\[([^\[\]]+)\]/g;
  let hasFloatIndex = false;
  let aim;
  while ((aim = arrayIndexPattern.exec(source)) !== null) {
    const indexExpr = aim[1].trim();
    for (const v of floatVars) {
      if (new RegExp(`\\b${v}\\b`).test(indexExpr) && !/\bint\s*\(/.test(indexExpr)) {
        hasFloatIndex = true;
        console.log(`[fixFloatArrayIndex] float var "${v}" used as array index: [${indexExpr}]`);
      }
    }
  }
  if (!hasFloatIndex) {
    console.log(`[fixFloatArrayIndex] no float array indices found, floatVars:`, [...floatVars].join(', '));
  }

  // 替换数组索引中的 float 变量: [floatVar] → [int(floatVar)]
  let result = source;
  for (const v of floatVars) {
    // 简单变量索引: arr[v]
    result = result.replace(
      new RegExp(`\\[\\s*${v}\\s*\\]`, 'g'),
      `[int(${v})]`
    );
    // 变量参与表达式的索引: arr[expr with v] — 处理常见模式如 arr[v / 4]
    // 使用更保守的策略：只处理 [v op expr] 和 [expr op v] 模式
    result = result.replace(
      new RegExp(`\\[\\s*(${v}\\s*[+\\-*/%]\\s*[^\\]]+)\\]`, 'g'),
      '[int($1)]'
    );
    result = result.replace(
      new RegExp(`\\[\\s*([^\\[]+?\\s*[+\\-*/%]\\s*${v})\\s*\\]`, 'g'),
      '[int($1)]'
    );
  }

  // 处理 floor/ceil/round 返回 float 的函数调用直接用作索引
  result = result.replace(
    /\[\s*((?:floor|ceil|round)\s*\([^)]*\))\s*\]/g,
    '[int($1)]'
  );

  // 防止 int(int(...)) 双重包裹
  result = result.replace(/\bint\s*\(\s*int\s*\(/g, 'int(');

  return result;
}

/**
 * HLSL/WE shader 允许 for(int i = floatVar; i < floatVar; i++)，
 * 但 GLSL ES 不允许用 float 初始化 int 或与 int 比较。
 * 修复: for(int i = int(floatVar); i < int(floatVar); i++)
 */
export function fixForLoopFloatToInt(source: string): string {
  // 收集 float 变量名
  const floatVars = new Set<string>();
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    const uniformMatch = trimmed.match(/^uniform\s+float\s+(\w+)/);
    if (uniformMatch) floatVars.add(uniformMatch[1]);
    const localMatch = trimmed.match(/^float\s+(\w+)\s*[=;]/);
    if (localMatch) floatVars.add(localMatch[1]);
  }
  if (floatVars.size === 0) return source;

  // 用括号感知的方式解析 for 循环，避免 regex 在嵌套括号时出错
  let result = '';
  let pos = 0;
  const forPattern = /\bfor\s*\(\s*int\s+/g;
  while (pos < source.length) {
    forPattern.lastIndex = pos;
    const forMatch = forPattern.exec(source);
    if (!forMatch) {
      result += source.slice(pos);
      break;
    }
    result += source.slice(pos, forMatch.index);

    // 找到 for( 之后的内容起始位置（跳过 "for ("）
    const openParenIdx = source.indexOf('(', forMatch.index + 3);
    const bodyStart = openParenIdx + 1;
    // 找到匹配的闭括号
    const closeParenIdx = findClosingParen(source, bodyStart);
    if (closeParenIdx === -1) {
      result += forMatch[0];
      pos = forMatch.index + forMatch[0].length;
      continue;
    }

    const forBody = source.slice(bodyStart, closeParenIdx);
    // 用括号感知的方式按分号分割 init; cond; incr
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < forBody.length; i++) {
      const ch = forBody[i];
      if (ch === '(' ) depth++;
      else if (ch === ')') depth--;
      if (ch === ';' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current);

    if (parts.length === 3) {
      const initPart = parts[0].trim(); // "int loopVar = expr"
      let condPart = parts[1];
      const incrPart = parts[2];

      // 从 init 中提取 "int loopVar = expr"
      const initMatch = initPart.match(/^int\s+(\w+)\s*=\s*([\s\S]*)$/);
      if (initMatch) {
        const loopVar = initMatch[1];
        let initExpr = initMatch[2];

        // 检查 init 和 cond 中是否有需要包裹的 float 变量
        let needsFix = false;
        for (const v of floatVars) {
          if (new RegExp(`\\b${v}\\b`).test(initExpr) || new RegExp(`\\b${v}\\b`).test(condPart)) {
            needsFix = true;
            break;
          }
        }

        if (needsFix) {
          for (const v of floatVars) {
            // 只包裹尚未被 int() 包裹的裸变量
            // 负向前瞻: 变量后面不是 (  → 不是函数调用
            // 负向后顾: 变量前面不是 int( → 尚未被包裹
            initExpr = initExpr.replace(
              new RegExp(`(?<!\\bint\\s*\\(\\s*)\\b(${v})\\b(?!\\s*\\()`, 'g'),
              'int($1)'
            );
            condPart = condPart.replace(
              new RegExp(`(?<!\\bint\\s*\\(\\s*)\\b(${v})\\b(?!\\s*\\()`, 'g'),
              'int($1)'
            );
          }
          result += `for (int ${loopVar} = ${initExpr};${condPart};${incrPart})`;
        } else {
          result += source.slice(forMatch.index, closeParenIdx + 1);
        }
      } else {
        result += source.slice(forMatch.index, closeParenIdx + 1);
      }
    } else {
      result += source.slice(forMatch.index, closeParenIdx + 1);
    }
    pos = closeParenIdx + 1;
  }
  return result;
}

export function removeUnusedSamplers(source: string): string {
  const samplerRegex = /uniform\s+sampler2D\s+(\w+)\s*;/g;
  let match;
  const toRemove: string[] = [];
  while ((match = samplerRegex.exec(source)) !== null) {
    const name = match[1];
    const fullDecl = match[0];
    const withoutDecl = source.replace(fullDecl, '');
    const usageRegex = new RegExp(`\\b${name}\\b`);
    if (!usageRegex.test(withoutDecl)) {
      toRemove.push(fullDecl);
    }
  }
  let result = source;
  for (const decl of toRemove) {
    result = result.replace(decl, `// [unused] ${decl}`);
  }
  return result;
}

/**
 * texture2D 的第二个参数必须是 vec2。
 * 某些 WE 着色器中，UV 表达式包含 vec4/vec3 变量（如 texSample2D 的返回值被当作标量使用），
 * 导致 texture2D 的坐标参数维度 > 2。
 *
 * 修复策略：检测 texture2D 调用的第二个参数中是否包含 vec4/vec3 变量，
 * 如果有，对这些变量添加 .xy 或 .x swizzle 使表达式降维到 vec2。
 */
export function fixTexture2DCoordDimension(source: string): string {
  const typeMap = collectTypeMap(source);
  if (typeMap.size === 0) return source;

  // 检查是否有维度 > 2 的变量
  let hasHighDimVar = false;
  for (const [, dim] of typeMap) {
    if (dim > 2) { hasHighDimVar = true; break; }
  }
  if (!hasHighDimVar) return source;

  let result = '';
  let pos = 0;
  const pattern = /\btexture2D\s*\(/g;
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
    if (args.length < 2) {
      result += source.slice(match.index, closePos + 1);
      pos = closePos + 1;
      continue;
    }

    // 检查第二个参数（UV 坐标）中是否有 dim > 2 的变量
    let uvArg = args[1].trim();
    let changed = false;
    for (const [varName, varDim] of typeMap) {
      if (varDim <= 2) continue;
      // 匹配变量名（不带 swizzle 的引用）
      const regex = new RegExp(`(?<!\\.)\\b${varName}\\b(?!\\s*[.\\[(])`, 'g');
      const replaced = uvArg.replace(regex, `${varName}.xy`);
      if (replaced !== uvArg) {
        uvArg = replaced;
        changed = true;
      }
    }

    if (changed) {
      args[1] = ' ' + uvArg;
      result += `texture2D(${args.join(',')})`;
    } else {
      result += source.slice(match.index, closePos + 1);
    }
    pos = closePos + 1;
  }

  return result;
}

/**
 * HLSL 允许 float 和 int 之间隐式转换，GLSL 不行。
 * 1. 修复 `float x = int(...)` → `int x = int(...)`
 * 2. 修复 `uniform float x; // {"int":true}` → `uniform int x;`
 */
export function fixIntFloatImplicitConversion(source: string): string {
  let result = source.replace(
    /\bfloat\s+(\w+)\s*=\s*int\s*\(/g,
    'int $1 = int('
  );
  // uniform float 带有 "int":true 元数据注释的，改为 uniform int
  result = result.replace(
    /\buniform\s+float\s+(\w+)\s*;(\s*\/\/\s*\{[^}]*"int"\s*:\s*true[^}]*\})/g,
    'uniform int $1;$2'
  );
  return result;
}
