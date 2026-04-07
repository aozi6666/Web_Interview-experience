import { describe, expect, it } from 'vitest';

import { resolveSystemUserTextureBindingName } from 'formats/we/scene/EffectLoader';

describe('EffectLoader usertextures mapping', () => {
  it('maps media thumbnail system textures to global rt names', () => {
    expect(resolveSystemUserTextureBindingName('$mediaThumbnail', 'system')).toBe('_rt_AlbumCover');
    expect(resolveSystemUserTextureBindingName('$mediaPreviousThumbnail', 'system')).toBe('_rt_AlbumCoverPrevious');
  });

  it('ignores non-system or unknown usertextures', () => {
    expect(resolveSystemUserTextureBindingName('$mediaThumbnail', 'custom')).toBeNull();
    expect(resolveSystemUserTextureBindingName('$unknownTexture', 'system')).toBeNull();
    expect(resolveSystemUserTextureBindingName(undefined, 'system')).toBeNull();
  });
});
