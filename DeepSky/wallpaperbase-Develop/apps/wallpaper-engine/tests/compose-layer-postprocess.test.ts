import { describe, expect, it } from 'vitest';

import { shouldUsePostProcessForComposeLikeLayer } from 'formats/we/scene/ImageObjectLayerBranches';
import { shouldForceFullResolutionSceneCapture } from 'moyu-engine/scenario/Engine';
import { resolveFullscreenCopybackgroundEffectQuality } from 'moyu-engine/scenario/layers/EffectableLayer';

describe('compose-like layer post-process decision', () => {
  it('keeps regular composelayer in main phase when no scene capture is needed', () => {
    expect(
      shouldUsePostProcessForComposeLikeLayer({
        isFullscreenLike: false,
        copybackground: false,
        effects: [
          {
            id: 1,
            name: 'simple-bars',
            file: 'effects/workshop/simple/effect.json',
            visible: true,
            passes: [
              {
                id: 2,
                textures: [null, 'masks/foo'],
              },
            ],
          },
        ] as any,
      }),
    ).toBe(false);
  });

  it('forces post-process for fullscreen-like layers', () => {
    expect(
      shouldUsePostProcessForComposeLikeLayer({
        isFullscreenLike: true,
        copybackground: false,
        effects: undefined,
      }),
    ).toBe(true);
  });

  it('forces post-process when copybackground is enabled', () => {
    expect(
      shouldUsePostProcessForComposeLikeLayer({
        isFullscreenLike: false,
        copybackground: true,
        effects: [],
      }),
    ).toBe(true);
  });

  it('forces post-process when pass textures reference _rt_FullFrameBuffer', () => {
    expect(
      shouldUsePostProcessForComposeLikeLayer({
        isFullscreenLike: false,
        copybackground: false,
        effects: [
          {
            id: 10,
            name: 'capture-read',
            file: 'effects/post/effect.json',
            visible: true,
            passes: [
              {
                id: 11,
                textures: [null, '_rt_FullFrameBuffer'],
              },
            ],
          },
        ] as any,
      }),
    ).toBe(true);
  });
});

describe('fullscreen copybackground effect quality decision', () => {
  it('forces quality 1.0 for fullscreen projectlayer-like post-process input', () => {
    expect(
      resolveFullscreenCopybackgroundEffectQuality({
        requestedQuality: 0.65,
        copybackground: true,
        isPostProcess: true,
        layerWidth: 1920,
        layerHeight: 1080,
        engineWidth: 1920,
        engineHeight: 1080,
      }),
    ).toBe(1);
  });

  it('forces quality 1.0 for fullscreenlayer-like post-process input', () => {
    expect(
      resolveFullscreenCopybackgroundEffectQuality({
        requestedQuality: 0.75,
        copybackground: true,
        isPostProcess: true,
        layerWidth: 2560,
        layerHeight: 1440,
        engineWidth: 2560,
        engineHeight: 1440,
      }),
    ).toBe(1);
  });

  it('keeps requested quality for non-fullscreen compose layer', () => {
    expect(
      resolveFullscreenCopybackgroundEffectQuality({
        requestedQuality: 0.75,
        copybackground: true,
        isPostProcess: true,
        layerWidth: 200,
        layerHeight: 200,
        engineWidth: 1920,
        engineHeight: 1080,
      }),
    ).toBe(0.75);
  });
});

describe('scene capture scale override decision', () => {
  it('forces full-resolution capture when any post layer requires it', () => {
    const postLayers = [
      { requiresFullResolutionSceneCapture: () => false },
      { requiresFullResolutionSceneCapture: () => true },
    ] as any;
    expect(shouldForceFullResolutionSceneCapture(postLayers, 1920, 1080)).toBe(true);
  });

  it('does not force full-resolution capture when no layer requires it', () => {
    const postLayers = [
      { requiresFullResolutionSceneCapture: () => false },
      { requiresFullResolutionSceneCapture: () => false },
    ] as any;
    expect(shouldForceFullResolutionSceneCapture(postLayers, 1920, 1080)).toBe(false);
  });
});
