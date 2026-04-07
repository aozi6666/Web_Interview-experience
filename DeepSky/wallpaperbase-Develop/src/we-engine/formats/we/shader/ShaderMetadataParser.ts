/**
 * Uniform 的材质属性映射信息
 * 从着色器注释中的 {"material":"xxx"} 提取
 */
export interface UniformMaterialInfo {
  /** GLSL uniform 变量名（如 g_Speed） */
  uniformName: string;
  /** GLSL 类型（float, vec2, vec3, vec4, int） */
  type: string;
  /** 默认值（字符串格式，如 "0.5 0.1"） */
  defaultValue?: string;
  /** 是否为位置类型 uniform（来自注释元数据 position:true） */
  isPosition?: boolean;
}

/**
 * 从字符串中提取平衡的 JSON 对象（处理嵌套 {} ）
 * 从 startPos 处的 '{' 开始，找到匹配的 '}'
 */
function extractBalancedJSON(source: string, startPos: number): string | null {
  if (source[startPos] !== '{') return null;
  let depth = 0;
  for (let i = startPos; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(startPos, i + 1);
    }
  }
  return null;
}

/**
 * 从着色器源码的 // [COMBO] 注释中提取 combo 默认值
 * 格式: // [COMBO] {"combo":"RAYMODE","default":0,...}
 */
function normalizeComboValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function isComboRequireSatisfied(
  requireSpec: unknown,
  contextDefines: Record<string, number> | undefined,
): boolean {
  if (!requireSpec || typeof requireSpec !== 'object') return true;
  const req = requireSpec as Record<string, unknown>;
  if (!contextDefines) return true;
  for (const [key, expectedValueRaw] of Object.entries(req)) {
    const expectedValue = normalizeComboValue(expectedValueRaw);
    const actualValue = contextDefines[key];
    if (actualValue !== expectedValue) return false;
  }
  return true;
}

export function parseComboDefaults(
  source: string,
  contextDefines?: Record<string, number>,
): Record<string, number> {
  const defaults: Record<string, number> = {};
  const prefix = /\/\/\s*\[COMBO\]\s*/g;
  let match;

  while ((match = prefix.exec(source)) !== null) {
    const jsonStart = match.index + match[0].length;
    const jsonStr = extractBalancedJSON(source, jsonStart);
    if (!jsonStr) continue;
    try {
      const meta = JSON.parse(jsonStr);
      if (meta.combo && meta.default !== undefined && isComboRequireSatisfied(meta.require, contextDefines)) {
        defaults[meta.combo] = normalizeComboValue(meta.default);
      }
    } catch {
      // JSON 解析失败，跳过
    }
  }

  return defaults;
}

/**
 * 从 uniform 声明注释中提取纹理默认路径
 * 格式: uniform sampler2D g_Texture1; // {"default":"util/noise",...}
 */
export function parseTextureDefaults(source: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  const prefix = /uniform\s+sampler2D\s+(\w+)\s*;\s*\/\/\s*/g;
  let match;

  while ((match = prefix.exec(source)) !== null) {
    const uniformName = match[1];
    const jsonStart = match.index + match[0].length;
    const jsonStr = extractBalancedJSON(source, jsonStart);
    if (!jsonStr) continue;
    try {
      const meta = JSON.parse(jsonStr);
      if (meta.default) {
        defaults[uniformName] = meta.default;
      }
    } catch {
      // JSON 解析失败，跳过
    }
  }

  return defaults;
}

export interface TextureSlotComboMeta {
  combo: string;
  paintDefaultColor?: string;
  require?: Record<string, unknown>;
}

/**
 * 从 uniform sampler2D 注释提取纹理槽位 combo 元数据（combo / paintdefaultcolor / require）。
 * 调用方据此决定是否激活 combo：槽位有纹理 → 激活；无纹理但有 paintdefaultcolor 且 require 满足 → 也激活。
 */
export function parseTextureCombos(source: string): Record<number, TextureSlotComboMeta> {
  const combos: Record<number, TextureSlotComboMeta> = {};
  const prefix = /uniform\s+sampler2D\s+g_Texture(\d+)\s*;\s*\/\/\s*/g;
  let match;

  while ((match = prefix.exec(source)) !== null) {
    const slotIndex = parseInt(match[1], 10);
    const jsonStart = match.index + match[0].length;
    const jsonStr = extractBalancedJSON(source, jsonStart);
    if (!jsonStr) continue;
    try {
      const meta = JSON.parse(jsonStr);
      if (meta.combo) {
        const entry: TextureSlotComboMeta = { combo: meta.combo };
        if (meta.paintdefaultcolor) entry.paintDefaultColor = meta.paintdefaultcolor;
        if (meta.require) entry.require = meta.require;
        combos[slotIndex] = entry;
      }
    } catch {
      // JSON 解析失败，跳过
    }
  }

  return combos;
}

/**
 * 从着色器源码的 uniform 注释中提取 material 属性映射
 */
export function parseUniformMaterialMap(vertSrc: string, fragSrc: string): Record<string, UniformMaterialInfo> {
  const result: Record<string, UniformMaterialInfo> = {};
  const allSrc = vertSrc + '\n' + fragSrc;

  const systemUniforms = new Set([
    'g_Time', 'g_ModelViewProjectionMatrix', 'g_ModelViewProjectionMatrixInverse',
    'g_ViewUp', 'g_ViewRight', 'g_EyePosition', 'g_PointerPosition',
    'g_ModelMatrix', 'g_ViewProjectionMatrix',
  ]);

  const annotatedRegex = /uniform\s+(float|vec[234]|int|mat[234])\s+([gmu]_\w+)\s*;\s*\/\/\s*/g;
  let match;

  while ((match = annotatedRegex.exec(allSrc)) !== null) {
    const type = match[1];
    const uniformName = match[2];
    if (systemUniforms.has(uniformName) || uniformName.match(/^g_Texture\d/)) continue;

    const jsonStart = match.index + match[0].length;
    const jsonStr = extractBalancedJSON(allSrc, jsonStart);
    if (!jsonStr) continue;

    try {
      const meta = JSON.parse(jsonStr);
      if (meta.hidden) continue;

      const materialKey: string = meta.material || uniformName.replace(/^g_/, '').toLowerCase();
      const defaultValue = meta.default !== undefined ? String(meta.default) : undefined;
      const isPosition = meta.position === true || meta.attachmentproject === true;
      const info: UniformMaterialInfo = { uniformName, type, defaultValue, isPosition };

      if (!result[materialKey]) {
        result[materialKey] = info;
      }
      if (meta.label && meta.label !== materialKey && !result[meta.label]) {
        result[meta.label] = info;
      }
    } catch {
      const fallbackKey = uniformName.replace(/^g_/, '').toLowerCase();
      if (!result[fallbackKey]) {
        result[fallbackKey] = { uniformName, type };
      }
    }
  }

  const simpleRegex = /uniform\s+(float|vec[234]|int|mat[234])\s+([gmu]_\w+)\s*;/g;
  while ((match = simpleRegex.exec(allSrc)) !== null) {
    const type = match[1];
    const uniformName = match[2];
    if (systemUniforms.has(uniformName) || uniformName.match(/^g_Texture\d/)) continue;
    const alreadyMapped = Object.values(result).some((v) => v.uniformName === uniformName);
    if (alreadyMapped) continue;
    const fallbackKey = uniformName.replace(/^g_/, '').toLowerCase();
    if (!result[fallbackKey]) {
      result[fallbackKey] = { uniformName, type };
    }
  }

  return result;
}
