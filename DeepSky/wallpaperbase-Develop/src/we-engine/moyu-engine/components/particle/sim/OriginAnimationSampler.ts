import type {
  ParticleOriginAnimationConfig,
  ParticleOriginAnimationKeyframe,
} from '../config/ParticleTypes';
import type { Vec2Like } from '../../../math';

function sampleOriginSegment(
  k0: ParticleOriginAnimationKeyframe,
  k1: ParticleOriginAnimationKeyframe,
  frame: number,
): number {
  const dt = k1.frame - k0.frame;
  if (dt <= 1e-6) return k0.value;
  const t = (frame - k0.frame) / dt;
  // WE 关键帧 front/back 是贝塞尔控制点偏移，转换到 Hermite 切线时使用 3 * dy。
  // back 手柄指向前一帧，因此终点切线方向需要取反。
  const m0 = 3 * k0.front.y;
  const m1 = -3 * k1.back.y;

  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * k0.value + h10 * m0 + h01 * k1.value + h11 * m1;
}

export function sampleOriginTrack(
  track: ParticleOriginAnimationKeyframe[],
  frame: number,
  lengthFrames: number,
  mode: 'loop' | 'mirror' | 'single',
): number {
  if (track.length === 0) return 0;
  if (track.length === 1) return track[0].value;
  if (lengthFrames <= 1e-6) return track[0].value;

  if (mode === 'loop') {
    const wrapped = ((frame % lengthFrames) + lengthFrames) % lengthFrames;
    for (let i = 0; i < track.length - 1; i++) {
      const k0 = track[i];
      const k1 = track[i + 1];
      if (wrapped >= k0.frame && wrapped <= k1.frame) {
        return sampleOriginSegment(k0, k1, wrapped);
      }
    }
    const last = track[track.length - 1];
    const first = track[0];
    const frameWrapped = wrapped < first.frame ? wrapped + lengthFrames : wrapped;
    const firstWrapped: ParticleOriginAnimationKeyframe = {
      ...first,
      frame: first.frame + lengthFrames,
    };
    return sampleOriginSegment(last, firstWrapped, frameWrapped);
  }

  if (mode === 'mirror') {
    const cycle = lengthFrames * 2;
    const wrapped = ((frame % cycle) + cycle) % cycle;
    const mirrored = wrapped <= lengthFrames ? wrapped : (cycle - wrapped);
    if (mirrored <= track[0].frame) return track[0].value;
    const last = track[track.length - 1];
    if (mirrored >= last.frame) return last.value;
    for (let i = 0; i < track.length - 1; i++) {
      const k0 = track[i];
      const k1 = track[i + 1];
      if (mirrored >= k0.frame && mirrored <= k1.frame) {
        return sampleOriginSegment(k0, k1, mirrored);
      }
    }
    return last.value;
  }

  if (frame <= track[0].frame) return track[0].value;
  const last = track[track.length - 1];
  if (frame >= last.frame) return last.value;
  for (let i = 0; i < track.length - 1; i++) {
    const k0 = track[i];
    const k1 = track[i + 1];
    if (frame >= k0.frame && frame <= k1.frame) {
      return sampleOriginSegment(k0, k1, frame);
    }
  }
  return last.value;
}

export function computeAnimatedOrigin(
  anim: ParticleOriginAnimationConfig,
  time: number,
): Vec2Like | null {
  if (anim.duration <= 1e-6 || anim.lengthFrames <= 1e-6) return null;
  const frame = (time / anim.duration) * anim.lengthFrames;
  return {
    x: sampleOriginTrack(anim.x, frame, anim.lengthFrames, anim.mode),
    y: sampleOriginTrack(anim.y, frame, anim.lengthFrames, anim.mode),
  };
}
