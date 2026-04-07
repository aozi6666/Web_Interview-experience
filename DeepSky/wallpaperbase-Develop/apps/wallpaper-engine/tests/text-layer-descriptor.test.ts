import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createTextLayer,
  remapTextEdgeAlpha,
  resolveTextCanvasRasterPlan,
  resolveCenterBaselineStartY,
} from 'moyu-engine/scenario/layers/TextLayer';
import { TextureFilter } from 'moyu-engine/rendering/interfaces/ITexture';

describe('TextLayer descriptor serialization', () => {
  it('does not serialize legacy canvas gradient field', () => {
    const layer = createTextLayer({
      id: 'text-gradient-runtime',
      name: 'text-gradient-runtime',
      width: 320,
      height: 120,
      text: 'hello',
    });

    const descriptor = layer.toDescriptor();
    expect(descriptor).not.toHaveProperty('gradientColors');
  });

  it('preserves effect pipeline config in descriptor', () => {
    const layer = createTextLayer({
      id: 'text-perspective',
      name: 'text-perspective',
      width: 320,
      height: 120,
      text: '13:14',
      effectPasses: [{
        effectName: 'perspective',
        uniforms: {
          g_Point0: { x: 0.24, y: 0.16 },
          g_Point1: { x: 0.73, y: 0.42 },
          g_Point2: { x: 0.71, y: 1.09 },
          g_Point3: { x: 0.18, y: 0.78 },
        },
      }],
      effectFbos: [{ name: '_rt_test', scale: 1 }],
      textureSize: [320, 120],
      effectQuality: 0.9,
    });

    const descriptor = layer.toDescriptor();
    expect(descriptor.effectPasses).toHaveLength(1);
    expect(descriptor.effectFbos).toEqual([{ name: '_rt_test', scale: 1 }]);
    expect(descriptor.textureSize).toEqual([320, 120]);
    expect(descriptor.effectQuality).toBeCloseTo(0.9, 6);
  });
});

describe('TextLayer center baseline layout', () => {
  it('applies upward bias when scaled padding dominates canvas height', () => {
    // Matches Date-like case: padding is larger than half canvas height.
    const h = 136;
    const padding = 128;
    const blockSpan = 0;
    const startY = resolveCenterBaselineStartY(h, blockSpan, padding);
    expect(startY).toBeCloseTo(136 / 3, 6);
  });

  it('keeps true center when padding does not dominate canvas height', () => {
    // Matches Day-like case: canvas is large enough, no center drift expected.
    const h = 974;
    const padding = 179;
    const blockSpan = 0;
    const startY = resolveCenterBaselineStartY(h, blockSpan, padding);
    expect(startY).toBeCloseTo(h / 2, 6);
  });
});

describe('TextLayer edge alpha remap', () => {
  it('keeps anti-aliased low alpha pixels instead of hard-clipping', () => {
    // Current issue: hard threshold made low alpha become 0 and introduced jagged edges.
    expect(remapTextEdgeAlpha(100)).toBeGreaterThan(0);
    expect(remapTextEdgeAlpha(80)).toBeGreaterThan(0);
  });

  it('is monotonic and preserves full opaque alpha', () => {
    expect(remapTextEdgeAlpha(255)).toBe(255);
    expect(remapTextEdgeAlpha(101)).toBeLessThan(remapTextEdgeAlpha(128));
    expect(remapTextEdgeAlpha(128)).toBeLessThan(remapTextEdgeAlpha(200));
  });

  it('preserves low-mid alpha gradients for smoother edges', () => {
    // Edge smoothness regression guard: low-mid alpha should not be over-eroded.
    expect(remapTextEdgeAlpha(64)).toBeGreaterThanOrEqual(60);
    expect(remapTextEdgeAlpha(96)).toBeGreaterThanOrEqual(92);
  });
});

describe('Text loader scale normalization', () => {
  it('uses coverScale normalization in text scale formula', () => {
    const loaderPath = resolve(process.cwd(), '../../formats/we/scene/TextObjectLoader.ts');
    const source = readFileSync(loaderPath, 'utf8');
    expect(source).toContain('const REF_COVER_SCALE = 0.5;');
    expect(source).toContain('const coverScaleNorm = Math.min(1, coverScale / REF_COVER_SCALE);');
    expect(source).toContain('return scaleCompH * FONT_SIZE_MULTIPLIER * coverScaleNorm;');
  });

  it('keeps perspective points on wallpaper 3487328036 text layer 240', () => {
    const scenePath = resolve(process.cwd(), '../../resources/wallpapers/3487328036/extracted/scene.json');
    const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as {
      objects?: Array<{ id?: number; effects?: Array<{ passes?: Array<{ constantshadervalues?: Record<string, string> }> }> }>;
    };
    const layer240 = scene.objects?.find((obj) => obj.id === 240);
    expect(layer240).toBeTruthy();
    const values = layer240?.effects?.[0]?.passes?.[0]?.constantshadervalues ?? {};
    expect(values.point0).toBe('0.24683 0.16306');
    expect(values.point1).toBe('0.73596 0.42016');
    expect(values.point2).toBe('0.71718 1.09810');
    expect(values.point3).toBe('0.18609 0.78810');
  });
});

describe('Text canvas raster plan', () => {
  it('matches physical display pixels for minified text', () => {
    const plan = resolveTextCanvasRasterPlan({
      width: 800,
      height: 260,
      scaleX: 0.2449,
      scaleY: 0.24773,
      dpr: 2,
    });

    expect(plan.canvasWidth).toBe(392);
    expect(plan.canvasHeight).toBe(129);
    expect(plan.textPixelRatio).toBeCloseTo(0.49, 2);
    expect(plan.generateMipmaps).toBe(false);
    expect(plan.minFilter).toBe(TextureFilter.Linear);
  });

  it('keeps linear filtering when scale is near 1', () => {
    const plan = resolveTextCanvasRasterPlan({
      width: 800,
      height: 260,
      scaleX: 1,
      scaleY: 1,
      dpr: 2,
    });

    expect(plan.canvasWidth).toBe(1600);
    expect(plan.canvasHeight).toBe(520);
    expect(plan.generateMipmaps).toBe(false);
    expect(plan.minFilter).toBe(TextureFilter.Linear);
  });

});
