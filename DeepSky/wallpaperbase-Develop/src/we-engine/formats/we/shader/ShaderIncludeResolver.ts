import { logLoaderVerbose } from '../LoaderUtils';
import { fetchTextResource } from 'moyu-engine/utils';

const console = { ...globalThis.console, log: logLoaderVerbose };
const shaderCache: Map<string, string> = new Map();

function tokenizeShaderLines(source: string): string[] {
  return source.split('\n');
}

export function clearShaderCache(): void {
  shaderCache.clear();
}

export function registerIncludeSource(includeName: string, source: string): void {
  const url = `/assets/shaders/${includeName}`;
  shaderCache.set(url, source);
}

export async function fetchShaderSource(url: string): Promise<string> {
  if (shaderCache.has(url)) return shaderCache.get(url)!;
  try {
    const source = await fetchTextResource(url);
    if (!source) {
      console.warn(`ShaderTranspiler: 无法加载 ${url}`);
      return '';
    }
    shaderCache.set(url, source);
    return source;
  } catch (e) {
    console.warn(`ShaderTranspiler: 加载失败 ${url}`, e);
    return '';
  }
}

export function reorderGlobalDeclarations(source: string): string {
  const lines = source.split('\n');
  let firstFuncIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(?:void|float|int|vec[234]|mat[234]|bool|ivec[234])\s+\w+\s*\(/.test(trimmed) &&
      !/^void\s+main\s*\(/.test(trimmed)) {
      firstFuncIdx = i;
      break;
    }
  }
  if (firstFuncIdx === -1) return source;
  const beforeFunc = lines.slice(0, firstFuncIdx);
  const fromFunc = lines.slice(firstFuncIdx);
  const movedDecls: string[] = [];
  const remaining: string[] = [];
  let ifDepth = 0;
  for (const line of fromFunc) {
    const trimmed = line.trim();
    if (/^#if\b/.test(trimmed) || /^#ifdef\b/.test(trimmed) || /^#ifndef\b/.test(trimmed)) {
      ifDepth++;
      remaining.push(line);
    } else if (/^#endif\b/.test(trimmed)) {
      ifDepth = Math.max(0, ifDepth - 1);
      remaining.push(line);
    } else if (/^#else\b/.test(trimmed) || /^#elif\b/.test(trimmed)) {
      remaining.push(line);
    } else if (ifDepth === 0 && /^\s*(uniform|varying|attribute)\s+/.test(line)) {
      movedDecls.push(line);
    } else {
      remaining.push(line);
    }
  }
  if (movedDecls.length === 0) return source;
  return [...beforeFunc, ...movedDecls, '', ...remaining].join('\n');
}

export async function resolveIncludes(source: string): Promise<string> {
  const lines = tokenizeShaderLines(source);
  const result: string[] = [];
  const resolved = new Set<string>();
  const requiredSources: string[] = [];

  for (const line of lines) {
    const includeMatch = line.match(/^\s*#include\s+"([^"]+)"/);
    if (includeMatch) {
      const includeName = includeMatch[1];
      if (resolved.has(includeName)) {
        result.push(`// [已内联] ${includeName}`);
        continue;
      }
      resolved.add(includeName);
      const includeSource = await fetchShaderSource(`/assets/shaders/${includeName}`);
      if (includeSource) {
        const nested = await resolveIncludes(includeSource);
        result.push(`// --- begin ${includeName} ---`);
        result.push(nested);
        result.push(`// --- end ${includeName} ---`);
      } else {
        result.push(`// [未找到] ${includeName}`);
      }
      continue;
    }

    const requireMatch = line.match(/^\s*#require\s+"([^"]+)"/);
    if (requireMatch) {
      const requireName = requireMatch[1];
      if (resolved.has(requireName)) continue;
      resolved.add(requireName);
      const requireSource = await fetchShaderSource(`/assets/shaders/${requireName}`);
      if (requireSource) {
        const nested = await resolveIncludes(requireSource);
        requiredSources.push(`// --- begin require ${requireName} ---\n${nested}\n// --- end require ${requireName} ---`);
      }
      continue;
    }

    result.push(line);
  }

  if (requiredSources.length > 0) {
    const joinedResult = result.join('\n');
    const mainIndex = joinedResult.search(/void\s+main\s*\(/);
    if (mainIndex >= 0) {
      const before = joinedResult.substring(0, mainIndex);
      const after = joinedResult.substring(mainIndex);
      return reorderGlobalDeclarations(before + '\n' + requiredSources.join('\n') + '\n\n' + after);
    }
    return reorderGlobalDeclarations(joinedResult + '\n' + requiredSources.join('\n'));
  }

  return reorderGlobalDeclarations(result.join('\n'));
}
