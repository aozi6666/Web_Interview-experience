import { describe, expect, it } from 'vitest';

import { Layer } from 'moyu-engine/scenario/layers/Layer';

class DummyColorLayer extends Layer {
  readonly kind = 'dummy';
  appliedColor: [number, number, number] | null = null;

  toDescriptor(): unknown {
    return { kind: this.kind };
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  protected onUpdate(): void {}

  protected onDispose(): void {}

  protected applyTimelineColor(r: number, g: number, b: number): void {
    this.appliedColor = [r, g, b];
  }
}

describe('Layer timeline color hook', () => {
  it('invokes applyTimelineColor when color timeline updates', () => {
    const layer = new DummyColorLayer({
      id: 'dummy-color',
      width: 10,
      height: 10,
    } as any);

    const fakeAnimation = {
      name: 'color_anim',
      update: () => {},
      sample: () => [0.2, 0.4, 0.6],
    };

    layer.addTimelinePropertyBinding({
      target: 'color',
      animation: fakeAnimation as any,
    });

    layer.update(1 / 60);
    expect(layer.appliedColor).toEqual([0.2, 0.4, 0.6]);
  });
});
