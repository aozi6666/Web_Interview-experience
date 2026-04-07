import { RenderObjectHint, type RenderObject } from '../../../rendering/interfaces/IRenderBackend';
import type { Particle } from '../config/ParticleTypes';
import { hasFeature, ParticleFeature } from '../config/ParticleTypes';
import type { ITexture } from '../../../rendering/interfaces/ITexture';
import type { IMesh } from '../../../rendering/interfaces/IMesh';
import type { IMaterial } from '../../../rendering/interfaces/IMaterial';
import type { IRenderBackend } from '../../../rendering/interfaces/IRenderBackend';
import type { ResolvedParticleConfigState } from '../config/ParticleConfigResolver';
import type { ParticleDynamicState } from '../config/ParticleDynamicState';

const SHARED_IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

export interface SpriteRenderContext {
  id: string;
  particles: Particle[];
  buffers: SpriteInstanceBuffers;
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: Pick<ParticleDynamicState, 'transform' | 'width' | 'height' | 'emitCenter' | 'attachmentRotation'>;
  opacity: number;
  mesh: IMesh;
  material: IMaterial;
  backend: IRenderBackend;
  zIndex: number;
  normalMapTexture: ITexture | null;
}

export interface SpriteInstanceBuffers {
  matrices: Float32Array;
  opacities: Float32Array;
  frames: Float32Array;
  colors: Float32Array;
}

export function buildSpriteRenderObjects(ctx: SpriteRenderContext): RenderObject[] {
  const { config, dynamic } = ctx;
  const particleCount = ctx.particles.length;
  const matrices = ctx.buffers.matrices;
  const opacities = ctx.buffers.opacities;
  const frames = ctx.buffers.frames;
  const baseOffset = {
    x: dynamic.transform.x - dynamic.width / 2,
    y: dynamic.transform.y - dynamic.height / 2,
  };
  const layerOpacity = ctx.opacity;
  const isSpriteTrail = config.isSpriteTrailRenderer;
  const hasSpritesheet = hasFeature(config.featureMask, ParticleFeature.Spritesheet);
  const hasColorChangeFeature = hasFeature(config.featureMask, ParticleFeature.ColorChange);
  const hasRefractionFeature = hasFeature(config.featureMask, ParticleFeature.Refraction);
  const hasPT = config.hasPosTransform;
  const hasPerspective = config.hasPerspective;
  const focalLen = config.perspectiveFocalLength;
  const ptA = config.posTransformScale.x * config.posTransformCos;
  const ptB = config.posTransformScale.x * config.posTransformSin;
  const ptC = -config.posTransformScale.y * config.posTransformSin;
  const ptD = config.posTransformScale.y * config.posTransformCos;
  const hasAttRot = dynamic.attachmentRotation !== 0;
  const attCos = hasAttRot ? Math.cos(dynamic.attachmentRotation) : 1;
  const attSin = hasAttRot ? Math.sin(dynamic.attachmentRotation) : 0;
  const maxPTScale = hasPT
    ? Math.max(Math.abs(config.posTransformScale.x), Math.abs(config.posTransformScale.y))
    : 1;
  const emitCenter = { x: dynamic.emitCenter.x, y: dynamic.emitCenter.y };
  const perspectiveOrigin = {
    x: baseOffset.x + emitCenter.x,
    y: baseOffset.y + emitCenter.y,
  };
  const viewBoundary = {
    min: { x: 0, y: 0 },
    max: { x: dynamic.width, y: dynamic.height },
  };
  let writeIndex = 0;

  for (let i = 0; i < particleCount; i++) {
    const p = ctx.particles[i];
    let s = p.size * 0.5;
    let ox: number;
    let oy: number;
    if (hasPT) {
      const deltaX = p.x - emitCenter.x;
      const deltaY = p.y - emitCenter.y;
      const ptDeltaX = ptA * deltaX + ptC * deltaY;
      const ptDeltaY = ptB * deltaX + ptD * deltaY;
      if (hasAttRot) {
        const rotDeltaX = ptDeltaX * attCos - ptDeltaY * attSin;
        const rotDeltaY = ptDeltaX * attSin + ptDeltaY * attCos;
        ox = baseOffset.x + emitCenter.x + rotDeltaX;
        oy = baseOffset.y + emitCenter.y + rotDeltaY;
      } else {
        ox = baseOffset.x + emitCenter.x + ptDeltaX;
        oy = baseOffset.y + emitCenter.y + ptDeltaY;
      }
    } else {
      const deltaX = p.x - emitCenter.x;
      const deltaY = p.y - emitCenter.y;
      if (hasAttRot) {
        const rotDeltaX = deltaX * attCos - deltaY * attSin;
        const rotDeltaY = deltaX * attSin + deltaY * attCos;
        ox = baseOffset.x + emitCenter.x + rotDeltaX;
        oy = baseOffset.y + emitCenter.y + rotDeltaY;
      } else {
        ox = baseOffset.x + p.x;
        oy = baseOffset.y + p.y;
      }
    }
    if (hasPerspective) {
      const denominator = focalLen - p.z;
      if (denominator <= 1e-3) continue;
      const perspScale = focalLen / denominator;
      if (!Number.isFinite(perspScale) || perspScale <= 0 || perspScale > 50) continue;
      ox = perspectiveOrigin.x + (ox - perspectiveOrigin.x) * perspScale;
      oy = perspectiveOrigin.y + (oy - perspectiveOrigin.y) * perspScale;
      s *= perspScale;
    }
    const combinedAlpha = Math.max(0, Math.min(1, layerOpacity * p.alpha));
    if (combinedAlpha < 0.01) continue;

    let visibilityRadius = s * maxPTScale;
    if (isSpriteTrail) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const rawTrail = Math.min(speed * config.trailLength, config.trailMaxLength);
      const trailLen = Math.max(config.trailMinLength, rawTrail) * s;
      visibilityRadius = Math.max(s, trailLen) * maxPTScale;
    }
    if (
      ox + visibilityRadius < viewBoundary.min.x
      || ox - visibilityRadius > viewBoundary.max.x
      || oy + visibilityRadius < viewBoundary.min.y
      || oy - visibilityRadius > viewBoundary.max.y
    ) {
      continue;
    }

    const offset = writeIndex * 16;

    if (isSpriteTrail) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const rawTrail = Math.min(speed * config.trailLength, config.trailMaxLength);
      const trailLen = Math.max(config.trailMinLength, rawTrail) * s;
      let col0x: number;
      let col0y: number;
      let col1x: number;
      let col1y: number;
      if (speed > 0.01) {
        const direction = { x: p.vx / speed, y: p.vy / speed };
        const perpendicular = { x: -direction.y, y: direction.x };
        col0x = perpendicular.x * s;
        col0y = perpendicular.y * s;
        col1x = direction.x * trailLen;
        col1y = direction.y * trailLen;
      } else {
        col0x = s;
        col0y = 0;
        col1x = 0;
        col1y = s;
      }
      if (hasPT) {
        matrices[offset] = ptA * col0x + ptC * col0y;
        matrices[offset + 1] = ptB * col0x + ptD * col0y;
        matrices[offset + 2] = 0;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = ptA * col1x + ptC * col1y;
        matrices[offset + 5] = ptB * col1x + ptD * col1y;
        matrices[offset + 6] = 0;
        matrices[offset + 7] = 0;
      } else {
        matrices[offset] = col0x;
        matrices[offset + 1] = col0y;
        matrices[offset + 2] = 0;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = col1x;
        matrices[offset + 5] = col1y;
        matrices[offset + 6] = 0;
        matrices[offset + 7] = 0;
      }
      if (hasAttRot) {
        const c0x = matrices[offset];
        const c0y = matrices[offset + 1];
        const c1x = matrices[offset + 4];
        const c1y = matrices[offset + 5];
        matrices[offset] = c0x * attCos - c0y * attSin;
        matrices[offset + 1] = c0x * attSin + c0y * attCos;
        matrices[offset + 4] = c1x * attCos - c1y * attSin;
        matrices[offset + 5] = c1x * attSin + c1y * attCos;
      }
    } else {
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      if (hasPT) {
        matrices[offset] = s * (ptA * cos + ptC * sin);
        matrices[offset + 1] = s * (ptB * cos + ptD * sin);
        matrices[offset + 2] = 0;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = s * (-ptA * sin + ptC * cos);
        matrices[offset + 5] = s * (-ptB * sin + ptD * cos);
        matrices[offset + 6] = 0;
        matrices[offset + 7] = 0;
      } else {
        matrices[offset] = cos * s;
        matrices[offset + 1] = sin * s;
        matrices[offset + 2] = 0;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = -sin * s;
        matrices[offset + 5] = cos * s;
        matrices[offset + 6] = 0;
        matrices[offset + 7] = 0;
      }
      if (hasAttRot) {
        const c0x = matrices[offset];
        const c0y = matrices[offset + 1];
        const c1x = matrices[offset + 4];
        const c1y = matrices[offset + 5];
        matrices[offset] = c0x * attCos - c0y * attSin;
        matrices[offset + 1] = c0x * attSin + c0y * attCos;
        matrices[offset + 4] = c1x * attCos - c1y * attSin;
        matrices[offset + 5] = c1x * attSin + c1y * attCos;
      }
    }

    matrices[offset + 8] = 0;
    matrices[offset + 9] = 0;
    matrices[offset + 10] = 1;
    matrices[offset + 11] = 0;
    matrices[offset + 12] = ox;
    matrices[offset + 13] = oy;
    matrices[offset + 14] = 0;
    matrices[offset + 15] = 1;
    opacities[writeIndex] = combinedAlpha;
    if (hasSpritesheet) {
      frames[writeIndex] = p.frame;
    }
    const ci = writeIndex * 3;
    ctx.buffers.colors[ci] = p.color.r;
    ctx.buffers.colors[ci + 1] = p.color.g;
    ctx.buffers.colors[ci + 2] = p.color.b;
    writeIndex += 1;
  }

  if (writeIndex <= 0) {
    return [];
  }

  const renderObj: RenderObject = {
    id: `${ctx.id}-instanced`,
    mesh: ctx.mesh,
    material: ctx.material,
    transform: SHARED_IDENTITY_MATRIX,
    zIndex: ctx.zIndex,
    visible: true,
    opacity: 1,
    instances: {
      count: writeIndex,
      matrices,
      opacities,
      frames: hasSpritesheet ? frames : undefined,
        spritesheetSize: hasSpritesheet ? [config.spritesheetCols, config.spritesheetRows] : undefined,
        colors: (config.colorMin || hasColorChangeFeature) ? ctx.buffers.colors : undefined,
    },
    hint: hasRefractionFeature
      ? RenderObjectHint.InstancedRefraction
      : RenderObjectHint.Instanced,
  };

  if (config.refract && ctx.normalMapTexture) {
    renderObj.refraction = {
      normalMap: ctx.normalMapTexture,
      strength: config.refractAmount,
      isFlowMap: config.colorTexIsFlowMap,
    };
  }
  return [renderObj];
}

export class SpriteRenderer {
  private readonly buffers: SpriteInstanceBuffers;

  constructor(maxParticles: number) {
    this.buffers = {
      matrices: new Float32Array(maxParticles * 16),
      opacities: new Float32Array(maxParticles),
      frames: new Float32Array(maxParticles),
      colors: new Float32Array(maxParticles * 3),
    };
  }

  getRenderObjects(ctx: Omit<SpriteRenderContext, 'buffers'>): RenderObject[] {
    return buildSpriteRenderObjects({
      ...ctx,
      buffers: this.buffers,
    });
  }
}
