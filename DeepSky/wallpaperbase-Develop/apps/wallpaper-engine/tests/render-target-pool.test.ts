import { describe, expect, it, vi } from 'vitest';

import { RenderTargetPool } from 'moyu-engine/components/effects/RenderTargetPool';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { IRenderBackend, IRenderTarget } from 'moyu-engine/rendering/interfaces/IRenderBackend';

function createFakeTexture(id: string, width = 64, height = 64): ITexture {
  return {
    id,
    width,
    height,
    isVideoTexture: false,
    update: () => {},
    updateSubRegion: () => {},
    setFilter: () => {},
    setWrap: () => {},
    dispose: () => {},
    getNativeTexture: () => null,
  };
}

describe('RenderTargetPool', () => {
  it('release 后同尺寸 RT 会被复用', () => {
    let id = 0;
    const backend: Pick<IRenderBackend, 'createRenderTarget'> = {
      createRenderTarget: (width, height) => ({
        texture: createFakeTexture(`rt-${id++}`, width, height),
        width,
        height,
        dispose: vi.fn(),
      } as unknown as IRenderTarget),
    };
    const pool = new RenderTargetPool(backend as unknown as IRenderBackend);
    const a = pool.acquire(256, 256);
    pool.release(a);
    const b = pool.acquire(256, 256);
    expect(b.texture.id).toBe(a.texture.id);
  });

  it('gc 会清理空闲过久的 RT', () => {
    let id = 0;
    const disposeSpy = vi.fn();
    const backend: Pick<IRenderBackend, 'createRenderTarget'> = {
      createRenderTarget: (width, height) => ({
        texture: createFakeTexture(`rt-${id++}`, width, height),
        width,
        height,
        dispose: disposeSpy,
      } as unknown as IRenderTarget),
    };
    const pool = new RenderTargetPool(backend as unknown as IRenderBackend);
    const a = pool.acquire(128, 128);
    pool.release(a);
    for (let i = 0; i < 10; i++) {
      pool.advanceFrame();
    }
    pool.gc(5);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
