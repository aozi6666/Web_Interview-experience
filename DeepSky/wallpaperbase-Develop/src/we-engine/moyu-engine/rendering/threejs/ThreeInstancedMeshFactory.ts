import * as THREE from 'three';
import type { ITexture } from '../interfaces/ITexture';
import type { RenderObject } from '../interfaces/IRenderBackend';
import { ThreeMesh } from './ThreeMesh';
import { ThreeMaterial, createInstancedRefractionMaterial, createInstancedSpriteMaterial } from './ThreeMaterial';
import { BlendMode } from '../interfaces/IMaterial';

const SHARED_WHITE_TEXTURE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
SHARED_WHITE_TEXTURE.needsUpdate = true;

export interface InstancedMeshCacheEntry {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  opacityAttr: THREE.InstancedBufferAttribute;
  frameAttr: THREE.InstancedBufferAttribute;
  colorAttr: THREE.InstancedBufferAttribute;
  maxCount: number;
}

export interface RefractionMeshCacheEntry {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  opacityAttr: THREE.InstancedBufferAttribute;
  frameAttr: THREE.InstancedBufferAttribute;
  maxCount: number;
}

type WriteInstanceMatrices = (
  target: Float32Array,
  source: Float32Array,
  count: number,
  cameraTransform?: Float32Array,
) => void;

type UpdatableAttribute = THREE.BufferAttribute & {
  clearUpdateRanges?: () => void;
  addUpdateRange?: (start: number, count: number) => void;
};

function setUpdateRange(attr: UpdatableAttribute, itemSize: number, count: number): void {
  const elementCount = Math.max(0, count * itemSize);
  if (attr.clearUpdateRanges) {
    attr.clearUpdateRanges();
  }
  if (attr.addUpdateRange) {
    attr.addUpdateRange(0, elementCount);
  } else {
    attr.updateRange.offset = 0;
    attr.updateRange.count = elementCount;
  }
}

function resolveInstancedCapacity(current: number, required: number): number {
  if (required <= current) return current;
  return Math.max(required, current * 2 || 128);
}

export function getOrUpdateInstancedMesh(
  obj: RenderObject,
  cameraTransform: Float32Array | undefined,
  instancedMeshCache: Map<string, InstancedMeshCacheEntry>,
  writeInstanceMatrices: WriteInstanceMatrices,
): THREE.InstancedMesh | null {
  if (!obj.instances) return null;
  const { count, matrices, opacities, frames, spritesheetSize } = obj.instances;
  const { colors } = obj.instances;
  const requiredCapacity = Math.max(
    count,
    Math.ceil(matrices.length / 16),
    opacities.length,
    frames?.length ?? 0,
    colors ? Math.ceil(colors.length / 3) : 0,
  );
  let cached = instancedMeshCache.get(obj.id);
  if (!cached || cached.maxCount < requiredCapacity) {
    if (cached) {
      cached.mesh.dispose();
      cached.material.dispose();
    }
    const allocCount = Math.ceil(resolveInstancedCapacity(cached?.maxCount ?? 0, requiredCapacity) / 256) * 256;
    const geometry = (obj.mesh as ThreeMesh).getNativeMesh();
    const origMaterial = (obj.material as ThreeMaterial).getNativeMaterial();
    let texture: THREE.Texture | null = null;
    let color: THREE.Color | undefined;
    let blending: THREE.Blending = THREE.NormalBlending;
    if (origMaterial instanceof THREE.ShaderMaterial) {
      texture = origMaterial.uniforms['map']?.value;
      color = origMaterial.uniforms['color']?.value;
      blending = origMaterial.blending;
    } else if (origMaterial instanceof THREE.MeshBasicMaterial) {
      texture = origMaterial.map;
      color = origMaterial.color;
      blending = origMaterial.blending;
    }
    const material = createInstancedSpriteMaterial(
      { getNativeTexture: () => texture } as unknown as ITexture,
      blending === THREE.AdditiveBlending ? BlendMode.Additive : BlendMode.Normal,
      color ? { r: color.r, g: color.g, b: color.b } : undefined,
      spritesheetSize
    );
    material.blending = blending;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, allocCount);
    instancedMesh.frustumCulled = false;
    const opacityArray = new Float32Array(allocCount);
    const opacityAttr = new THREE.InstancedBufferAttribute(opacityArray, 1);
    opacityAttr.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.geometry.setAttribute('instanceOpacity', opacityAttr);
    const frameArray = new Float32Array(allocCount);
    const frameAttr = new THREE.InstancedBufferAttribute(frameArray, 1);
    frameAttr.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.geometry.setAttribute('instanceFrame', frameAttr);
    const colorArray = new Float32Array(allocCount * 3);
    colorArray.fill(1);
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.geometry.setAttribute('instanceColor', colorAttr);
    instancedMesh.matrixAutoUpdate = false;
    instancedMesh.matrix.identity();
    cached = { mesh: instancedMesh, material, opacityAttr, frameAttr, colorAttr, maxCount: allocCount };
    instancedMeshCache.set(obj.id, cached);
  }
  const { mesh: instancedMesh, opacityAttr, frameAttr, colorAttr } = cached;
  if (spritesheetSize && cached.material.uniforms['u_SpritesheetSize']) {
    const u = cached.material.uniforms['u_SpritesheetSize'].value as THREE.Vector2;
    u.set(spritesheetSize[0], spritesheetSize[1]);
  }
  instancedMesh.count = count;
  const instanceMatrix = instancedMesh.instanceMatrix as UpdatableAttribute;
  const matArray = instanceMatrix.array as Float32Array;
  writeInstanceMatrices(matArray, matrices, count, cameraTransform);
  setUpdateRange(instanceMatrix, 16, count);
  instancedMesh.instanceMatrix.needsUpdate = true;
  const opArr = opacityAttr.array as Float32Array;
  opArr.set(opacities.subarray(0, count));
  setUpdateRange(opacityAttr as UpdatableAttribute, 1, count);
  opacityAttr.needsUpdate = true;
  if (frames) {
    const frArr = frameAttr.array as Float32Array;
    frArr.set(frames.subarray(0, count));
    setUpdateRange(frameAttr as UpdatableAttribute, 1, count);
    frameAttr.needsUpdate = true;
  }
  if (colors) {
    const clArr = colorAttr.array as Float32Array;
    clArr.set(colors.subarray(0, count * 3));
    setUpdateRange(colorAttr as UpdatableAttribute, 3, count);
    colorAttr.needsUpdate = true;
  }
  return instancedMesh;
}

export function getOrUpdateRefractionMesh(
  obj: RenderObject,
  sceneCaptureSource: ITexture | null,
  cameraTransform: Float32Array | undefined,
  refractionMeshCache: Map<string, RefractionMeshCacheEntry>,
  writeInstanceMatrices: WriteInstanceMatrices,
): THREE.InstancedMesh | null {
  if (!obj.instances || !obj.refraction) return null;
  const { count, matrices, opacities, frames, spritesheetSize } = obj.instances;
  const requiredCapacity = Math.max(
    count,
    Math.ceil(matrices.length / 16),
    opacities.length,
    frames?.length ?? 0,
  );
  const { normalMap, strength, isFlowMap } = obj.refraction;
  let cached = refractionMeshCache.get(obj.id);
  if (!cached || cached.maxCount < requiredCapacity) {
    if (cached) {
      cached.mesh.dispose();
      cached.material.dispose();
    }
    const allocCount = Math.ceil(resolveInstancedCapacity(cached?.maxCount ?? 0, requiredCapacity) / 256) * 256;
    const geometry = (obj.mesh as ThreeMesh).getNativeMesh();
    const origMaterial = (obj.material as ThreeMaterial).getNativeMaterial();
    let colorTexture: ITexture;
    let refractionBlending: THREE.Blending = THREE.NormalBlending;
    if (origMaterial instanceof THREE.ShaderMaterial && origMaterial.uniforms['map']?.value) {
      colorTexture = { getNativeTexture: () => origMaterial.uniforms['map'].value } as unknown as ITexture;
      refractionBlending = origMaterial.blending;
    } else if (origMaterial instanceof THREE.MeshBasicMaterial && origMaterial.map) {
      colorTexture = { getNativeTexture: () => origMaterial.map } as unknown as ITexture;
      refractionBlending = origMaterial.blending;
    } else {
      colorTexture = { getNativeTexture: () => SHARED_WHITE_TEXTURE } as unknown as ITexture;
    }
    const material = createInstancedRefractionMaterial(
      colorTexture,
      normalMap,
      strength,
      undefined,
      spritesheetSize,
      !!isFlowMap,
      refractionBlending,
    );
    const instancedMesh = new THREE.InstancedMesh(geometry, material, allocCount);
    instancedMesh.frustumCulled = false;
    const opacityArray = new Float32Array(allocCount);
    const opacityAttr = new THREE.InstancedBufferAttribute(opacityArray, 1);
    opacityAttr.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.geometry.setAttribute('instanceOpacity', opacityAttr);
    const frameArray = new Float32Array(allocCount);
    const frameAttr = new THREE.InstancedBufferAttribute(frameArray, 1);
    frameAttr.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.geometry.setAttribute('instanceFrame', frameAttr);
    instancedMesh.matrixAutoUpdate = false;
    instancedMesh.matrix.identity();
    cached = { mesh: instancedMesh, material, opacityAttr, frameAttr, maxCount: allocCount };
    refractionMeshCache.set(obj.id, cached);
  }
  const { mesh: instancedMesh, opacityAttr, frameAttr } = cached;
  if (sceneCaptureSource && cached.material.uniforms['sceneTex']) {
    cached.material.uniforms['sceneTex'].value = sceneCaptureSource.getNativeTexture();
  }
  if (spritesheetSize && cached.material.uniforms['u_SpritesheetSize']) {
    const u = cached.material.uniforms['u_SpritesheetSize'].value as THREE.Vector2;
    u.set(spritesheetSize[0], spritesheetSize[1]);
  }
  if (cached.material.uniforms['u_ColorTexIsFlowMap']) {
    cached.material.uniforms['u_ColorTexIsFlowMap'].value = isFlowMap ? 1.0 : 0.0;
  }
  instancedMesh.count = count;
  const instanceMatrix = instancedMesh.instanceMatrix as UpdatableAttribute;
  const matArray = instanceMatrix.array as Float32Array;
  writeInstanceMatrices(matArray, matrices, count, cameraTransform);
  setUpdateRange(instanceMatrix, 16, count);
  instancedMesh.instanceMatrix.needsUpdate = true;
  const opArr = opacityAttr.array as Float32Array;
  opArr.set(opacities.subarray(0, count));
  setUpdateRange(opacityAttr as UpdatableAttribute, 1, count);
  opacityAttr.needsUpdate = true;
  if (frames) {
    const frArr = frameAttr.array as Float32Array;
    frArr.set(frames.subarray(0, count));
    setUpdateRange(frameAttr as UpdatableAttribute, 1, count);
    frameAttr.needsUpdate = true;
  }
  return instancedMesh;
}
