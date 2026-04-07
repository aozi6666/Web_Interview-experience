import { describe, expect, it } from 'vitest';

import { resolveTextCanvasRasterPlan } from 'moyu-engine/scenario/layers/TextLayer';
import { TextureFilter } from 'moyu-engine/rendering/interfaces/ITexture';

describe('Text canvas raster regression baselines', () => {
  it('matches expected canvas size trend for sample wallpapers', () => {
    const p3446971952 = resolveTextCanvasRasterPlan({
      width: 800,
      height: 260,
      scaleX: 0.2449,
      scaleY: 0.24773,
      dpr: 2,
    });
    const p3581882134 = resolveTextCanvasRasterPlan({
      width: 800,
      height: 260,
      scaleX: 0.35033328,
      scaleY: 0.3463308,
      dpr: 2,
    });
    const p3347978935 = resolveTextCanvasRasterPlan({
      width: 800,
      height: 260,
      scaleX: 0.63346,
      scaleY: 0.63346,
      dpr: 2,
    });

    expect(p3446971952.generateMipmaps).toBe(false);
    expect(p3581882134.generateMipmaps).toBe(false);
    expect(p3347978935.generateMipmaps).toBe(false);
    expect(p3446971952.minFilter).toBe(TextureFilter.Linear);
    expect(p3581882134.minFilter).toBe(TextureFilter.Linear);
    expect(p3347978935.minFilter).toBe(TextureFilter.Linear);

    // 无效果：画布像素按物理显示尺寸计算 width * scaleX * dpr。
    expect(p3446971952.canvasWidth).toBe(392);
    expect(p3581882134.canvasWidth).toBe(561);
    expect(p3347978935.canvasWidth).toBe(1014);
  });

});
