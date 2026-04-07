import { describe, expect, it } from 'vitest';

import { SceneBuilder } from 'moyu-engine/scenario/scene-model/SceneBuilder';

describe('SceneBuilder script scene state', () => {
  it('restores scene.scriptSceneState to engine', async () => {
    const engine = {
      _sceneScriptState: { existing: 1 },
      width: 1920,
      height: 1080,
      layers: [],
      clearLayers: () => {},
      resize: () => {},
      setBackgroundColor: () => {},
      setBloom: () => {},
      setCameraIntro: () => {},
      setLighting: () => {},
      setParallax: () => {},
      setShake: () => {},
      setLayerDependencies: () => {},
      addLayer: async () => {},
    };

    await SceneBuilder.build(engine as any, {
      meta: { title: 't', type: 'scene' },
      scene: {
        width: 1920,
        height: 1080,
        scriptSceneState: {
          clearenabled: false,
          camerafade: true,
          fov: 66,
          nearz: 0.2,
          farz: 3000,
          perspectiveoverridefov: 72,
        },
      },
      layers: [],
    });

    expect((engine as any)._sceneScriptState).toMatchObject({
      existing: 1,
      clearenabled: false,
      camerafade: true,
      fov: 66,
      nearz: 0.2,
      farz: 3000,
      perspectiveoverridefov: 72,
    });
  });
});
