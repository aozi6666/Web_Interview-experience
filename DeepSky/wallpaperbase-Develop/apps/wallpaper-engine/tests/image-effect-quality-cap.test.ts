import { describe, expect, it } from 'vitest';

import { ImageLayer } from 'moyu-engine/scenario/layers/ImageLayer';

describe('image effect quality cap', () => {
  it('caps manual global effect quality', () => {
    ImageLayer.setAutoEffectQualityEnabled(false);
    ImageLayer.setGlobalEffectQualityCap(0.7);
    ImageLayer.setGlobalEffectQuality(1);

    expect(ImageLayer.applyAutoEffectQuality(0, 1920, 1080)).toBe(0.7);

    // restore defaults for other tests
    ImageLayer.setGlobalEffectQualityCap(1);
    ImageLayer.setGlobalEffectQuality(1);
    ImageLayer.setAutoEffectQualityEnabled(true);
  });

  it('caps auto effect quality result', () => {
    ImageLayer.setAutoEffectQualityEnabled(true);
    ImageLayer.setGlobalEffectQualityCap(0.6);

    expect(ImageLayer.applyAutoEffectQuality(80, 5120, 2880)).toBe(0.55);
    expect(ImageLayer.applyAutoEffectQuality(10, 1920, 1080)).toBe(0.6);

    // restore defaults for other tests
    ImageLayer.setGlobalEffectQualityCap(1);
    ImageLayer.setGlobalEffectQuality(1);
    ImageLayer.setAutoEffectQualityEnabled(true);
  });
});
