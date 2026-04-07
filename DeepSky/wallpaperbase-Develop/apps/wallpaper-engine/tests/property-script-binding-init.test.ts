import { describe, expect, it } from 'vitest';

import type { ILayerBindingTarget } from '../../../src/we-engine/moyu-engine/interfaces';
import { createScriptBindingsForLayer } from '../../../src/we-engine/moyu-engine/components/scripting/PropertyScriptBinding';

class MockLayer implements ILayerBindingTarget {
  name = 'mock-layer';
  scaleX = 1;
  scaleY = 1;
  scale = { x: 1, y: 1 };
  rotation = 0;
  opacity = 1;
  visible = true;
  _sourceScale: [number, number, number] = [1, 1, 1];
  _engine: unknown = null;
  _weParentId: string | undefined;
  _spritesheetPlayer: {
    stopped: boolean;
    frameCount: number;
    currentFrame: number;
    stop: () => void;
  } | null = null;
  _scriptProxy: Record<string, unknown> | null = null;

  dispatchScriptEvent(): void {}
  getScriptLayerProxy(): Record<string, unknown> {
    if (this._scriptProxy) return this._scriptProxy;
    this._scriptProxy = {
      getParent: () => {
        const engine = this._engine as { getLayer?: (id: string) => MockLayer | undefined } | null;
        if (!engine || !this._weParentId || typeof engine.getLayer !== 'function') return null;
        const parent = engine.getLayer(this._weParentId);
        return parent ? parent.getScriptLayerProxy() : null;
      },
      getTextureAnimation: () => {
        if (!this._spritesheetPlayer) return null;
        return {
          stop: this._spritesheetPlayer.stop,
          getFrame: () => this._spritesheetPlayer!.currentFrame,
          setFrame: (frame: number) => { this._spritesheetPlayer!.currentFrame = frame; },
          frameCount: this._spritesheetPlayer.frameCount,
        };
      },
      scale: { x: this.scaleX, y: this.scaleY, z: 1 },
    };
    return this._scriptProxy;
  }
  getAnimationByName(): null { return null; }
  getAnimationsByName(): [] { return []; }
  setPosition(): void {}
  setScriptBindings(): void {}
  setScale(scaleX: number, scaleY?: number): void {
    this.scaleX = scaleX;
    this.scaleY = scaleY ?? scaleX;
    this.scale = { x: this.scaleX, y: this.scaleY };
    this._sourceScale = [this.scaleX, this.scaleY, this._sourceScale[2]];
  }
}

describe('PropertyScriptBinding init input normalization', () => {
  it('passes Vec3-like value to scale init when config.value is string', () => {
    const layer = new MockLayer();
    layer._engine = { time: 0, scriptWorldWidth: 1920, scriptWorldHeight: 1080 };
    const bindings = createScriptBindingsForLayer(layer, [
      {
        target: 'scale',
        value: '2 3 1',
        script: `
          export function init(value) {
            return value.multiply(2);
          }
          export function update(value) {
            return value;
          }
        `,
      },
    ]);

    expect(bindings).toHaveLength(1);
    // init is deferred to first update
    expect(layer.scaleX).toBe(1);
    bindings[0].update(1 / 60);
    expect(layer.scaleX).toBe(4);
    expect(layer.scaleY).toBe(6);
  });

  it('supports angles script binding with degree/radian conversion', () => {
    const layer = new MockLayer();
    layer._engine = { time: 0, scriptWorldWidth: 1920, scriptWorldHeight: 1080 };
    layer.rotation = Math.PI / 2;
    const bindings = createScriptBindingsForLayer(layer as unknown as ILayerBindingTarget, [
      {
        target: 'angles',
        value: '0 0 90',
        script: `
          export function init(value) {
            value.z = value.z + 90;
            return value;
          }
          export function update(value) {
            return value;
          }
        `,
      },
    ]);

    expect(bindings).toHaveLength(1);
    // init is deferred to first update
    bindings[0].update(1 / 60);
    expect(layer.rotation).toBeCloseTo(Math.PI, 6);
  });

  it('defers init until layer has runtime context', () => {
    const layer = new MockLayer();
    layer.opacity = 1;

    const parent = new MockLayer();
    parent.scaleX = 2;
    parent.scaleY = 2;
    const bindings = createScriptBindingsForLayer(layer, [
      {
        target: 'alpha',
        script: `
          export function init(value) {
            const animation = thisLayer.getTextureAnimation();
            animation.stop();
            const parent = thisLayer.getParent();
            return value + parent.scale.x;
          }
          export function update(value) {
            return value;
          }
        `,
      },
    ]);

    expect(bindings).toHaveLength(1);
    // engine 未就绪时不应执行 init
    expect(layer.opacity).toBe(1);

    let stopped = false;
    layer._spritesheetPlayer = {
      stopped: false,
      frameCount: 10,
      currentFrame: 0,
      stop: () => {
        stopped = true;
      },
    };
    layer._weParentId = 'parent-layer';
    layer._engine = {
      getLayer: (id: string) => (id === 'parent-layer' ? parent : undefined),
      time: 0,
      scriptWorldWidth: 1920,
      scriptWorldHeight: 1080,
    };

    // 首帧 update 触发补执行 init
    bindings[0].update(1 / 60);
    expect(stopped).toBe(true);
    expect(layer.opacity).toBe(3);

    // 后续 update 不应重复执行 init
    stopped = false;
    bindings[0].update(1 / 60);
    expect(stopped).toBe(false);
    expect(layer.opacity).toBe(3);
  });
});
