import { logLoaderVerbose } from '../LoaderUtils';
import {
  clearShaderCache as clearShaderCacheImpl,
  fetchShaderSource as fetchShaderSourceImpl,
  registerIncludeSource as registerIncludeSourceImpl,
  resolveIncludes as resolveIncludesImpl,
} from './ShaderIncludeResolver';
import {
  parseComboDefaults,
  parseTextureDefaults,
  parseTextureCombos,
  parseUniformMaterialMap,
  type UniformMaterialInfo,
} from './ShaderMetadataParser';
import {
  normalizePreprocessorWhitespace,
  preprocessShader as preprocessShaderImpl,
} from './ShaderPreprocessor';
import {
  loadWEEffectShadersInternal,
  type TranspileResult,
} from './ShaderEffectLoader';
import {
  capVaryingArrays as capVaryingArraysImpl,
  fixBinaryOpVecConstructorMismatch as fixBinaryOpVecConstructorMismatchImpl,
  fixImplicitVecTruncation as fixImplicitVecTruncationImpl,
  fixTexture2DCoordDimension as fixTexture2DCoordDimensionImpl,
  fixVecDimMismatchInBinaryOps as fixVecDimMismatchInBinaryOpsImpl,
  fixWaveMaskIntFloatMismatch as fixWaveMaskIntFloatMismatchImpl,
  normalizeHlslNumericSuffix,
  removeUnusedSamplers as removeUnusedSamplersImpl,
} from './ShaderSyntaxFixes';
import { transformWEToWebGL as transformWEToWebGLImpl } from './ShaderTransform';
export {
  parseComboDefaults,
  parseTextureDefaults,
  parseTextureCombos,
  parseUniformMaterialMap,
  isComboRequireSatisfied,
  type UniformMaterialInfo,
  type TextureSlotComboMeta,
} from './ShaderMetadataParser';

const console = { ...globalThis.console, log: logLoaderVerbose };

/**
 * Wallpaper Engine Shader Transpiler
 * 
 * 加载 Wallpaper Engine 原始着色器文件 (.vert, .frag)，
 * 经过预处理和语法转换后输出 WebGL 兼容的 GLSL，
 * 供 Three.js ShaderMaterial 使用。
 * 
 * 处理流程:
 * 1. 从 assets 目录加载 .vert/.frag 源文件
 * 2. 解析 [COMBO] 注释提取 combo 默认值
 * 3. 解析 uniform 注释提取纹理默认路径
 * 4. 解析 #include 并内联引用的头文件
 * 5. 根据 combo 值执行预处理器条件编译 (#if/#elif/#else/#endif)
 * 6. 将 WE 特有语法转换为标准 WebGL GLSL
 * 7. 适配 Three.js 内置变量 (position, uv, projectionMatrix 等)
 */

// ==================== include/cache 适配层 ====================

export function clearShaderCache(): void {
  clearShaderCacheImpl();
}

export function registerIncludeSource(includeName: string, source: string): void {
  registerIncludeSourceImpl(includeName, source);
}

async function resolveIncludes(source: string): Promise<string> {
  return resolveIncludesImpl(source);
}

async function fetchShaderSource(url: string): Promise<string> {
  return fetchShaderSourceImpl(url);
}

// ==================== 预处理器 ====================

/**
 * 执行预处理器条件编译
 * 处理 #if, #ifdef, #ifndef, #elif, #else, #endif, #define
 */
function preprocessShader(source: string, defines: Record<string, number>): string {
  return preprocessShaderImpl(source, defines);
}

// ==================== 平衡括号工具函数 ====================

/**
 * 在顶层逗号处拆分参数（忽略嵌套括号内的逗号）
 */
function splitTopLevelArgs(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    else if (source[i] === ',' && depth === 0) {
      args.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(source.slice(start).trim());
  return args;
}

// ==================== WE → WebGL 语法转换 ====================

/**
 * 将 WE 特有的 GLSL 语法转换为标准 WebGL GLSL
 */
function transformWEToWebGL(source: string, isVertex: boolean): string {
  return transformWEToWebGLImpl(source, isVertex, {
    fixModuloOperator,
    fixConstIntUsage,
    fixIntLiteralsForGLSL,
    fixIntCastInComparisons,
    fixBoolArithmetic,
    fixMaxMinArgOrder,
    fixVaryingModificationInFragment,
    fixFloatUniformInForLoop,
    fixIntMacroFloatComparison,
  });
}

/**
 * Fragment shader 中 varying 变量修改修复
 * 
 * GLSL ES 中 varying 变量在 fragment shader 中是只读的 (in)。
 * WE 着色器经常直接修改 varying 或将其传给 inout/out 参数，
 * 如 auto_sway 的 calNode(v_TexCoord, ...) 和 v_TexCoord.xz *= ...
 * 
 * 修复策略:
 * 1. 检测哪些 varying 在 main() 中被赋值或传给 inout/out 参数
 * 2. 在 main() 开头创建局部副本 (如 vec4 _local_v_TexCoord = v_TexCoord;)
 * 3. 在 main() 函数体内将所有引用替换为局部副本
 */
function fixVaryingModificationInFragment(source: string): string {
  // 收集所有 varying 声明: varying TYPE NAME;
  const varyingDecls = new Map<string, string>(); // name → type
  const varyingRegex = /\bvarying\s+(vec[234]|float|mat[234]|int|ivec[234])\s+(\w+)\s*;/g;
  let m;
  while ((m = varyingRegex.exec(source)) !== null) {
    varyingDecls.set(m[2], m[1]);
  }
  if (varyingDecls.size === 0) return source;

  // 提取 main() 函数体
  const mainMatch = source.match(/void\s+main\s*\(\s*\)\s*\{/);
  if (!mainMatch || mainMatch.index === undefined) return source;
  const mainStart = mainMatch.index + mainMatch[0].length;

  // 获取 main() 函数体（从 { 到匹配的 }）
  let depth = 1;
  let mainEnd = mainStart;
  for (let i = mainStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { mainEnd = i; break; }
    }
  }
  const mainBody = source.substring(mainStart, mainEnd);

  // 检测哪些 varying 在 main() 中被修改（赋值、++、-=、*=、/=、传给函数的非只读参数等）
  // 注意：需要排除局部变量声明（如 float timer = ...），这不是对 varying 的修改
  const modifiedVaryings = new Set<string>();
  const typeKeywords = /\b(?:float|int|vec[234]|mat[234]|ivec[234]|bvec[234]|bool|(?:(?:lowp|mediump|highp)\s+)?(?:float|int|vec[234]|mat[234]|ivec[234]|bvec[234]|bool))\s+$/;
  for (const [name] of varyingDecls) {
    // 检测直接赋值: name = ..., name.xyz = ..., name.xy *= ..., 等
    const assignRegex = new RegExp(`\\b${name}\\b\\s*(?:\\.[xyzwrgba]+)?\\s*(?:[+\\-*/]?=|\\+\\+|--)`, 'g');
    let match;
    let isModified = false;
    while ((match = assignRegex.exec(mainBody)) !== null) {
      // 检查匹配位置之前是否有类型关键字（说明这是局部变量声明，不是对 varying 的修改）
      const before = mainBody.substring(0, match.index);
      if (typeKeywords.test(before)) {
        continue; // 这是局部变量声明，跳过
      }
      isModified = true;
      break;
    }
    if (isModified) {
      modifiedVaryings.add(name);
    }
  }

  // 同时检测：varying 被传给签名中有 inout/out 的函数
  // 通用检测：找所有函数定义中 inout/out 参数的位置，然后检查调用处对应参数是否是 varying
  // 简化方案：扫描 source 中所有函数声明的 inout/out 参数位置
  const funcSignatures = new Map<string, Set<number>>(); // funcName → set of inout/out param indices
  const funcDefRegex = /\b(void|float|vec[234]|int|mat[234])\s+(\w+)\s*\(([^)]*)\)/g;
  let fm;
  while ((fm = funcDefRegex.exec(source)) !== null) {
    const funcName = fm[2];
    if (['main', 'if', 'for', 'while', 'return'].includes(funcName)) continue;
    const params = fm[3];
    const paramList = params.split(',');
    const inoutIndices = new Set<number>();
    for (let pi = 0; pi < paramList.length; pi++) {
      const param = paramList[pi].trim();
      if (/\b(inout|out)\b/.test(param)) {
        inoutIndices.add(pi);
      }
    }
    if (inoutIndices.size > 0) {
      funcSignatures.set(funcName, inoutIndices);
    }
  }

  // 检测函数调用中 varying 作为 inout/out 参数
  for (const [funcName, inoutIndices] of funcSignatures) {
    const callRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
    let cm;
    while ((cm = callRegex.exec(mainBody)) !== null) {
      const argsStart = cm.index + cm[0].length;
      // 简单解析参数（支持嵌套括号）
      const argsEnd = findClosingParenInStr(mainBody, argsStart);
      if (argsEnd < 0) continue;
      const argsStr = mainBody.substring(argsStart, argsEnd);
      const args = splitTopLevelArgs(argsStr);
      for (const idx of inoutIndices) {
        if (idx < args.length) {
          const arg = args[idx].trim();
          // 检查参数是否引用了某个 varying（可能带 swizzle）
          for (const [name] of varyingDecls) {
            if (new RegExp(`\\b${name}\\b`).test(arg)) {
              modifiedVaryings.add(name);
            }
          }
        }
      }
    }
  }

  if (modifiedVaryings.size === 0) return source;

  // 为被修改的 varying 生成局部副本声明
  const localDecls: string[] = [];
  for (const name of modifiedVaryings) {
    const type = varyingDecls.get(name)!;
    localDecls.push(`\t${type} _local_${name} = ${name};`);
  }

  // 在 main() 开头注入局部副本声明
  const injection = '\n' + localDecls.join('\n') + '\n';
  let result = source.substring(0, mainStart) + injection + source.substring(mainStart);

  // 在 main() 函数体内替换 varying 引用为局部副本
  // 注意：只替换 main() 内部，不替换 main() 外部的声明和其他函数
  const newMainStart = mainStart + injection.length;
  const newMainEnd = mainEnd + injection.length;
  const beforeMain = result.substring(0, newMainStart);
  let mainContent = result.substring(newMainStart, newMainEnd);
  const afterMain = result.substring(newMainEnd);

  for (const name of modifiedVaryings) {
    // 替换 main() 体内所有此 varying 的引用
    mainContent = mainContent.replace(new RegExp(`\\b${name}\\b`, 'g'), `_local_${name}`);
  }

  return beforeMain + mainContent + afterMain;
}

/** 在字符串中找到匹配的右括号 */
function findClosingParenInStr(str: string, startPos: number): number {
  let depth = 1;
  for (let i = startPos; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 修复 float uniform 用作 for 循环 int 变量的问题
 * 
 * WE 着色器有时用 float uniform 初始化 for 循环的 int 变量:
 *   for (int i = u_MinFreqRange; i < u_MaxFreqRange; i++)
 * 其中 u_MinFreqRange、u_MaxFreqRange 是 uniform float
 * GLSL ES 不允许 float 隐式转 int，需要包裹 int()
 */
function fixFloatUniformInForLoop(source: string): string {
  // 收集所有 float uniform 名称
  const floatUniforms = new Set<string>();
  const uniformRegex = /\buniform\s+(?:mediump\s+|highp\s+|lowp\s+)?float\s+(\w+)\s*;/g;
  let um;
  while ((um = uniformRegex.exec(source)) !== null) {
    floatUniforms.add(um[1]);
  }
  if (floatUniforms.size === 0) return source;

  // 匹配 for 循环: for (int VARNAME = EXPR; VARNAME CMP EXPR; VARNAME++)
  // 替换 EXPR 中的 float uniform 为 int(uniform)
  return source.replace(
    /\bfor\s*\(\s*int\s+(\w+)\s*=\s*([^;]+);\s*(\w+)\s*([<>=!]+)\s*([^;]+);\s*([^)]+)\)/g,
    (match, varName, initExpr, cmpVar, cmpOp, cmpExpr, incrExpr) => {
      let changed = false;
      let newInit = initExpr;
      let newCmp = cmpExpr;

      // 检查初始化表达式中的 float uniform
      for (const uname of floatUniforms) {
        const uRegex = new RegExp(`\\b${uname}\\b`, 'g');
        if (uRegex.test(newInit)) {
          newInit = newInit.replace(new RegExp(`\\b${uname}\\b`, 'g'), `int(${uname})`);
          changed = true;
        }
      }

      // 检查比较表达式中的 float uniform
      for (const uname of floatUniforms) {
        const uRegex = new RegExp(`\\b${uname}\\b`, 'g');
        if (uRegex.test(newCmp)) {
          newCmp = newCmp.replace(new RegExp(`\\b${uname}\\b`, 'g'), `int(${uname})`);
          changed = true;
        }
      }

      if (changed) {
        return `for (int ${varName} = ${newInit}; ${cmpVar} ${cmpOp} ${newCmp}; ${incrExpr})`;
      }
      return match;
    }
  );
}

/**
 * HLSL % 运算符修复
 * GLSL ES 1.0 中 % 只对 int 有效，HLSL 允许 float % float、float % int 等
 * 扫描每行中的 % 运算符，提取带平衡括号的 LHS 和 RHS 表达式，替换为 mod()
 */
function fixModuloOperator(source: string): string {
  return source.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return line;
    if (trimmed.startsWith('//')) return line;
    if (!line.includes('%')) return line;

    let result = line;
    let safety = 0;
    while (result.includes('%') && safety++ < 20) {
      const commentIdx = result.indexOf('//');
      let pctIdx = -1;
      for (let i = 0; i < result.length; i++) {
        if (commentIdx >= 0 && i >= commentIdx) break;
        if (result[i] === '%') { pctIdx = i; break; }
      }
      if (pctIdx < 0) break;

      // GLSL 中 % 仅对 int 有效，mod() 仅对 float 有效。
      // 当 % 位于 [...] 内部时，结果必须是 int（数组索引），保持 % 不变。
      let bracketDepth = 0;
      for (let j = 0; j < pctIdx; j++) {
        if (result[j] === '[') bracketDepth++;
        else if (result[j] === ']') bracketDepth--;
      }
      if (bracketDepth > 0) {
        result = result.slice(0, pctIdx) + '\x00PCT\x00' + result.slice(pctIdx + 1);
        continue;
      }

      // 提取 LHS
      let lEnd = pctIdx - 1;
      while (lEnd >= 0 && result[lEnd] === ' ') lEnd--;
      if (lEnd < 0) break;

      let lStart: number;
      if (result[lEnd] === ')') {
        let depth = 1;
        lStart = lEnd - 1;
        while (lStart >= 0 && depth > 0) {
          if (result[lStart] === ')') depth++;
          else if (result[lStart] === '(') depth--;
          if (depth > 0) lStart--;
        }
        while (lStart > 0 && /\w/.test(result[lStart - 1])) lStart--;
      } else if (/[\w.]/.test(result[lEnd])) {
        lStart = lEnd;
        while (lStart > 0 && /[\w.]/.test(result[lStart - 1])) lStart--;
      } else {
        break;
      }

      // 提取 RHS
      let rStart = pctIdx + 1;
      while (rStart < result.length && result[rStart] === ' ') rStart++;
      if (rStart >= result.length) break;

      let rEnd: number;
      if (result[rStart] === '(') {
        let depth = 1;
        rEnd = rStart + 1;
        while (rEnd < result.length && depth > 0) {
          if (result[rEnd] === '(') depth++;
          else if (result[rEnd] === ')') depth--;
          rEnd++;
        }
      } else if (/[\w.]/.test(result[rStart])) {
        rEnd = rStart;
        while (rEnd < result.length && /[\w.]/.test(result[rEnd])) rEnd++;
        if (rEnd < result.length && result[rEnd] === '(') {
          let depth = 1;
          rEnd++;
          while (rEnd < result.length && depth > 0) {
            if (result[rEnd] === '(') depth++;
            else if (result[rEnd] === ')') depth--;
            rEnd++;
          }
        }
      } else {
        break;
      }

      const lhs = result.slice(lStart, lEnd + 1);
      const rhs = result.slice(rStart, rEnd);
      if (!lhs || !rhs) break;

      // 如果两侧操作数都是明确的 int 类型（int() 强转、纯整数字面量、
      // 或无小数点的简单标识符且另一侧有 int() 标记），保持 % 不变。
      const looksLikeInt = (s: string) => /^int\s*\(/.test(s) || /^\d+$/.test(s);
      const hasFloat = (s: string) => s.includes('.') || /^float\s*\(/.test(s);
      if ((looksLikeInt(lhs) || looksLikeInt(rhs)) && !hasFloat(lhs) && !hasFloat(rhs)) {
        result = result.slice(0, pctIdx) + '\x00PCT\x00' + result.slice(pctIdx + 1);
        continue;
      }

      result = result.slice(0, lStart) + `mod(${lhs}, ${rhs})` + result.slice(rEnd);
    }

    // 恢复被保留的 % 运算符
    result = result.replace(/\x00PCT\x00/g, '%');

    return result;
  }).join('\n');
}

/**
 * 修复 const int 变量在 float 表达式中的使用
 * HLSL 允许 const int 与 float 隐式混合运算，但 GLSL ES 1.0 不允许。
 * 例如:
 *   const int sampleCount = 30;
 *   const float sampleDrop = sampleCount - 1;  // fixIntLiterals 会把 1→1.0 导致 int-float 错误
 *   albedo += sample * (i / sampleDrop);        // int / float = ERROR
 *
 * 此函数在 fixIntLiteralsForGLSL 之前运行：
 * 1. 将 const int X = N; 内联展开：移除声明，将所有 X 替换为字面量 N
 *    然后 fixIntLiteralsForGLSL 可按上下文正确决定 N → N.0 或保持 N
 * 2. 将 for 循环 int 变量在循环体中的算术使用包裹为 float()
 */
function fixConstIntUsage(source: string): string {
  const lines = source.split('\n');

  // Step 1: 收集 const int 声明（变量名 → 常量表达式），并移除声明行
  // 兼容：
  //   const int a = 3;
  //   const int a = QUALITY;
  //   const int a = (QUALITY + 1);
  const constIntPattern = /^(\s*)const\s+(?:(?:lowp|mediump|highp)\s+)?int\s+(\w+)\s*=\s*([^;]+)\s*;/;
  const constIntVars = new Map<string, string>(); // name → expr
  const result: string[] = [];
  const intVarNames = new Set<string>(); // 所有 int 类型的变量名（for 循环 + 函数参数 + 局部变量）
  const intMacroNames = new Set<string>(); // #define name 2 这类整型宏名

  for (const line of lines) {
    const m = line.match(constIntPattern);
    if (m) {
      constIntVars.set(m[2], m[3].trim());
      // 移除 const int 声明（值已内联到所有使用处）
      result.push(`${m[1]}// [inlined] const int ${m[2]} = ${m[3].trim()}`);
      continue;
    }

    // 收集整型宏：#define kernel 2
    // 仅收集纯整数字面量宏，避免把函数式宏或浮点宏误判。
    const intMacroMatch = line.match(/^\s*#define\s+(\w+)\s+(-?\d+)\b/);
    if (intMacroMatch) {
      intMacroNames.add(intMacroMatch[1]);
    }

    // 收集 for 循环的 int 变量名
    const forMatch = line.match(/\bfor\s*\(\s*int\s+(\w+)/);
    if (forMatch) {
      intVarNames.add(forMatch[1]);
    }

    // 收集函数参数中的 int 变量: void func(int name, ...) 或 (inout int name, ...)
    const funcParamMatch = line.match(/\([^)]*\)/g);
    if (funcParamMatch) {
      for (const params of funcParamMatch) {
        const paramList = params.slice(1, -1).split(',');
        for (const param of paramList) {
          const intParamMatch = param.trim().match(
            /\b(?:const\s+)?(?:in|out|inout)?\s*(?:(?:lowp|mediump|highp)\s+)?int\s+(\w+)/
          );
          if (intParamMatch) {
            intVarNames.add(intParamMatch[1]);
          }
        }
      }
    }

    // 收集局部 int 变量声明: int name = ...; / const int name = ...;
    const localIntMatch = line.match(/^\s*(?:(?:lowp|mediump|highp)\s+)?int\s+(\w+)/);
    if (localIntMatch && !line.includes('(')) {
      intVarNames.add(localIntMatch[1]);
    }
    const localConstIntMatch = line.match(
      /^\s*const\s+(?:(?:lowp|mediump|highp)\s+)?int\s+(\w+)/
    );
    if (localConstIntMatch && !line.includes('(')) {
      intVarNames.add(localConstIntMatch[1]);
    }

    result.push(line);
  }

  // Step 1b: 内联展开 const int 变量 → 常量表达式
  // 例如:
  //   sampleCount -> 30
  //   qualityStep -> (QUALITY + 1)
  // 后续 fixIntLiteralsForGLSL 会根据上下文处理整数字面量。
  let joined = result.join('\n');
  if (constIntVars.size > 0) {
    for (const [name, expr] of constIntVars) {
      joined = joined.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${expr})`);
    }
  }

  if (intVarNames.size === 0 && intMacroNames.size === 0) return joined;

  // Step 3: 将 int 宏/变量在算术和赋值上下文中包裹为 float()
  // 宏和变量使用相同的保守策略：仅在算术运算符（+ - * /）
  // 和赋值运算符（= += -= *= /=）上下文中包裹。
  // 不包裹比较上下文（== != < > 等），因为 int 宏展开后仍是 int 字面量，
  // 与 int 变量比较时无需转换，而与 float 的比较由 fixIntLiteralsForGLSL 处理。
  // 整数保留上下文（不包裹）：[...] 内部、for 循环头、int 声明、#define、函数签名
  const allIntNames = new Set([...intMacroNames, ...intVarNames]);

  return joined.split('\n').map(line => {
    const trimmed = line.trim();
    if (/\bfor\s*\(/.test(line)) return line;
    if (/^\s*(int|const\s+int)\b/.test(trimmed)) return line;
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return line;
    if (/^\s*(?:void|float|vec[234]|int|mat[234]|bool)\s+\w+\s*\(/.test(trimmed)) return line;

    // 将 [...] 内容暂存为占位符，避免在数组索引/大小中错误包裹 float()
    const bracketSlots: string[] = [];
    line = line.replace(/\[([^\[\]]*)\]/g, (_m, inner) => {
      bracketSlots.push(inner);
      return `[\x00BRACKET${bracketSlots.length - 1}\x00]`;
    });

    for (const v of allIntNames) {
      if (!new RegExp(`\\b${v}\\b`).test(line)) continue;
      // v 后面紧跟算术运算符
      line = line.replace(
        new RegExp(`(?<!\\.)\\b${v}\\b(?!\\s*\\[)(?=\\s*[+\\-*/])`, 'g'),
        `float(${v})`
      );
      // v 前面紧跟算术运算符
      line = line.replace(
        new RegExp(`([+\\-*/]\\s*)(?<!\\.)\\b${v}\\b(?!\\s*\\[)`, 'g'),
        `$1float(${v})`
      );
      // v 前面紧跟赋值运算符
      line = line.replace(
        new RegExp(`((?:\\+=|-=|\\*=|/=|(?<![!<>=])=(?!=))\\s*)(?<!\\.)\\b${v}\\b(?!\\s*\\[)`, 'g'),
        `$1float(${v})`
      );
      // v 在比较中且另一侧是 float 表达式: v == float(...) 或 v == N.N
      // 例: TRIANGLE == float(0) → float(TRIANGLE) == float(0)
      // 但 format == FORMAT_RG88（两侧都是 int）不受影响
      line = line.replace(
        new RegExp(`(?<!\\.)\\b${v}\\b(?!\\s*\\[)(?=\\s*(?:==|!=|<=?|>=?)\\s*(?:float\\s*\\(|\\d+\\.\\d*))`, 'g'),
        `float(${v})`
      );
      line = line.replace(
        new RegExp(`((?:float\\s*\\([^)]*\\)|\\d+\\.\\d*)\\s*(?:==|!=|<=|>=|<|>)\\s*)(?<!\\.)\\b${v}\\b(?!\\s*\\[)`, 'g'),
        `$1float(${v})`
      );
    }

    // 恢复 [...] 内容
    line = line.replace(/\[\x00BRACKET(\d+)\x00\]/g, (_m, idx) => {
      return `[${bracketSlots[Number(idx)]}]`;
    });

    return line;
  }).join('\n');
}

/**
 * 将 GLSL 中独立的整数字面量转换为浮点字面量
 * GLSL ES 不允许 int 与 float 之间的隐式类型转换，
 * 但 WE 着色器中常出现 float_expr * 4、*= 4 等写法，需要转为 4.0
 */
function fixIntLiteralsForGLSL(source: string): string {
  // 收集整型宏名：#define NAME INTEGER
  const intMacroNames = new Set<string>();
  for (const line of source.split('\n')) {
    const m = line.match(/^\s*#define\s+(\w+)\s+(-?\d+)\s*$/);
    if (m) intMacroNames.add(m[1]);
  }

  return source.split('\n').map(line => {
    if (line.trim().startsWith('#')) return line;
    if (/\bconst\s+int\b/.test(line)) return line;
    if (/^\s*int\s+/.test(line)) return line;
    if (/\bfor\s*\(/.test(line)) return line;

    return line.replace(/(?<![.\w])(\d+)(?![.\w])/g, (match, _digits, offset) => {
      const beforeChars = line.slice(Math.max(0, offset - 3), offset);
      if (/[eE][+-]?$/.test(beforeChars)) return match;

      // 跳过 [...] 内部
      const before = line.slice(0, offset);
      const openBrackets = (before.match(/\[/g) || []).length;
      const closeBrackets = (before.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) return match;

      // 跳过与 int 宏比较的字面量：MACRO == N 或 N == MACRO
      // 防止 #define TRANSPARENCY 2 展开后变成 2 == 2.0 (int == float)
      if (intMacroNames.size > 0) {
        const afterStr = line.slice(offset + match.length);
        // MACRO cmp N: 检查字面量前面是否有 "MACRO ==/!=/</>/<=/>=  "
        const beforeCmp = before.match(/(\w+)\s*([=!<>]=?|<=|>=)\s*$/);
        if (beforeCmp && intMacroNames.has(beforeCmp[1])) return match;
        // N cmp MACRO: 检查字面量后面是否有 " ==/!=/</>  MACRO"
        const afterCmp = afterStr.match(/^\s*([=!<>]=?|<=|>=)\s*(\w+)/);
        if (afterCmp && intMacroNames.has(afterCmp[2])) return match;
      }

      return match + '.0';
    });
  }).join('\n');
}

/**
 * 修复比较表达式中的 int(...) 强制转换与 float define 的冲突
 *
 * 例如：
 *   ALIGNMENT == int(1.0)   -> ALIGNMENT == float(1.0)
 *   int(1.0) == ALIGNMENT   -> float(1.0) == ALIGNMENT
 */
function fixIntCastInComparisons(source: string): string {
  let result = source;
  result = result.replace(
    /(\b[A-Za-z_]\w*\b)\s*([=!]=)\s*int\s*\(\s*([^)]+?)\s*\)/g,
    '$1 $2 float($3)'
  );
  result = result.replace(
    /int\s*\(\s*([^)]+?)\s*\)\s*([=!]=)\s*(\b[A-Za-z_]\w*\b)/g,
    'float($1) $2 $3'
  );
  return result;
}

/**
 * 最终修复 pass：处理 int 宏与 float 表达式之间的比较。
 * 在所有其他转换（fixConstIntUsage、fixIntLiteralsForGLSL 等）之后运行。
 *
 * 扫描 #define NAME INTEGER 收集所有 int 宏名称，然后将：
 *   MACRO == float(...)    →  float(MACRO) == float(...)
 *   MACRO == N.N           →  float(MACRO) == N.N
 *   float(...) == MACRO    →  float(...) == float(MACRO)
 *   N.N == MACRO           →  N.N == float(MACRO)
 *
 * 不影响 MACRO == MACRO2（两侧都是 int）的情况。
 */
function fixIntMacroFloatComparison(source: string): string {
  const intMacros = new Set<string>();
  for (const line of source.split('\n')) {
    const m = line.match(/^\s*#define\s+(\w+)\s+(-?\d+)\s*(?:\/\/.*)?$/);
    if (m) intMacros.add(m[1]);
  }
  if (intMacros.size === 0) return source;

  const macroPattern = [...intMacros].sort((a, b) => b.length - a.length).join('|');

  let result = source;

  // MACRO cmp float_expr:  MACRO == float(...) 或 MACRO == N.N
  result = result.replace(
    new RegExp(`\\b(${macroPattern})\\b(\\s*(?:==|!=|<=?|>=?)\\s*)(?=float\\s*\\(|\\d+\\.\\d)`, 'g'),
    'float($1)$2'
  );

  // float_expr cmp MACRO:  float(...) == MACRO 或 N.N == MACRO
  // 先处理 float(...)  cmp MACRO
  result = result.replace(
    new RegExp(`(float\\s*\\([^)]*\\)\\s*(?:==|!=|<=?|>=?)\\s*)\\b(${macroPattern})\\b`, 'g'),
    '$1float($2)'
  );
  // N.N cmp MACRO
  result = result.replace(
    new RegExp(`(\\d+\\.\\d*\\s*(?:==|!=|<=?|>=?)\\s*)\\b(${macroPattern})\\b`, 'g'),
    '$1float($2)'
  );

  return result;
}

/**
 * HLSL 兼容：将算术上下文中的 bool 比较表达式显式转换为 float
 * 示例：
 *   (a > b) * v   -> float(a > b) * v
 *   v * (a > b)   -> v * float(a > b)
 */
function fixBoolArithmetic(source: string): string {
  return source.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return line;

    // bool 比较在左侧参与算术： (expr_cmp) * something
    line = line.replace(
      /(\((?:[^()]*?(?:==|!=|<=|>=|<|>)[^()]*)\))(\s*[*/+\-])/g,
      (_match, expr, op) => `float${expr}${op}`
    );

    // bool 比较在右侧参与算术： something * (expr_cmp)
    line = line.replace(
      /([*/+\-]\s*)(\((?:[^()]*?(?:==|!=|<=|>=|<|>)[^()]*)\))/g,
      (_match, op, expr) => `${op}float${expr}`
    );

    return line;
  }).join('\n');
}

/**
 * GLSL ES 兼容性：修复 max/min(scalar_literal, vector_expr)
 * GLSL ES 1.0 只有 max(genType, float)，没有 max(float, genType)
 * 当第一个参数是数值字面量时，交换参数顺序
 */
function fixMaxMinArgOrder(source: string): string {
  // 匹配 max(数字, ...) 或 min(数字, ...) 模式
  // 只在第一个参数是纯数值字面量（如 0.0, 1.0）时交换
  return source.replace(
    /\b(max|min)\(\s*(\d+\.?\d*)\s*,\s*([^,()]+(?:\.[a-zA-Z]+)?)\s*\)/g,
    (match, fn, num, expr) => {
      // 如果第二个参数也是纯数值字面量，不需要交换（两个 float 的 max 是合法的）
      if (/^\s*\d+\.?\d*\s*$/.test(expr)) return match;
      return `${fn}(${expr}, ${num})`;
    }
  );
}

/**
 * 修复 wave/mask 代码中的 int/float 混用
 *
 * 常见于 workshop 的 multistage_wave 等效果：
 * - calWaveData(..., int overflowable) 与 step()/max() float 结果混用
 * - int unfeatheredMask = max(overflowable, step(...))
 *
 * 在 HLSL 中可隐式工作，但 GLSL ES 会报类型错误。
 */
function fixWaveMaskIntFloatMismatch(source: string): string {
  return fixWaveMaskIntFloatMismatchImpl(source);
}

/**
 * HLSL 隐式向量截断修复
 * 
 * HLSL 允许将高维向量赋值给低维变量（自动截断），例如：
 *   vec3 color = texture2D(sampler, uv);  // HLSL 合法，GLSL 报错
 * 
 * 此函数检测此类模式并添加适当的 swizzle：
 *   vec3 → .rgb,  vec2 → .rg,  float → .r
 */
function fixImplicitVecTruncation(source: string): string {
  return fixImplicitVecTruncationImpl(source);
}

/**
 * 判断字符串中指定位置是否在函数调用的括号内
 *
 * 通过向前扫描括号，构建括号栈：
 *   - word( → 函数调用括号（如 dot(、max(、normalize(）
 *   - 其他( → 分组括号（如 ((、+(）
 * 如果栈中有任何函数调用括号，则该位置在函数调用内。
 */
/**
 * HLSL 隐式向量维度不匹配修复（算术运算）
 *
 * HLSL 允许不同维度向量间的算术运算（自动截断高维到低维），GLSL ES 不允许。
 * 例如:
 *   vec2 da = vec4Var * vec2Var;           // GLSL ES 报错: vec4 * vec2 无效
 *   修复为: vec2 da = vec4Var.xy * vec2Var; // 显式截断 vec4 → vec2
 *
 * 策略:
 *   1. 扫描所有变量声明，构建 变量名 → 向量维度 的映射表（带冲突检测）
 *   2. 对每个 vec2/vec3/float 赋值语句，检查 RHS 中不在函数调用内的高维变量
 *   3. 对这些变量自动添加 swizzle（.xy / .xyz / .x）
 *
 * 安全措施:
 *   - 冲突检测：同名变量在不同作用域有不同类型（如 vec3 delta 和 float delta）→ 跳过
 *   - 函数调用检测：变量在 func(...) 内 → 跳过（如 dot(N, H) 中的 N 不应截断）
 */
function fixVecDimMismatchInBinaryOps(source: string): string {
  return fixVecDimMismatchInBinaryOpsImpl(source);
}

/**
 * 修复 vecN 变量与 vecM 构造器之间的二元运算维度不匹配
 *
 * 处理 known_var op vecM(...) 模式，无论代码位置（包括函数调用参数内部）。
 * fixVecDimMismatchInBinaryOps 只处理赋值语句且跳过函数调用内的变量，
 * 但有些维度不匹配发生在函数调用内的算术表达式中，如：
 *   abs(v_TexCoord - vec2(u_offset))  — v_TexCoord 是 vec4，需要截断为 .xy
 *
 * 此函数通过检测 "变量 op vecM(" 模式来修复这类问题。
 */
function fixBinaryOpVecConstructorMismatch(source: string): string {
  return fixBinaryOpVecConstructorMismatchImpl(source);
}

function fixTexture2DCoordDimension(source: string): string {
  return fixTexture2DCoordDimensionImpl(source);
}

// WebGL 安全上限：Intel Mac 约 15 vec4，Apple Silicon 约 31。取保守值确保兼容性。
const MAX_VARYING_VEC4 = 24;

/**
 * 限制 varying 数组大小以避免超出 WebGL MAX_VARYING_VECTORS 硬件限制。
 *
 * 某些 workshop 着色器声明了超大 varying 数组（如 varying vec4 audioValue[28]），
 * 超过 WebGL GPU 的 varying 槽位上限。此函数检测总 varying vec4 占用量，
 * 当超限时缩减最大的 varying 数组，保证着色器可编译。
 *
 * 常见模式：vec4 数组被用于打包 float 数据（每个 vec4 存 4 个 float），
 * 例如 audioValue[28] 实际只通过 audioValue[i/4] 访问，最大索引 = ceil(28/4)-1 = 6。
 * 此时原始 bufferRes (#define) 不需修改——它控制的是音频采样数而非数组大小。
 */
function capVaryingArrays(vertSrc: string, fragSrc: string): { vert: string; frag: string } {
  return capVaryingArraysImpl(vertSrc, fragSrc);
}

/**
 * 移除声明了但从未被引用的 sampler2D uniform
 */
function removeUnusedSamplers(source: string): string {
  return removeUnusedSamplersImpl(source);
}

// ==================== 公开 API ====================

/**
 * 加载并转译 WE 效果着色器
 * 
 * @param effectName 效果名称（如 "lightshafts"）
 * @param combos 场景中指定的 combo 值（如 { RAYMODE: 2, RAYCORNER: 0 }）
 * @param extraDefines 额外的预处理器定义（如 { DIRECTDRAW: 1 }）
 * @param availableTextureSlots 可用的纹理槽位索引列表（用于自动启用纹理触发的 combo）
 * @returns 转译结果，包含 WebGL GLSL 和纹理默认路径；加载失败返回 null
 */
export async function loadWEEffectShaders(
  effectName: string,
  combos: Record<string, number>,
  extraDefines: Record<string, number> = {},
  runtimeDefines: Record<string, number> = {},
  availableTextureSlots: number[] = [],
  preloadedSources?: { vert: string; frag: string },
  effectDirName?: string,
): Promise<TranspileResult | null> {
  return loadWEEffectShadersInternal(
    {
      effectName,
      combos,
      extraDefines,
      runtimeDefines,
      availableTextureSlots,
      preloadedSources,
      effectDirName,
    },
    {
      fetchShaderSource,
      resolveIncludes,
      preprocessShader: (source, defines) => normalizePreprocessorWhitespace(preprocessShader(source, defines)),
      transformWEToWebGL,
      normalizeHlslNumericSuffix,
      capVaryingArrays,
      fixVecDimMismatchInBinaryOps,
      fixBinaryOpVecConstructorMismatch,
      fixTexture2DCoordDimension,
    }
  );
}
