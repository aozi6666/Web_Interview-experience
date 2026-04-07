import * as THREE from 'three';
import type {
  InstancedMeshCacheEntry,
  RefractionMeshCacheEntry,
} from './ThreeInstancedMeshFactory';

export interface ClearBackendCachesInput {
  scene: THREE.Scene | null;
  refractionScene: THREE.Scene | null;
  meshObjects: Map<string, THREE.Mesh>;
  instancedMeshCache: Map<string, InstancedMeshCacheEntry>;
  refractionMeshCache: Map<string, RefractionMeshCacheEntry>;
  fullscreenQuad: THREE.Mesh | null;
  fullscreenScene: THREE.Scene | null;
  fullscreenCamera: THREE.OrthographicCamera | null;
  sceneCaptureTexture: THREE.FramebufferTexture | null;
  globalSceneCaptureTex: THREE.FramebufferTexture | null;
  globalSceneCaptureRT: THREE.WebGLRenderTarget | null;
  presentQuad: THREE.Mesh | null;
  presentScene: THREE.Scene | null;
  presentCamera: THREE.OrthographicCamera | null;
  presentMaterial: THREE.MeshBasicMaterial | null;
}

export interface ClearBackendCachesResult {
  fullscreenQuad: THREE.Mesh | null;
  fullscreenScene: THREE.Scene | null;
  fullscreenCamera: THREE.OrthographicCamera | null;
  sceneCaptureTexture: THREE.FramebufferTexture | null;
  globalSceneCaptureTex: THREE.FramebufferTexture | null;
  globalSceneCaptureRT: THREE.WebGLRenderTarget | null;
  presentQuad: THREE.Mesh | null;
  presentScene: THREE.Scene | null;
  presentCamera: THREE.OrthographicCamera | null;
  presentMaterial: THREE.MeshBasicMaterial | null;
}

export function clearBackendCaches(input: ClearBackendCachesInput): ClearBackendCachesResult {
  const {
    scene,
    refractionScene,
    meshObjects,
    instancedMeshCache,
    refractionMeshCache,
    fullscreenQuad,
    fullscreenScene,
    fullscreenCamera,
    sceneCaptureTexture,
    globalSceneCaptureTex,
    globalSceneCaptureRT,
    presentQuad,
    presentScene,
    presentCamera,
    presentMaterial,
  } = input;
  meshObjects.forEach((mesh) => {
    scene?.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  });
  meshObjects.clear();

  instancedMeshCache.forEach((cached) => {
    scene?.remove(cached.mesh);
    cached.mesh.dispose();
    cached.material.dispose();
  });
  instancedMeshCache.clear();

  refractionMeshCache.forEach((cached) => {
    refractionScene?.remove(cached.mesh);
    cached.mesh.dispose();
    cached.material.dispose();
  });
  refractionMeshCache.clear();

  let nextFullscreenQuad = fullscreenQuad;
  let nextFullscreenScene = fullscreenScene;
  let nextFullscreenCamera = fullscreenCamera;
  if (nextFullscreenQuad) {
    nextFullscreenScene?.remove(nextFullscreenQuad);
    nextFullscreenQuad.geometry.dispose();
    nextFullscreenQuad = null;
    nextFullscreenScene = null;
    nextFullscreenCamera = null;
  }

  let nextSceneCaptureTexture = sceneCaptureTexture;
  if (nextSceneCaptureTexture) {
    nextSceneCaptureTexture.dispose();
    nextSceneCaptureTexture = null;
  }

  let nextGlobalSceneCaptureTex = globalSceneCaptureTex;
  if (nextGlobalSceneCaptureTex) {
    nextGlobalSceneCaptureTex.dispose();
    nextGlobalSceneCaptureTex = null;
  }

  let nextGlobalSceneCaptureRT = globalSceneCaptureRT;
  if (nextGlobalSceneCaptureRT) {
    nextGlobalSceneCaptureRT.dispose();
    nextGlobalSceneCaptureRT = null;
  }

  let nextPresentQuad = presentQuad;
  let nextPresentScene = presentScene;
  let nextPresentCamera = presentCamera;
  let nextPresentMaterial = presentMaterial;
  if (nextPresentQuad) {
    nextPresentScene?.remove(nextPresentQuad);
    nextPresentQuad.geometry.dispose();
    nextPresentMaterial?.dispose();
    nextPresentQuad = null;
    nextPresentMaterial = null;
    nextPresentScene = null;
    nextPresentCamera = null;
  }

  return {
    fullscreenQuad: nextFullscreenQuad,
    fullscreenScene: nextFullscreenScene,
    fullscreenCamera: nextFullscreenCamera,
    sceneCaptureTexture: nextSceneCaptureTexture,
    globalSceneCaptureTex: nextGlobalSceneCaptureTex,
    globalSceneCaptureRT: nextGlobalSceneCaptureRT,
    presentQuad: nextPresentQuad,
    presentScene: nextPresentScene,
    presentCamera: nextPresentCamera,
    presentMaterial: nextPresentMaterial,
  };
}
