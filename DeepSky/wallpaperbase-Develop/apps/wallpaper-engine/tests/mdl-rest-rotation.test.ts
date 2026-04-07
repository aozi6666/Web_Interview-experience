import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { MdlAnimation, MdlBoneData } from 'formats/we/mdl/MdlLoader';
import { cleanAnimationData } from 'formats/we/mdl/MdlAnimationParser';
import { parseMdl } from 'formats/we/mdl/MdlLoader';

function makeBoneWithRotation(rotationRad: number): MdlBoneData {
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  const localMatrix = new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    10, 20, 0, 1,
  ]);
  return {
    name: 'ear_r',
    parentIndex: -1,
    local: { x: 10, y: 20 },
    localMatrix,
  };
}

function makeAnimationWithRestRotation(restRotation: number): MdlAnimation {
  return {
    id: 1,
    name: 'ear',
    fps: 30,
    numFrames: 1,
    numBones: 1,
    frames: [[{
      pos: { x: 10, y: 20 },
      rotation: restRotation,
      scale: { x: 1, y: 1 },
      active: true,
    }]],
    restPose: [{
      pos: { x: 10, y: 20 },
      rotation: restRotation,
      scale: { x: 1, y: 1 },
      active: true,
    }],
    extra: '',
  };
}

describe('cleanAnimationData rest rotation fallback', () => {
  it('uses localMatrix rotation when rest.rotation is sentinel-like 1.0', () => {
    const expectedRotation = 0.6;
    const bones: MdlBoneData[] = [makeBoneWithRotation(expectedRotation)];
    const animations: MdlAnimation[] = [makeAnimationWithRestRotation(1.0)];

    cleanAnimationData(animations, bones);

    expect(animations[0].restPose[0].rotation).toBeCloseTo(expectedRotation, 5);
  });

  it('keeps cat puppet ear-like bones aligned with localMatrix rest rotation', () => {
    const mdlPath = path.resolve(
      process.cwd(),
      '../../resources/wallpapers/3444535389/extracted/models/cat_puppet.mdl',
    );
    const buf = fs.readFileSync(mdlPath);
    const parsed = parseMdl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(parsed).toBeTruthy();
    expect(parsed?.bones?.length ?? 0).toBeGreaterThan(0);
    expect(parsed?.animations?.length ?? 0).toBeGreaterThan(0);

    const firstAnim = parsed!.animations![0];
    const bones = parsed!.bones!;
    const sampleCount = Math.min(firstAnim.numBones, bones.length);
    let checked = 0;
    for (let bi = 0; bi < sampleCount; bi++) {
      const bone = bones[bi];
      const rest = firstAnim.restPose[bi];
      if (!bone || !rest) continue;
      const mat = bone.localMatrix;
      if (!mat || mat.length < 2) continue;
      const matrixRot = Math.atan2(mat[1], mat[0]);
      if (!Number.isFinite(matrixRot)) continue;
      if (Math.abs(matrixRot) < 0.01) continue;
      expect(rest.rotation).toBeCloseTo(matrixRot, 3);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
