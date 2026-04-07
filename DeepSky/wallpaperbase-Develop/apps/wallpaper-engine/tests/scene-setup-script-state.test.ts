import { describe, expect, it } from 'vitest';

import { applySceneSetup } from 'formats/we/scene/SceneSetup';

describe('SceneSetup script scene state', () => {
  it('writes general camera/clear fields into engine script scene state', () => {
    const engine = {
      _sceneScriptState: {},
      setParallax: () => {},
      setShake: () => {},
      setBackgroundColor: () => {},
      setBloom: () => {},
      setCameraIntro: () => {},
      setLighting: () => {},
    };

    applySceneSetup(
      engine as any,
      {
        general: {
          clearenabled: false,
          camerafade: true,
          fov: 75,
          nearz: 0.25,
          farz: 2500,
          perspectiveoverridefov: 90,
        },
        objects: [],
      } as any,
      null,
      () => null,
    );

    expect((engine as any)._sceneScriptState).toMatchObject({
      clearenabled: false,
      camerafade: true,
      fov: 75,
      nearz: 0.25,
      farz: 2500,
      perspectiveoverridefov: 90,
    });
  });

  it('resolves user-bound camera shake params from project properties', () => {
    const shakeCalls: Array<{ enabled: boolean; amp: number; roughness: number; speed: number }> = [];
    const engine = {
      _sceneScriptState: {},
      setParallax: () => {},
      setShake: (enabled: boolean, amp: number, roughness: number, speed: number) => {
        shakeCalls.push({ enabled, amp, roughness, speed });
      },
      setBackgroundColor: () => {},
      setBloom: () => {},
      setCameraIntro: () => {},
      setLighting: () => {},
    };

    applySceneSetup(
      engine as any,
      {
        general: {
          camerashake: { user: 'shake_on', value: true },
          camerashakeamplitude: { user: 'shake_amp', value: 0.35 },
          camerashakeroughness: { user: 'shake_roughness', value: 0 },
          camerashakespeed: { user: 'shake_speed', value: 1 },
        },
        objects: [],
      } as any,
      {
        general: {
          properties: {
            shake_on: { value: true },
            shake_amp: { value: '0.7' },
            shake_roughness: { value: 0.25 },
            shake_speed: { value: '2' },
          },
        },
      } as any,
      () => null,
    );

    expect(shakeCalls).toHaveLength(1);
    expect(shakeCalls[0]).toEqual({
      enabled: true,
      amp: 0.7,
      roughness: 0.25,
      speed: 2,
    });
  });
});
