import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Scene loader module boundaries', () => {
  it('exposes split loaders as standalone modules', () => {
    const sceneDir = resolve(process.cwd(), '../../formats/we/scene');
    expect(readFileSync(resolve(sceneDir, 'EffectObjectLoader.ts'), 'utf8').length).toBeGreaterThan(0);
    expect(readFileSync(resolve(sceneDir, 'TextObjectLoader.ts'), 'utf8').length).toBeGreaterThan(0);
    expect(readFileSync(resolve(sceneDir, 'SoundObjectLoader.ts'), 'utf8').length).toBeGreaterThan(0);
  });

  it('re-exports split loaders from scene index', () => {
    const indexPath = resolve(process.cwd(), '../../formats/we/scene/index.ts');
    const indexContent = readFileSync(indexPath, 'utf8');
    expect(indexContent).toContain("export * from './EffectObjectLoader';");
    expect(indexContent).toContain("export * from './TextObjectLoader';");
    expect(indexContent).toContain("export * from './SoundObjectLoader';");
  });
});
