import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderLoop } from 'moyu-engine/scenario/core/RenderLoop';

describe('RenderLoop fixed tick throttling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('30fps 限速在抖动 rAF 下仍使用固定 33.33ms tick', () => {
    let nowMs = 0;
    let queuedCallback: FrameRequestCallback | null = null;

    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      queuedCallback = cb;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const deltas: number[] = [];
    const loop = new RenderLoop(30);
    loop.start((dt) => deltas.push(dt));

    const advance = (targetMs: number): void => {
      nowMs = targetMs;
      const cb = queuedCallback;
      expect(cb).not.toBeNull();
      cb?.(targetMs);
    };

    // 16/40/74/107ms 代表不均匀 rAF 到达。
    advance(16);
    advance(40);
    advance(74);
    advance(107);

    expect(deltas.length).toBe(3);
    for (const dt of deltas) {
      expect(dt).toBeCloseTo(1 / 30, 6);
    }

    loop.stop();
  });
});
