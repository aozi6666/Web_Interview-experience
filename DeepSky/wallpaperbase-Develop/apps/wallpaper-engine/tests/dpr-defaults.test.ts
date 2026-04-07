import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DPR defaults', () => {
  it('keeps backend default max dpr at 2.0', () => {
    const backendPath = resolve(process.cwd(), '../../moyu-engine/rendering/threejs/ThreeBackend.ts');
    const source = readFileSync(backendPath, 'utf8');
    expect(source).toContain('private static readonly DEFAULT_MAX_DPR = 2.0;');
  });

  it('keeps app gpu tuning default max dpr at 2.0', () => {
    const rendererPath = resolve(process.cwd(), 'app/renderer.ts');
    const source = readFileSync(rendererPath, 'utf8');
    expect(source).toContain('maxDpr: 2.0,');
  });

  it('initializes backend with text-safe max dpr', () => {
    const rendererPath = resolve(process.cwd(), 'app/renderer.ts');
    const source = readFileSync(rendererPath, 'utf8');
    expect(source).toContain('const TEXT_SAFE_MAX_DPR = 2.0;');
    expect(source).toContain('maxDpr: TEXT_SAFE_MAX_DPR,');
  });
});
