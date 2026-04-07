import { BlendMode } from '../../../rendering/interfaces/IMaterial';
import type { IMaterial } from '../../../rendering/interfaces/IMaterial';
import type { IMesh } from '../../../rendering/interfaces/IMesh';
import type { IRenderBackend } from '../../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../../rendering/interfaces/ITexture';
import type { Color3 } from '../../../math';

export interface RopeBufferSet {
  vertices: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
}

export interface ParticleResourceConfig {
  name: string;
  maxParticles: number;
  rendererType: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail';
  subdivision: number;
  spritesheetCols: number;
  spritesheetRows: number;
  textureSource?: ITexture | string;
  color: Color3;
  overbright: number;
  blendMode: 'normal' | 'additive';
  refract: boolean;
  normalMapSource?: ITexture | string;
}

export interface ParticleResourceResult {
  mesh: IMesh;
  material: IMaterial;
  texture: ITexture;
  ropeMesh: IMesh | null;
  ropeBuffers: RopeBufferSet | null;
  ropeTrailMaxPoints: number;
  ropeMaxCrossSections: number;
  normalMapTexture: ITexture | null;
}

function createDefaultRopeTexture(backend: IRenderBackend): ITexture {
  const w = 256;
  const h = 32;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const edge = Math.sin(v * Math.PI);
    const a = Math.round(edge * 255);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = a;
    }
  }
  return backend.createTextureFromRGBA(data, w, h);
}

function createDefaultSpriteTexture(backend: IRenderBackend): ITexture {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ParticleResourceFactory: canvas context unavailable');
  }
  const center = size / 2;
  const radius = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return backend.createTexture({ source: canvas });
}

async function resolveTexture(
  backend: IRenderBackend,
  source?: ITexture | string,
): Promise<ITexture | null> {
  if (!source) return null;
  if (typeof source === 'string') {
    try {
      return await backend.createTextureFromURL(source);
    } catch {
      return null;
    }
  }
  return source;
}

async function resolveNormalMap(
  backend: IRenderBackend,
  refract: boolean,
  source?: ITexture | string,
): Promise<ITexture | null> {
  if (!refract || !source) return null;
  if (typeof source === 'string') {
    try {
      return await backend.createTextureFromURL(source);
    } catch (error) {
      console.warn('[ParticleResourceFactory] 折射法线贴图加载失败:', error);
      return null;
    }
  }
  return source;
}

function computeRopeLayout(
  maxParticles: number,
  subdivision: number,
): { ropeTrailMaxPoints: number; ropeMaxCrossSections: number } {
  const sub = Math.max(subdivision, 1);
  const maxSectionsByIndexLimit = 32767;
  const sepCount = Math.max(0, (maxParticles - 1) * 2);
  const perTrailSectionBudget = Math.max(
    3,
    Math.floor((maxSectionsByIndexLimit - sepCount) / Math.max(maxParticles, 1)),
  );
  const ropeTrailMaxPoints = Math.max(
    2,
    Math.min(32, Math.floor((perTrailSectionBudget - 1) / sub) + 1),
  );
  const perTrailSections = (ropeTrailMaxPoints - 1) * sub + 1;
  const ropeMaxCrossSections = maxParticles * perTrailSections + sepCount;
  return { ropeTrailMaxPoints, ropeMaxCrossSections };
}

function createRopeBuffers(ropeMaxCrossSections: number): RopeBufferSet {
  const maxVerts = ropeMaxCrossSections * 2;
  const maxTris = (ropeMaxCrossSections - 1) * 2;
  const vertices = new Float32Array(maxVerts * 3);
  const uvs = new Float32Array(maxVerts * 2);
  const colors = new Float32Array(maxVerts * 4);
  colors.fill(1);
  const indices = new Uint16Array(maxTris * 3);
  let triIdx = 0;
  for (let i = 0; i < ropeMaxCrossSections - 1; i++) {
    const tl = i * 2;
    const tr = i * 2 + 1;
    const bl = (i + 1) * 2;
    const br = (i + 1) * 2 + 1;
    indices[triIdx++] = tl;
    indices[triIdx++] = bl;
    indices[triIdx++] = tr;
    indices[triIdx++] = tr;
    indices[triIdx++] = bl;
    indices[triIdx++] = br;
  }
  return { vertices, uvs, colors, indices };
}

export async function createParticleResources(
  backend: IRenderBackend,
  config: ParticleResourceConfig,
): Promise<ParticleResourceResult> {
  const isRope = config.rendererType === 'rope' || config.rendererType === 'ropetrail';
  let texture = await resolveTexture(backend, config.textureSource);
  let mesh: IMesh;
  let ropeMesh: IMesh | null = null;
  let ropeBuffers: RopeBufferSet | null = null;
  let ropeTrailMaxPoints = 24;
  let ropeMaxCrossSections = 0;

  if (isRope) {
    if (!texture) {
      texture = createDefaultRopeTexture(backend);
    }
    const layout = computeRopeLayout(config.maxParticles, config.subdivision);
    ropeTrailMaxPoints = layout.ropeTrailMaxPoints;
    ropeMaxCrossSections = layout.ropeMaxCrossSections;
    ropeBuffers = createRopeBuffers(ropeMaxCrossSections);
    ropeMesh = backend.createDeformableMesh(
      ropeBuffers.vertices,
      ropeBuffers.uvs,
      ropeBuffers.indices,
      ropeBuffers.colors,
    );
    mesh = ropeMesh;
    console.log(
      `ParticleLayer[${config.name}]: ${config.rendererType} 模式, maxParticles=${config.maxParticles}, subdivision=${Math.max(config.subdivision, 1)}, trailPoints=${ropeTrailMaxPoints}, maxCrossSections=${ropeMaxCrossSections}`,
    );
  } else {
    if (!texture) {
      texture = createDefaultSpriteTexture(backend);
    }
    const cols = config.spritesheetCols > 0 ? config.spritesheetCols : 1;
    const rows = config.spritesheetRows > 0 ? config.spritesheetRows : 1;
    const frameAspect = texture.width > 0 && texture.height > 0
      ? (texture.width / cols) / (texture.height / rows)
      : 1;
    mesh = backend.createPlaneGeometry(frameAspect, 1);
  }

  const materialColor = {
    r: config.color.r * config.overbright,
    g: config.color.g * config.overbright,
    b: config.color.b * config.overbright,
  };
  const material = isRope
    ? backend.createRopeMaterial(texture, materialColor)
    : backend.createSpriteMaterial(texture, true, materialColor);
  if (config.blendMode === 'additive') {
    material.setBlendMode(BlendMode.Additive);
  }

  const normalMapTexture = await resolveNormalMap(backend, config.refract, config.normalMapSource);
  return {
    mesh,
    material,
    texture,
    ropeMesh,
    ropeBuffers,
    ropeTrailMaxPoints,
    ropeMaxCrossSections,
    normalMapTexture,
  };
}
