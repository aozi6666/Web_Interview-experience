import { describe, expect, it } from 'vitest';

import { buildFetchPaths } from '../../../src/we-engine/formats/we/ResourceFetchPaths';

describe('ResourceIO buildFetchPaths', () => {
  it('drops relative fallback paths in pkg mode', () => {
    const fakePkg = {
      version: 'PKGV0023',
      entries: [],
      data: new ArrayBuffer(0),
    };
    const paths = buildFetchPaths(fakePkg, 'materials/effects/lightshafts.json', [
      'materials/effects/lightshafts.json',
      '/assets/materials/effects/lightshafts.json',
    ]);

    expect(paths).toEqual(['/assets/materials/effects/lightshafts.json']);
  });

  it('keeps relative paths in non-pkg mode', () => {
    const paths = buildFetchPaths(null, 'materials/effects/lightshafts.json', [
      'materials/effects/lightshafts.json',
      '/assets/materials/effects/lightshafts.json',
    ]);

    expect(paths).toEqual([
      'materials/effects/lightshafts.json',
      'materials/effects/lightshafts.json',
      '/assets/materials/effects/lightshafts.json',
    ]);
  });
});
