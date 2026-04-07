import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Three backend texture defaults', () => {
  it('enables mipmap sampling for URL textures', () => {
    const helperPath = resolve(process.cwd(), '../../moyu-engine/rendering/threejs/ThreeBackendHelpers.ts');
    const source = readFileSync(helperPath, 'utf8');
    expect(source).toContain('texture.generateMipmaps = true;');
    expect(source).toContain('texture.minFilter = THREE.LinearMipmapLinearFilter;');
    expect(source).toContain('texture.magFilter = THREE.LinearFilter;');
  });
});
