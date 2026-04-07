import * as THREE from 'three';
import type { RenderObject } from '../interfaces/IRenderBackend';
import { ThreeMesh } from './ThreeMesh';
import { ThreeMaterial } from './ThreeMaterial';

function hasGeometryDepth(geometry: THREE.BufferGeometry): boolean {
  const pos = geometry.getAttribute('position');
  if (!pos) return false;
  for (let i = 2; i < pos.array.length; i += 3) {
    if (Math.abs(Number(pos.array[i])) > 1e-6) return true;
  }
  return false;
}

export function getOrCreateThreeMesh(
  obj: RenderObject,
  meshObjects: Map<string, THREE.Mesh>,
  meshHasDepth: WeakMap<THREE.Mesh, boolean>,
): THREE.Mesh | null {
  let threeMesh = meshObjects.get(obj.id);
  if (!threeMesh) {
    const geometry = (obj.mesh as ThreeMesh).getNativeMesh();
    const material = (obj.material as ThreeMaterial).getNativeMaterial();
    threeMesh = new THREE.Mesh(geometry, material);
    threeMesh.frustumCulled = false;
    meshHasDepth.set(threeMesh, hasGeometryDepth(geometry));
    meshObjects.set(obj.id, threeMesh);
  } else {
    threeMesh.material = (obj.material as ThreeMaterial).getNativeMaterial();
  }
  return threeMesh;
}
