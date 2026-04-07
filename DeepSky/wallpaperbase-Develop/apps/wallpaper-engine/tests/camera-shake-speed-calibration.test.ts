import { describe, expect, it } from 'vitest';

import { CameraSystem } from 'moyu-engine/components/camera/CameraSystem';

describe('camera shake speed calibration', () => {
  it('keeps camerashakespeed=1 aligned with WE tempo baseline', () => {
    const camera = new CameraSystem();
    camera.setShake(true, 0.5, 1.0, 1.0);

    camera.update(1 / 60, 1.0, 0.5, 0.5, null);

    const animTime = 1.0 * 1.0 * 0.2;
    const expectedLowX = Math.sin(animTime * 0.7) * 0.6 + Math.sin(animTime * 1.3) * 0.4;
    const expectedHighX = Math.sin(animTime * 4.7) * 1.0;
    const expectedX = (expectedLowX + expectedHighX) * 0.5;

    const expectedLowY = Math.cos(animTime * 0.5) * 0.6 + Math.cos(animTime * 1.1) * 0.4;
    const expectedHighY = Math.cos(animTime * 3.9) * 1.0;
    const expectedY = (expectedLowY + expectedHighY) * 0.5;

    expect(camera.shakeDisplacementX).toBeCloseTo(expectedX, 6);
    expect(camera.shakeDisplacementY).toBeCloseTo(expectedY, 6);
  });
});
