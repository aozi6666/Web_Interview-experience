import { describe, expect, it, vi } from 'vitest';

import { Engine } from 'moyu-engine/scenario/Engine';

function createCanvasStub(): HTMLCanvasElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLCanvasElement;
}

function createBackendStub(): any {
  return {
    init: vi.fn(),
    render: vi.fn(),
    captureScene: vi.fn(() => null),
    createPlaneGeometry: vi.fn(() => ({})),
    createTextureFromRGBA: vi.fn(() => ({})),
    createSpriteMaterial: vi.fn(() => ({ setTexture: vi.fn() })),
  };
}

describe('engine cursor hit testing', () => {
  it('dispatches cursor enter/leave/click only to hovered layers', () => {
    const engine = new Engine({
      canvas: createCanvasStub(),
      width: 1000,
      height: 1000,
      backend: createBackendStub(),
    });

    const layerAEvents: string[] = [];
    const layerBEvents: string[] = [];
    const layerA = {
      id: 'layer-a',
      containsDisplayPoint: vi.fn((x: number) => x < 500),
      dispatchScriptEvent: vi.fn((eventName: string) => layerAEvents.push(eventName)),
    };
    const layerB = {
      id: 'layer-b',
      containsDisplayPoint: vi.fn((x: number) => x >= 500),
      dispatchScriptEvent: vi.fn((eventName: string) => layerBEvents.push(eventName)),
    };

    (engine as any)._sortedLayers = [layerA, layerB];

    (engine as any)._handleCursorEvent('cursorMove', { x: 0.2, y: 0.5 });
    expect(layerAEvents).toEqual(['cursorMove', 'cursorEnter']);
    expect(layerBEvents).toEqual(['cursorMove']);

    (engine as any)._handleCursorEvent('cursorMove', { x: 0.8, y: 0.5 });
    expect(layerAEvents).toEqual(['cursorMove', 'cursorEnter', 'cursorMove', 'cursorLeave']);
    expect(layerBEvents).toEqual(['cursorMove', 'cursorMove', 'cursorEnter']);

    (engine as any)._handleCursorEvent('cursorClick', { x: 0.8, y: 0.5 });
    expect(layerAEvents).toEqual(['cursorMove', 'cursorEnter', 'cursorMove', 'cursorLeave']);
    expect(layerBEvents).toEqual(['cursorMove', 'cursorMove', 'cursorEnter', 'cursorClick']);

    (engine as any)._handleCursorEvent('cursorLeave', { x: 0.8, y: 0.5 });
    expect(layerAEvents).toEqual(['cursorMove', 'cursorEnter', 'cursorMove', 'cursorLeave']);
    expect(layerBEvents).toEqual(['cursorMove', 'cursorMove', 'cursorEnter', 'cursorClick', 'cursorLeave']);
  });
});
