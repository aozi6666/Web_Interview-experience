import * as THREE from 'three';
import type { ITexture } from '../interfaces/ITexture';

function computeSceneCaptureDpr(baseDpr: number, scale: number): number {
  return baseDpr * scale;
}

export interface SceneCaptureRuntimeState {
  globalSceneCaptureRT: THREE.WebGLRenderTarget | null;
  sceneCaptureRtWrapper: ITexture | null;
  globalSceneCaptureTex: THREE.FramebufferTexture | null;
  globalSceneCaptureWrapper: ITexture | null;
  presentScene: THREE.Scene | null;
  presentCamera: THREE.OrthographicCamera | null;
  presentQuad: THREE.Mesh | null;
  presentMaterial: THREE.MeshBasicMaterial | null;
}

export interface EnsureSceneCaptureRenderTargetInput {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  sceneCaptureScale: number;
  hdr: boolean;
  state: Pick<SceneCaptureRuntimeState, 'globalSceneCaptureRT' | 'sceneCaptureRtWrapper'>;
}

export interface EnsureSceneCaptureRenderTargetResult {
  renderTarget: THREE.WebGLRenderTarget;
  globalSceneCaptureRT: THREE.WebGLRenderTarget;
  sceneCaptureRtWrapper: ITexture;
}

export function ensureSceneCaptureRenderTarget(
  input: EnsureSceneCaptureRenderTargetInput,
): EnsureSceneCaptureRenderTargetResult {
  const { renderer, width, height, sceneCaptureScale, hdr, state } = input;
  const dpr = computeSceneCaptureDpr(renderer.getPixelRatio(), sceneCaptureScale);
  const targetWidth = Math.max(1, Math.floor(width * dpr));
  const targetHeight = Math.max(1, Math.floor(height * dpr));
  let globalSceneCaptureRT = state.globalSceneCaptureRT;
  let sceneCaptureRtWrapper = state.sceneCaptureRtWrapper;
  const requiredType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const requiredMinFilter = THREE.LinearFilter;
  const needsRecreate = !globalSceneCaptureRT
    || globalSceneCaptureRT.width !== targetWidth
    || globalSceneCaptureRT.height !== targetHeight
    || globalSceneCaptureRT.texture.type !== requiredType;
  if (needsRecreate) {
    globalSceneCaptureRT?.dispose();
    globalSceneCaptureRT = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
      minFilter: requiredMinFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: requiredType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    globalSceneCaptureRT.texture.generateMipmaps = false;
    globalSceneCaptureRT.texture.wrapS = THREE.MirroredRepeatWrapping;
    globalSceneCaptureRT.texture.wrapT = THREE.MirroredRepeatWrapping;
    const nativeTex = globalSceneCaptureRT.texture;
    sceneCaptureRtWrapper = {
      id: 'scene_capture_render_target',
      get width() { return targetWidth; },
      get height() { return targetHeight; },
      get isVideoTexture() { return false; },
      getNativeTexture: () => nativeTex,
      update() {},
      updateSubRegion() {},
      setFilter() {},
      setWrap() {},
      dispose() {},
    } as unknown as ITexture;
  }
  return {
    renderTarget: globalSceneCaptureRT!,
    globalSceneCaptureRT: globalSceneCaptureRT!,
    sceneCaptureRtWrapper: sceneCaptureRtWrapper!,
  };
}

export interface CaptureSceneInput {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  sceneCaptureScale: number;
  tmpVec2: THREE.Vector2;
  state: Pick<SceneCaptureRuntimeState, 'globalSceneCaptureTex' | 'globalSceneCaptureWrapper'>;
}

export interface CaptureSceneResult {
  globalSceneCaptureTex: THREE.FramebufferTexture;
  globalSceneCaptureWrapper: ITexture;
  capturedTexture: ITexture;
}

export function captureSceneFromFramebuffer(input: CaptureSceneInput): CaptureSceneResult {
  const { renderer, width, height, sceneCaptureScale, tmpVec2, state } = input;
  const dpr = computeSceneCaptureDpr(renderer.getPixelRatio(), sceneCaptureScale);
  const fbWidth = Math.max(1, Math.floor(width * dpr));
  const fbHeight = Math.max(1, Math.floor(height * dpr));
  let globalSceneCaptureTex = state.globalSceneCaptureTex;
  let globalSceneCaptureWrapper = state.globalSceneCaptureWrapper;
  if (!globalSceneCaptureTex || globalSceneCaptureTex.image.width !== fbWidth || globalSceneCaptureTex.image.height !== fbHeight) {
    globalSceneCaptureTex?.dispose();
    globalSceneCaptureTex = new THREE.FramebufferTexture(fbWidth, fbHeight);
    globalSceneCaptureTex.minFilter = THREE.LinearFilter;
    globalSceneCaptureTex.magFilter = THREE.LinearFilter;
    const nativeTex = globalSceneCaptureTex;
    globalSceneCaptureWrapper = {
      id: 'scene_capture_fullframebuffer',
      get width() { return fbWidth; },
      get height() { return fbHeight; },
      get isVideoTexture() { return false; },
      getNativeTexture: () => nativeTex,
      update() {},
      updateSubRegion() {},
      setFilter() {},
      setWrap() {},
      dispose() {},
    } as unknown as ITexture;
  }
  renderer.copyFramebufferToTexture(tmpVec2.set(0, 0), globalSceneCaptureTex);
  return {
    globalSceneCaptureTex,
    globalSceneCaptureWrapper: globalSceneCaptureWrapper!,
    capturedTexture: globalSceneCaptureWrapper!,
  };
}

export interface PresentRenderTargetInput {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;
  state: Pick<SceneCaptureRuntimeState, 'presentScene' | 'presentCamera' | 'presentQuad' | 'presentMaterial'>;
}

export interface PresentRenderTargetResult {
  presentScene: THREE.Scene;
  presentCamera: THREE.OrthographicCamera;
  presentQuad: THREE.Mesh;
  presentMaterial: THREE.MeshBasicMaterial;
}

export function presentRenderTargetToScreen(
  input: PresentRenderTargetInput,
): PresentRenderTargetResult {
  const { renderer, target, state } = input;
  let { presentScene, presentCamera, presentQuad, presentMaterial } = state;
  if (!presentScene || !presentCamera || !presentQuad || !presentMaterial) {
    presentScene = new THREE.Scene();
    presentCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    presentMaterial = new THREE.MeshBasicMaterial({
      map: target.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    presentQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), presentMaterial);
    presentQuad.frustumCulled = false;
    presentScene.add(presentQuad);
  }
  if (presentMaterial.map !== target.texture) {
    presentMaterial.map = target.texture;
    presentMaterial.needsUpdate = true;
  }
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  renderer.render(presentScene, presentCamera);
  return { presentScene, presentCamera, presentQuad, presentMaterial };
}
