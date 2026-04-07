import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { TimelineAnimation } from 'moyu-engine/components/animation/TimelineAnimation';
import { parseTimelineAnimation } from 'formats/we/LoaderUtils';

function readJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

describe('TimelineAnimation runtime', () => {
  it('samples loop timeline with linear interpolation', () => {
    const timeline = new TimelineAnimation({
      fps: 10,
      lengthFrames: 10,
      mode: 'loop',
      tracks: [[
        {
          frame: 0,
          value: 0,
          back: { enabled: false, x: -1, y: 0 },
          front: { enabled: false, x: 1, y: 0 },
        },
        {
          frame: 10,
          value: 10,
          back: { enabled: false, x: -1, y: 0 },
          front: { enabled: false, x: 1, y: 0 },
        },
      ]],
    });

    expect(timeline.sampleAtTime(0.5)[0]).toBeCloseTo(5, 5);
    // loop: 1.5s -> frame 15 -> wrap to frame 5
    expect(timeline.sampleAtTime(1.5)[0]).toBeCloseTo(5, 5);
  });

  it('samples mirror timeline correctly', () => {
    const timeline = new TimelineAnimation({
      fps: 1,
      lengthFrames: 10,
      mode: 'mirror',
      tracks: [[
        {
          frame: 0,
          value: 0,
          back: { enabled: false, x: -1, y: 0 },
          front: { enabled: false, x: 1, y: 0 },
        },
        {
          frame: 10,
          value: 10,
          back: { enabled: false, x: -1, y: 0 },
          front: { enabled: false, x: 1, y: 0 },
        },
      ]],
    });

    expect(timeline.sampleAtTime(5)[0]).toBeCloseTo(5, 5);
    // mirror: 15s -> second half -> mirrored to frame 5
    expect(timeline.sampleAtTime(15)[0]).toBeCloseTo(5, 5);
  });
});

describe('parseTimelineAnimation with WE scene data', () => {
  it('parses mirror mode effect uniform animation from blendgradient preview', () => {
    const scenePath = path.resolve(process.cwd(), '../../resources/assets/effects/blendgradient/preview/scene.json');
    const scene = readJson(scenePath);
    const anim = scene.objects[1].effects[0].passes[0].constantshadervalues.multiply.animation;
    const parsed = parseTimelineAnimation(anim, [1]);
    expect(parsed).toBeTruthy();
    expect(parsed?.mode).toBe('mirror');
    expect(parsed?.tracks.length ?? 0).toBeGreaterThan(0);
  });

  it('parses relative origin animation from particleelement preview', () => {
    const scenePath = path.resolve(process.cwd(), '../../resources/assets/scenes/particleelementpreviews/maintaindistancebetweencontrolpoints/scene.json');
    const scene = readJson(scenePath);
    const originObj = scene.objects[0].origin;
    const parsed = parseTimelineAnimation(originObj.animation, [128.0, 238.94785, 0]);
    expect(parsed).toBeTruthy();
    expect(parsed?.mode).toBe('loop');
    const start = parsed?.animation.sampleAtTime(0) ?? [];
    expect(start[0]).toBeCloseTo(128, 3);
  });

  it('parses multi-channel timeline from instanceoverride controlpointangle1', () => {
    const scenePath = path.resolve(process.cwd(), '../../resources/assets/presets/magic/previewvortexorb/scene.json');
    const scene = readJson(scenePath);
    const anim = scene.objects[0].instanceoverride.controlpointangle1.animation;
    const parsed = parseTimelineAnimation(anim, [2.47837, -0.62832, 0.02213]);
    expect(parsed).toBeTruthy();
    expect(parsed?.tracks.length).toBeGreaterThanOrEqual(3);
  });
});
