import { describe, expect, it } from 'vitest';

import { resolveLayerParallaxDepth, WE_DEFAULT_PARALLAX_DEPTH } from 'formats/we/LoaderUtils';

describe('parallax depth resolution', () => {
  it('inherits parent parallax depth when child depth is missing', () => {
    const resolved = resolveLayerParallaxDepth({
      _weInheritedParallaxDepth: '0.03 0.03',
    });
    expect(resolved).toEqual([0.03, 0.03]);
  });

  it('keeps explicit child parallax depth even when inherited value exists', () => {
    const resolved = resolveLayerParallaxDepth({
      parallaxDepth: '0 0',
      _weInheritedParallaxDepth: '0.03 0.03',
    });
    expect(resolved).toEqual([0, 0]);
  });

  it('falls back to default depth when both explicit and inherited values are missing', () => {
    const resolved = resolveLayerParallaxDepth({});
    expect(resolved).toEqual(WE_DEFAULT_PARALLAX_DEPTH);
  });
});
