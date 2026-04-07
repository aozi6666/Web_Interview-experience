import { RenderObjectHint, type RenderObject } from '../../../rendering/interfaces/IRenderBackend';
import { VertexAttributeType } from '../../../rendering/interfaces/IMesh';
import type { Particle, RopeCrossSection, TrailSample } from '../config/ParticleTypes';
import type { IMesh } from '../../../rendering/interfaces/IMesh';
import type { IMaterial } from '../../../rendering/interfaces/IMaterial';
import type { IRenderBackend } from '../../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../../rendering/interfaces/ITexture';
import type { RopeBufferSet } from './ParticleResourceFactory';
import type { ResolvedParticleConfigState } from '../config/ParticleConfigResolver';
import type { ParticleDynamicState } from '../config/ParticleDynamicState';

const SHARED_IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

function cubicBSpline(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number,
  out: [number, number],
): void {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const b0 = (mt * mt * mt) / 6;
  const b1 = (3 * t3 - 6 * t2 + 4) / 6;
  const b2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6;
  const b3 = t3 / 6;
  out[0] = b0 * p0x + b1 * p1x + b2 * p2x + b3 * p3x;
  out[1] = b0 * p0y + b1 * p1y + b2 * p2y + b3 * p3y;
}

interface TrailRange {
  start: number;
  end: number;
}

export interface RopeRenderContext {
  id: string;
  particles: Particle[];
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: Pick<ParticleDynamicState, 'transform' | 'width' | 'height' | 'emitCenter' | 'time' | 'attachmentRotation'>;
  backend: IRenderBackend | null;
  material: IMaterial | null;
  opacity: number;
  getTrailSamples: (p: Particle) => TrailSample[];
  texture: ITexture | null;
  zIndex: number;
}

export interface RopeRenderState {
  ropeMesh: IMesh | null;
  ropeVertices: Float32Array | null;
  ropeUVs: Float32Array | null;
  ropeColors: Float32Array | null;
  ropeMaxCrossSections: number;
  ropeSortedParticles: Particle[];
  crossSections: RopeCrossSection[];
  segmentLengthBuffer: Float32Array;
  csLifeProgress: number[];
  trailRanges: TrailRange[];
  prevTailEnd: { x: number; y: number };
  hasPrevTailEnd: boolean;
  tmpScreenXY: [number, number];
  tmpSplineXY: [number, number];
}

export function createRopeRenderState(
  ropeMesh: IMesh | null,
  ropeBuffers: RopeBufferSet | null,
  ropeMaxCrossSections: number,
): RopeRenderState {
  return {
    ropeMesh,
    ropeVertices: ropeBuffers?.vertices ?? null,
    ropeUVs: ropeBuffers?.uvs ?? null,
    ropeColors: ropeBuffers?.colors ?? null,
    ropeMaxCrossSections,
    ropeSortedParticles: [],
    crossSections: [],
    segmentLengthBuffer: new Float32Array(0),
    csLifeProgress: [],
    trailRanges: [],
    prevTailEnd: { x: 0, y: 0 },
    hasPrevTailEnd: false,
    tmpScreenXY: [0, 0],
    tmpSplineXY: [0, 0],
  };
}

export function buildRopeRenderObjects(ctx: RopeRenderContext, state: RopeRenderState): RenderObject[] {
  const { config, dynamic } = ctx;
  if (!state.ropeMesh || !state.ropeVertices || !state.ropeUVs || !ctx.backend || !ctx.material) {
    return [];
  }
  const count = ctx.particles.length;
  if (count === 0) return [];

  const sorted = state.ropeSortedParticles;
  sorted.length = count;
  for (let i = 0; i < count; i++) sorted[i] = ctx.particles[i];
  sorted.sort((a, b) => a.spawnIndex - b.spawnIndex);

  const baseOffset = {
    x: dynamic.transform.x - dynamic.width / 2,
    y: dynamic.transform.y - dynamic.height / 2,
  };
  const layerOpacity = ctx.opacity;
  const sub = Math.max(config.subdivision, 3);
  const verts = state.ropeVertices;
  const uvs = state.ropeUVs;
  const hasPT = config.hasPosTransform;
  const isRopeRenderer = config.isRopeRenderer;
  const isRopeTrailRenderer = config.isRopeTrailRenderer;
  const hasUvScrolling = config.hasUvScrolling;
  const ptA = config.posTransformScale.x * config.posTransformCos;
  const ptB = config.posTransformScale.x * config.posTransformSin;
  const ptC = -config.posTransformScale.y * config.posTransformSin;
  const ptD = config.posTransformScale.y * config.posTransformCos;
  const hasAttRot = dynamic.attachmentRotation !== 0;
  const attCos = hasAttRot ? Math.cos(dynamic.attachmentRotation) : 1;
  const attSin = hasAttRot ? Math.sin(dynamic.attachmentRotation) : 0;
  const emitCenter = { x: dynamic.emitCenter.x, y: dynamic.emitCenter.y };
  const crossSections = state.crossSections;
  const csLifeProgress = state.csLifeProgress;
  const trailRanges = state.trailRanges;
  crossSections.length = 0;
  csLifeProgress.length = 0;
  trailRanges.length = 0;
  state.hasPrevTailEnd = false;

  const pushCrossSection = (
    x: number,
    y: number,
    size: number,
    alpha: number,
    r: number,
    g: number,
    b: number,
  ): void => {
    const idx = crossSections.length;
    let cs = crossSections[idx];
    if (!cs) {
      cs = { x: 0, y: 0, size: 0, alpha: 0, color: { r: 1, g: 1, b: 1 } };
      crossSections[idx] = cs;
    }
    cs.x = x;
    cs.y = y;
    cs.size = size;
    cs.alpha = alpha;
    cs.color.r = r;
    cs.color.g = g;
    cs.color.b = b;
    crossSections.length = idx + 1;
  };

  const pushTrailRange = (start: number, end: number): void => {
    const idx = trailRanges.length;
    let range = trailRanges[idx];
    if (!range) {
      range = { start: 0, end: 0 };
      trailRanges[idx] = range;
    }
    range.start = start;
    range.end = end;
    trailRanges.length = idx + 1;
  };

  const toScreenXY = (rawX: number, rawY: number, out: [number, number]): void => {
    const deltaX = rawX - emitCenter.x;
    const deltaY = rawY - emitCenter.y;
    let transformedX: number;
    let transformedY: number;
    if (hasPT) {
      transformedX = ptA * deltaX + ptC * deltaY;
      transformedY = ptB * deltaX + ptD * deltaY;
    } else {
      transformedX = deltaX;
      transformedY = deltaY;
    }
    if (hasAttRot) {
      const rotX = transformedX * attCos - transformedY * attSin;
      const rotY = transformedX * attSin + transformedY * attCos;
      out[0] = baseOffset.x + emitCenter.x + rotX;
      out[1] = baseOffset.y + emitCenter.y + rotY;
      return;
    }
    out[0] = baseOffset.x + emitCenter.x + transformedX;
    out[1] = baseOffset.y + emitCenter.y + transformedY;
  };

  if (config.mapSequenceBetweenCP || (isRopeRenderer && !isRopeTrailRenderer)) {
    if (sorted.length < 2) return [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      const p0 = sorted[Math.max(0, i - 1)];
      const p3 = sorted[Math.min(sorted.length - 1, i + 2)];
      const lp1 = 1 - p1.life / Math.max(p1.maxLife, 1e-6);
      const lp2 = 1 - p2.life / Math.max(p2.maxLife, 1e-6);
      toScreenXY(p0.x, p0.y, state.tmpScreenXY);
      const x0 = state.tmpScreenXY[0];
      const y0 = state.tmpScreenXY[1];
      toScreenXY(p1.x, p1.y, state.tmpSplineXY);
      const x1 = state.tmpSplineXY[0];
      const y1 = state.tmpSplineXY[1];
      toScreenXY(p2.x, p2.y, state.tmpScreenXY);
      const x2 = state.tmpScreenXY[0];
      const y2 = state.tmpScreenXY[1];
      toScreenXY(p3.x, p3.y, state.tmpSplineXY);
      const x3 = state.tmpSplineXY[0];
      const y3 = state.tmpSplineXY[1];
      for (let s = 0; s < sub; s++) {
        const t = s / sub;
        cubicBSpline(x0, y0, x1, y1, x2, y2, x3, y3, t, state.tmpScreenXY);
        const cx = state.tmpScreenXY[0];
        const cy = state.tmpScreenXY[1];
        const sz = p1.size + (p2.size - p1.size) * t;
        const al = (p1.alpha + (p2.alpha - p1.alpha) * t) * layerOpacity;
        const cr = p1.color.r + (p2.color.r - p1.color.r) * t;
        const cg = p1.color.g + (p2.color.g - p1.color.g) * t;
        const cb = p1.color.b + (p2.color.b - p1.color.b) * t;
        pushCrossSection(cx, cy, sz, al, cr, cg, cb);
        csLifeProgress.push(lp1 + (lp2 - lp1) * t);
      }
    }
    const last = sorted[sorted.length - 1];
    toScreenXY(last.x, last.y, state.tmpScreenXY);
    const lastSx = state.tmpScreenXY[0];
    const lastSy = state.tmpScreenXY[1];
    pushCrossSection(lastSx, lastSy, last.size, last.alpha * layerOpacity, last.color.r, last.color.g, last.color.b);
    csLifeProgress.push(1 - last.life / Math.max(last.maxLife, 1e-6));
  } else {
    let hasAnyTrail = false;
    const prevTailEnd = state.prevTailEnd;
    for (const particle of sorted) {
      const trail = ctx.getTrailSamples(particle);
      if (trail.length === 0) continue;
      hasAnyTrail = true;
      let trailStart = crossSections.length;
      if (trail.length === 1) {
        toScreenXY(trail[0].x, trail[0].y, state.tmpScreenXY);
        const t0sx = state.tmpScreenXY[0];
        const t0sy = state.tmpScreenXY[1];
        if (state.hasPrevTailEnd) {
          pushCrossSection(prevTailEnd.x, prevTailEnd.y, 0, 0, particle.color.r, particle.color.g, particle.color.b);
          pushCrossSection(t0sx, t0sy, 0, 0, particle.color.r, particle.color.g, particle.color.b);
        }
        trailStart = crossSections.length;
        pushCrossSection(t0sx, t0sy, trail[0].size, trail[0].alpha * layerOpacity, particle.color.r, particle.color.g, particle.color.b);
        const trailEnd = crossSections.length;
        if (trailEnd - trailStart >= 2) {
          pushTrailRange(trailStart, trailEnd);
        }
        prevTailEnd.x = t0sx;
        prevTailEnd.y = t0sy;
        state.hasPrevTailEnd = true;
        continue;
      }
      if (state.hasPrevTailEnd) {
        toScreenXY(trail[0].x, trail[0].y, state.tmpScreenXY);
        const headSx = state.tmpScreenXY[0];
        const headSy = state.tmpScreenXY[1];
        pushCrossSection(prevTailEnd.x, prevTailEnd.y, 0, 0, particle.color.r, particle.color.g, particle.color.b);
        pushCrossSection(headSx, headSy, 0, 0, particle.color.r, particle.color.g, particle.color.b);
      }
      trailStart = crossSections.length;
      for (let i = 0; i < trail.length - 1; i++) {
        const p1 = trail[i];
        const p2 = trail[i + 1];
        const p0 = trail[Math.max(0, i - 1)];
        const p3 = trail[Math.min(trail.length - 1, i + 2)];
        toScreenXY(p0.x, p0.y, state.tmpScreenXY);
        const x0 = state.tmpScreenXY[0];
        const y0 = state.tmpScreenXY[1];
        toScreenXY(p1.x, p1.y, state.tmpSplineXY);
        const x1 = state.tmpSplineXY[0];
        const y1 = state.tmpSplineXY[1];
        toScreenXY(p2.x, p2.y, state.tmpScreenXY);
        const x2 = state.tmpScreenXY[0];
        const y2 = state.tmpScreenXY[1];
        toScreenXY(p3.x, p3.y, state.tmpSplineXY);
        const x3 = state.tmpSplineXY[0];
        const y3 = state.tmpSplineXY[1];
        for (let s = 0; s < sub; s++) {
          const t = s / sub;
          cubicBSpline(x0, y0, x1, y1, x2, y2, x3, y3, t, state.tmpScreenXY);
          const cx = state.tmpScreenXY[0];
          const cy = state.tmpScreenXY[1];
          const sz = p1.size + (p2.size - p1.size) * t;
          const al = (p1.alpha + (p2.alpha - p1.alpha) * t) * layerOpacity;
          pushCrossSection(cx, cy, sz, al, particle.color.r, particle.color.g, particle.color.b);
        }
      }
      const tailLast = trail[trail.length - 1];
      toScreenXY(tailLast.x, tailLast.y, state.tmpScreenXY);
      const tlSx = state.tmpScreenXY[0];
      const tlSy = state.tmpScreenXY[1];
      pushCrossSection(tlSx, tlSy, tailLast.size, tailLast.alpha * layerOpacity, particle.color.r, particle.color.g, particle.color.b);
      const trailEnd = crossSections.length;
      if (trailEnd - trailStart >= 2) {
        pushTrailRange(trailStart, trailEnd);
      }
      prevTailEnd.x = tlSx;
      prevTailEnd.y = tlSy;
      state.hasPrevTailEnd = true;
    }
    if (!hasAnyTrail) return [];
  }

  const numCS = Math.min(crossSections.length, state.ropeMaxCrossSections);
  if (numCS < 2) return [];

  let totalLen = 0;
  let segLens = state.segmentLengthBuffer;
  if (segLens.length < numCS) {
    segLens = new Float32Array(numCS);
  }
  if (isRopeTrailRenderer) {
    segLens.fill(0, 0, numCS);
    for (const range of trailRanges) {
      const start = Math.max(0, Math.min(range.start, numCS - 1));
      const end = Math.max(start, Math.min(range.end, numCS));
      if (end - start < 2) continue;
      let localTotalLen = 0;
      segLens[start] = 0;
      for (let i = start + 1; i < end; i++) {
        const dx = crossSections[i].x - crossSections[i - 1].x;
        const dy = crossSections[i].y - crossSections[i - 1].y;
        localTotalLen += Math.sqrt(dx * dx + dy * dy);
        segLens[i] = localTotalLen;
      }
      if (localTotalLen > 0) {
        const scale = config.sequenceMultiplier / localTotalLen;
        for (let i = start; i < end; i++) {
          segLens[i] *= scale;
        }
      }
    }
  } else {
    segLens[0] = 0;
    for (let i = 1; i < numCS; i++) {
      const dx = crossSections[i].x - crossSections[i - 1].x;
      const dy = crossSections[i].y - crossSections[i - 1].y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
      segLens[i] = totalLen;
    }
  }

  let mapSequenceWidthScale = 1.0;
  if (config.mapSequenceBetweenCP && ctx.texture) {
    const texW = Math.max(1, ctx.texture.width);
    const texH = Math.max(1, ctx.texture.height);
    mapSequenceWidthScale = Math.min(texW, texH) / Math.max(texW, texH);
  }

  for (let i = 0; i < numCS; i++) {
    const cs = crossSections[i];
    const halfW = cs.size * 0.5 * mapSequenceWidthScale;
    let tx: number;
    let ty: number;
    const k = Math.min(3, i, numCS - 1 - i);
    if (k > 0) {
      tx = crossSections[i + k].x - crossSections[i - k].x;
      ty = crossSections[i + k].y - crossSections[i - k].y;
    } else {
      tx = 1;
      ty = 0;
    }
    const len = Math.sqrt(tx * tx + ty * ty);
    if (len > 0.001) {
      tx /= len;
      ty /= len;
    } else {
      tx = 1;
      ty = 0;
    }
    const nx = -ty;
    const ny = tx;
    const vi = i * 6;
    verts[vi] = cs.x + nx * halfW;
    verts[vi + 1] = cs.y + ny * halfW;
    verts[vi + 2] = 0;
    verts[vi + 3] = cs.x - nx * halfW;
    verts[vi + 4] = cs.y - ny * halfW;
    verts[vi + 5] = 0;
    const scrollOffset = hasUvScrolling ? -dynamic.time * 1.0 : 0;
    const uBase = isRopeTrailRenderer
      ? segLens[i]
      : totalLen > 0 ? (segLens[i] / totalLen) : 0;
    const u = uBase + scrollOffset;
    const ui = i * 4;
    uvs[ui] = 0;
    uvs[ui + 1] = u;
    uvs[ui + 2] = 1;
    uvs[ui + 3] = u;
    if (state.ropeColors) {
      const ciL = (i * 2) * 4;
      const ciR = ciL + 4;
      state.ropeColors[ciL] = cs.color.r;
      state.ropeColors[ciL + 1] = cs.color.g;
      state.ropeColors[ciL + 2] = cs.color.b;
      state.ropeColors[ciL + 3] = cs.alpha;
      state.ropeColors[ciR] = cs.color.r;
      state.ropeColors[ciR + 1] = cs.color.g;
      state.ropeColors[ciR + 2] = cs.color.b;
      state.ropeColors[ciR + 3] = cs.alpha;
    }
  }

  const lastVi = (numCS - 1) * 6;
  const lastLx = verts[lastVi];
  const lastLy = verts[lastVi + 1];
  const lastRx = verts[lastVi + 3];
  const lastRy = verts[lastVi + 4];
  for (let i = numCS; i < state.ropeMaxCrossSections; i++) {
    const vi = i * 6;
    verts[vi] = lastLx;
    verts[vi + 1] = lastLy;
    verts[vi + 2] = 0;
    verts[vi + 3] = lastRx;
    verts[vi + 4] = lastRy;
    verts[vi + 5] = 0;
    if (state.ropeColors) {
      const ciL = (i * 2) * 4;
      const ciR = ciL + 4;
      state.ropeColors[ciL] = 1;
      state.ropeColors[ciL + 1] = 1;
      state.ropeColors[ciL + 2] = 1;
      state.ropeColors[ciL + 3] = 0;
      state.ropeColors[ciR] = 1;
      state.ropeColors[ciR + 1] = 1;
      state.ropeColors[ciR + 2] = 1;
      state.ropeColors[ciR + 3] = 0;
    }
  }

  state.segmentLengthBuffer = segLens;
  ctx.backend.updateMeshVertices(state.ropeMesh, verts);
  if (state.ropeMesh.updateUVs) {
    state.ropeMesh.updateUVs(uvs);
  }
  if (state.ropeColors) {
    state.ropeMesh.updateAttribute(VertexAttributeType.Color, state.ropeColors);
  }

  return [{
      id: `${ctx.id}-rope`,
      mesh: state.ropeMesh,
      material: ctx.material,
      transform: SHARED_IDENTITY_MATRIX,
      zIndex: ctx.zIndex,
      visible: true,
      opacity: 1,
      hint: RenderObjectHint.Instanced,
    }];
}

export class RopeRenderer {
  private readonly state: RopeRenderState;

  constructor(
    ropeMesh: IMesh | null,
    ropeBuffers: RopeBufferSet | null,
    ropeMaxCrossSections: number,
  ) {
    this.state = createRopeRenderState(ropeMesh, ropeBuffers, ropeMaxCrossSections);
  }

  getRenderObjects(ctx: RopeRenderContext): RenderObject[] {
    return buildRopeRenderObjects(ctx, this.state);
  }
}
