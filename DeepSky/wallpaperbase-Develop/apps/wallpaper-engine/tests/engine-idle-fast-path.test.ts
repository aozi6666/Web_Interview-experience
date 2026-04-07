import { describe, expect, it, vi } from 'vitest';

import { Engine } from 'moyu-engine/scenario/Engine';

function createCanvasStub(): HTMLCanvasElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLCanvasElement;
}

describe('engine idle fast path', () => {
  it('skips subsystem updates and backend render/capture when no layers are loaded', () => {
    const backend = {
      init: vi.fn(),
      render: vi.fn(),
      captureScene: vi.fn(() => null),
      createPlaneGeometry: vi.fn(() => ({})),
      createTextureFromRGBA: vi.fn(() => ({})),
      createSpriteMaterial: vi.fn(() => ({})),
    } as any;

    const engine = new Engine({
      canvas: createCanvasStub(),
      width: 1280,
      height: 720,
      backend,
    });

    const audioUpdate = vi.fn();
    const mediaUpdate = vi.fn();
    const lightUpdate = vi.fn();
    const cameraUpdate = vi.fn();

    (engine as any)._audioAnalyzer.update = audioUpdate;
    (engine as any)._mediaIntegrationProvider.update = mediaUpdate;
    (engine as any)._lightManager.update = lightUpdate;
    (engine as any)._cameraSystem.update = cameraUpdate;

    expect(engine.idle).toBe(true);

    engine.update(1 / 30);
    engine.render();

    expect(audioUpdate).not.toHaveBeenCalled();
    expect(mediaUpdate).not.toHaveBeenCalled();
    expect(lightUpdate).not.toHaveBeenCalled();
    expect(cameraUpdate).not.toHaveBeenCalled();
    expect(backend.render).not.toHaveBeenCalled();
    expect(backend.captureScene).not.toHaveBeenCalled();
  });
});
