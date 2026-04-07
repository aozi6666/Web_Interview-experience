import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadWEEffectShaders, registerIncludeSource } from 'formats/we/shader';

const EFFECTS_ROOT = path.resolve(process.cwd(), '../../resources/assets/effects');
const SHADERS_ROOT = path.resolve(process.cwd(), '../../resources/assets/shaders');

const EFFECT_CATEGORIES: Record<string, string[]> = {
  animation: ['foliagesway', 'iris', 'pulse', 'cloudmotion', 'scroll', 'shake', 'spin', 'swing', 'twirl', 'waterflow', 'waterripple', 'waterwaves'],
  blur: ['blur', 'blurprecise', 'motionblur', 'blurradial'],
  interactive: ['cursorripple', 'fluidsimulation', 'depthparallax', 'xray'],
  colorization: ['blend', 'blendgradient', 'chromaticaberration', 'clouds', 'colorkey', 'filmgrain', 'glitter', 'shimmer', 'fire', 'lightshafts', 'nitro', 'opacity', 'reflection', 'tint', 'vhs', 'watercaustics'],
  distortion: ['fisheye', 'perspective', 'refraction', 'skew', 'transform'],
  enhancement: ['edgedetection', 'godrays', 'localcontrast', 'shine'],
};

function walkFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function registerAllIncludeHeaders(): void {
  const headerFiles = walkFiles(SHADERS_ROOT).filter((f) => f.endsWith('.h'));
  for (const headerPath of headerFiles) {
    const source = fs.readFileSync(headerPath, 'utf-8');
    const relative = path.relative(SHADERS_ROOT, headerPath).replace(/\\/g, '/');
    const basename = path.basename(headerPath);
    registerIncludeSource(relative, source);
    if (basename !== relative) registerIncludeSource(basename, source);
  }
}

function loadJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 兼容少数资源文件中的尾逗号
    const sanitized = raw
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    return JSON.parse(sanitized) as T;
  }
}

function resolveMaterialPath(effectDir: string, materialPath: string): string {
  const local = path.join(effectDir, materialPath);
  if (fs.existsSync(local)) return local;
  const global = path.resolve(process.cwd(), '../../resources/assets', materialPath);
  if (fs.existsSync(global)) return global;
  throw new Error(`找不到 material 文件: ${materialPath}`);
}

function resolveShaderPaths(effectName: string, shaderName: string): { vertPath: string; fragPath: string; dirName: string } {
  const localVert = path.join(EFFECTS_ROOT, effectName, 'shaders/effects', `${shaderName}.vert`);
  const localFrag = path.join(EFFECTS_ROOT, effectName, 'shaders/effects', `${shaderName}.frag`);
  if (fs.existsSync(localVert) && fs.existsSync(localFrag)) {
    return { vertPath: localVert, fragPath: localFrag, dirName: effectName };
  }

  const parts = shaderName.split('_');
  for (let i = 1; i <= parts.length; i++) {
    const candidate = parts.slice(0, i).join('_');
    const vertPath = path.join(EFFECTS_ROOT, candidate, 'shaders/effects', `${shaderName}.vert`);
    const fragPath = path.join(EFFECTS_ROOT, candidate, 'shaders/effects', `${shaderName}.frag`);
    if (fs.existsSync(vertPath) && fs.existsSync(fragPath)) {
      return { vertPath, fragPath, dirName: candidate };
    }
  }

  const globalVert = path.join(SHADERS_ROOT, `${shaderName}.vert`);
  const globalFrag = path.join(SHADERS_ROOT, `${shaderName}.frag`);
  if (fs.existsSync(globalVert) && fs.existsSync(globalFrag)) {
    return { vertPath: globalVert, fragPath: globalFrag, dirName: effectName };
  }

  throw new Error(`找不到 shader 文件: ${effectName}/${shaderName}`);
}

describe('effects alignment verification', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input.toString();
      if (raw.startsWith('/assets/')) {
        const abs = path.resolve(process.cwd(), '../../resources', raw.replace(/^\/+/, ''));
        if (!fs.existsSync(abs)) {
          return new Response('Not Found', { status: 404 });
        }
        const body = fs.readFileSync(abs);
        return new Response(body, { status: 200 });
      }
      return originalFetch(input as any, init);
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  registerAllIncludeHeaders();

  for (const [category, effectNames] of Object.entries(EFFECT_CATEGORIES)) {
    it(`should transpile all ${category} effects`, async () => {
      for (const effectName of effectNames) {
        const effectPath = path.join(EFFECTS_ROOT, effectName, 'effect.json');
        expect(fs.existsSync(effectPath), `${effectName} 缺少 effect.json`).toBe(true);
        const effectJson = loadJson<{
          passes?: Array<{ material?: string; command?: string }>;
          replacementkey?: string;
        }>(effectPath);
        const passes = effectJson.passes ?? [];
        expect(passes.length, `${effectName} 无 passes`).toBeGreaterThan(0);

        for (const pass of passes) {
          if (!pass.material || pass.command) continue;
          const matPath = resolveMaterialPath(path.join(EFFECTS_ROOT, effectName), pass.material);
          const materialJson = loadJson<{ passes?: Array<{ shader?: string }> }>(matPath);
          const shaderPath = materialJson.passes?.[0]?.shader;
          expect(typeof shaderPath, `${effectName} material 缺少 shader`).toBe('string');
          const shaderName = (shaderPath as string).replace(/^effects\//, '');
          const { vertPath, fragPath, dirName } = resolveShaderPaths(effectName, shaderName);

          const transpiled = await loadWEEffectShaders(
            shaderName,
            {},
            {},
            {},
            [],
            {
              vert: fs.readFileSync(vertPath, 'utf-8'),
              frag: fs.readFileSync(fragPath, 'utf-8'),
            },
            dirName,
          );
          expect(transpiled, `${effectName} pass(${shaderName}) 转译失败`).toBeTruthy();
          expect(transpiled?.vertexShader.length ?? 0).toBeGreaterThan(0);
          expect(transpiled?.fragmentShader.length ?? 0).toBeGreaterThan(0);
        }
      }
    });
  }
});
