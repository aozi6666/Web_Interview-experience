import { describe, expect, it } from 'vitest';

import { createEffectLayer } from 'moyu-engine/scenario/layers/EffectLayer';

describe('EffectLayer descriptor serialization', () => {
  it('preserves dynamicTextureBinds in descriptor', () => {
    const layer = createEffectLayer({
      id: 'effect-dynamic-bind',
      name: 'effect-dynamic-bind',
      width: 100,
      height: 100,
      vertexShader: 'void main(){gl_Position=vec4(0.0);}',
      fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
      dynamicTextureBinds: [
        { uniformName: 'g_Texture1', bindingName: '_rt_AlbumCover' },
      ],
    });

    const descriptor = layer.toDescriptor();
    expect(descriptor.dynamicTextureBinds).toEqual([
      { uniformName: 'g_Texture1', bindingName: '_rt_AlbumCover' },
    ]);
  });
});
