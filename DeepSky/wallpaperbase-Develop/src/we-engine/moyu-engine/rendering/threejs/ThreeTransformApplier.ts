import * as THREE from 'three';

export interface TransformApplierContext {
  tmpMatrix4: THREE.Matrix4;
  tmpCameraMatrix: THREE.Matrix4;
  lastAppliedTransformByMesh: WeakMap<THREE.Mesh, Float32Array>;
}

export function writeInstanceMatrices(
  ctx: Pick<TransformApplierContext, 'tmpMatrix4' | 'tmpCameraMatrix'>,
  target: Float32Array,
  source: Float32Array,
  count: number,
  cameraTransform?: Float32Array,
): void {
  if (!cameraTransform) {
    if (target === source) return;
    target.set(source.subarray(0, count * 16));
    return;
  }
  for (let i = 0; i < count; i += 1) {
    const offset = i * 16;
    ctx.tmpMatrix4.fromArray(source, offset);
    ctx.tmpMatrix4.premultiply(ctx.tmpCameraMatrix);
    ctx.tmpMatrix4.toArray(target, offset);
  }
}

export function applyMeshTransform(
  ctx: TransformApplierContext,
  mesh: THREE.Mesh,
  transform: Float32Array,
  cameraTransform?: Float32Array,
): void {
  ctx.tmpMatrix4.fromArray(transform);
  if (cameraTransform) ctx.tmpMatrix4.premultiply(ctx.tmpCameraMatrix);
  const composed = ctx.tmpMatrix4.elements;
  let last = ctx.lastAppliedTransformByMesh.get(mesh);
  if (!last) {
    last = new Float32Array(16);
    ctx.lastAppliedTransformByMesh.set(mesh, last);
  } else {
    let unchanged = true;
    for (let i = 0; i < 16; i += 1) {
      if (last[i] !== composed[i]) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) {
      mesh.matrixAutoUpdate = false;
      return;
    }
  }
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(ctx.tmpMatrix4);
  last.set(composed);
}
