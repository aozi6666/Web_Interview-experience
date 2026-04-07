import { describe, expect, it } from 'vitest';

import { buildEffectObjectMaterialLoadPaths } from '../../../src/we-engine/formats/we/scene/EffectMaterialPathResolver';

describe('EffectObject material path resolution', () => {
  it('treats materials/* as project-root paths', () => {
    const resolved = buildEffectObjectMaterialLoadPaths(
      'effects/lightshafts/effect.json',
      'materials/effects/lightshafts.json',
    );

    expect(resolved.filePath).toBe('materials/effects/lightshafts.json');
    expect(resolved.fallbackPaths).toEqual([
      '/assets/effects/lightshafts/materials/effects/lightshafts.json',
      '/assets/materials/effects/lightshafts.json',
    ]);
  });

  it('resolves relative material path under effect directory', () => {
    const resolved = buildEffectObjectMaterialLoadPaths(
      'effects/workshop/3219510589/opacity/effect.json',
      'opacity.json',
    );

    expect(resolved.filePath).toBe('effects/workshop/3219510589/opacity/opacity.json');
    expect(resolved.fallbackPaths).toEqual([
      '/assets/effects/workshop/3219510589/opacity/opacity.json',
      '/assets/opacity.json',
    ]);
  });
});
