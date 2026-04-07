import * as THREE from 'three';
import type { ITexture } from '../interfaces/ITexture';
import { RenderObjectHint, type ISceneGraph, type RenderObject } from '../interfaces/IRenderBackend';

export interface RenderSceneInternalContext {
  sceneGraph: ISceneGraph;
  forcedTarget: THREE.WebGLRenderTarget | null;
  presentForcedTarget: boolean;
  updateStats: boolean;
  allowSceneCaptureFlow: boolean;
  initialized: boolean;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.OrthographicCamera | null;
  cameraPerspective: THREE.PerspectiveCamera | null;
  width: number;
  height: number;
  sortedObjectsBuffer: RenderObject[];
  meshHasDepth: WeakMap<THREE.Mesh, boolean>;
  tmpColor: THREE.Color;
  tmpVec2: THREE.Vector2;
  tmpCameraMatrix: THREE.Matrix4;
  sceneCaptureTexture: THREE.FramebufferTexture | null;
  useSceneCaptureRenderToTexture: boolean;
  sceneCapturedViaRenderTarget: boolean;
  refractionScene: THREE.Scene | null;
  frameCount: number;
  fpsUpdateTime: number;
  stats: {
    renderTime: number;
    drawCalls: number;
    triangles: number;
    textures: number;
    fps: number;
    programs?: number;
    geometries?: number;
  };
  ensureGlobalSceneCaptureRenderTarget: () => THREE.WebGLRenderTarget | null;
  presentRenderTargetToScreen: (target: THREE.WebGLRenderTarget) => void;
  getOrUpdateInstancedMesh: (obj: RenderObject, cameraTransform?: Float32Array) => THREE.InstancedMesh | null;
  getOrCreateThreeMesh: (obj: RenderObject) => THREE.Mesh | null;
  applyTransform: (mesh: THREE.Mesh, transform: Float32Array, cameraTransform?: Float32Array) => void;
  getOrUpdateRefractionMesh: (
    obj: RenderObject,
    sceneCaptureSource: ITexture | null,
    cameraTransform?: Float32Array
  ) => THREE.InstancedMesh | null;
}

export interface RenderSceneInternalResult {
  sceneCaptureTexture: THREE.FramebufferTexture | null;
  sceneCapturedViaRenderTarget: boolean;
  refractionScene: THREE.Scene | null;
  frameCount: number;
  fpsUpdateTime: number;
  lastFrameTime: number;
}

export function renderSceneInternal(ctx: RenderSceneInternalContext): RenderSceneInternalResult {
  if (!ctx.initialized || !ctx.renderer || !ctx.scene || !ctx.camera) {
    return {
      sceneCaptureTexture: ctx.sceneCaptureTexture,
      sceneCapturedViaRenderTarget: ctx.sceneCapturedViaRenderTarget,
      refractionScene: ctx.refractionScene,
      frameCount: ctx.frameCount,
      fpsUpdateTime: ctx.fpsUpdateTime,
      lastFrameTime: 0,
    };
  }

  const startTime = performance.now();
  let sceneCapturedViaRenderTarget = false;
  let sceneCaptureTexture = ctx.sceneCaptureTexture;
  let refractionScene = ctx.refractionScene;

  const captureTarget = ctx.forcedTarget
    ?? (ctx.allowSceneCaptureFlow && ctx.useSceneCaptureRenderToTexture ? ctx.ensureGlobalSceneCaptureRenderTarget() : null);
  if (captureTarget) {
    ctx.renderer.setRenderTarget(captureTarget);
  }

  let savedCamLeft = 0;
  let savedCamRight = 0;
  let savedCamTop = 0;
  let savedCamBottom = 0;
  const needCameraOverride = !!ctx.forcedTarget && ctx.sceneGraph.width > 0 && ctx.sceneGraph.height > 0;
  if (needCameraOverride && ctx.forcedTarget) {
    savedCamLeft = ctx.camera.left;
    savedCamRight = ctx.camera.right;
    savedCamTop = ctx.camera.top;
    savedCamBottom = ctx.camera.bottom;

    const rtAspect = ctx.forcedTarget.width / ctx.forcedTarget.height;
    const sceneAspect = ctx.sceneGraph.width / ctx.sceneGraph.height;
    if (rtAspect >= sceneAspect) {
      const visibleW = ctx.sceneGraph.height * rtAspect;
      const padding = { x: (visibleW - ctx.sceneGraph.width) / 2, y: 0 };
      ctx.camera.left = -padding.x;
      ctx.camera.right = ctx.sceneGraph.width + padding.x;
      ctx.camera.top = ctx.sceneGraph.height;
      ctx.camera.bottom = 0;
    } else {
      const visibleH = ctx.sceneGraph.width / rtAspect;
      const padding = { x: 0, y: (visibleH - ctx.sceneGraph.height) / 2 };
      ctx.camera.left = 0;
      ctx.camera.right = ctx.sceneGraph.width;
      ctx.camera.top = ctx.sceneGraph.height + padding.y;
      ctx.camera.bottom = -padding.y;
    }
    ctx.camera.updateProjectionMatrix();
  }

  ctx.scene.clear();
  const isOverlayPass = !captureTarget && ctx.sceneGraph.backgroundColor && ctx.sceneGraph.backgroundColor.a === 0;
  if (isOverlayPass) {
    ctx.renderer.autoClear = false;
    ctx.renderer.clearDepth();
  } else {
    ctx.renderer.autoClear = true;
    if (ctx.sceneGraph.backgroundColor) {
      ctx.tmpColor.setRGB(
        ctx.sceneGraph.backgroundColor.r,
        ctx.sceneGraph.backgroundColor.g,
        ctx.sceneGraph.backgroundColor.b,
      );
      ctx.renderer.setClearColor(ctx.tmpColor, ctx.sceneGraph.backgroundColor.a);
    }
  }

  const sortedObjects = ctx.sortedObjectsBuffer;
  sortedObjects.length = ctx.sceneGraph.objects.length;
  for (let i = 0; i < ctx.sceneGraph.objects.length; i += 1) {
    sortedObjects[i] = ctx.sceneGraph.objects[i];
  }
  sortedObjects.sort((a, b) => a.zIndex - b.zIndex);
  const normalObjects: RenderObject[] = [];
  const refractionObjects: RenderObject[] = [];
  for (const obj of sortedObjects) {
    if (!obj.visible) continue;
    if (obj.hint === RenderObjectHint.InstancedRefraction) {
      refractionObjects.push(obj);
    } else {
      normalObjects.push(obj);
    }
  }

  const cameraTransform = ctx.sceneGraph.cameraTransform;
  if (cameraTransform) {
    ctx.tmpCameraMatrix.fromArray(cameraTransform);
  }

  let beforeRefraction = normalObjects;
  let afterRefraction: RenderObject[] = [];
  if (refractionObjects.length > 0) {
    const maxRefractionZIndex = Math.max(...refractionObjects.map((obj) => obj.zIndex));
    beforeRefraction = [];
    afterRefraction = [];
    for (const obj of normalObjects) {
      if (obj.zIndex <= maxRefractionZIndex) beforeRefraction.push(obj);
      else afterRefraction.push(obj);
    }
  }

  let triangleCount = 0;
  let usePerspectiveCamera = false;
  for (const obj of beforeRefraction) {
    const isInstanced = obj.hint === RenderObjectHint.Instanced || obj.hint === RenderObjectHint.InstancedRefraction;
    if (isInstanced && obj.instances && obj.instances.count > 0) {
      const instancedMesh = ctx.getOrUpdateInstancedMesh(obj, cameraTransform);
      if (instancedMesh) {
        ctx.scene.add(instancedMesh);
        triangleCount += 2 * obj.instances.count;
      }
      continue;
    }
    const threeMesh = ctx.getOrCreateThreeMesh(obj);
    if (threeMesh) {
      if (obj.hint === RenderObjectHint.SingleMeshPerspective || ctx.meshHasDepth.get(threeMesh)) {
        usePerspectiveCamera = true;
      }
      ctx.applyTransform(threeMesh, obj.transform, cameraTransform);
      if (threeMesh.material instanceof THREE.Material) {
        threeMesh.material.opacity = obj.opacity;
      }
      ctx.scene.add(threeMesh);
      if (threeMesh.geometry.index) {
        triangleCount += threeMesh.geometry.index.count / 3;
      } else {
        const position = threeMesh.geometry.getAttribute('position');
        if (position) triangleCount += position.count / 3;
      }
    }
  }

  const renderCamera: THREE.Camera = usePerspectiveCamera && ctx.cameraPerspective
    ? ctx.cameraPerspective
    : ctx.camera;
  if (usePerspectiveCamera && ctx.cameraPerspective) {
    ctx.cameraPerspective.aspect = ctx.width / Math.max(1, ctx.height);
    ctx.cameraPerspective.updateProjectionMatrix();
  }
  ctx.renderer.render(ctx.scene, renderCamera);

  if (refractionObjects.length > 0) {
    let sceneCaptureSource: ITexture | null = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    const fbWidth = captureTarget
      ? captureTarget.width
      : Math.max(1, Math.floor(ctx.width * ctx.renderer.getPixelRatio()));
    const fbHeight = captureTarget
      ? captureTarget.height
      : Math.max(1, Math.floor(ctx.height * ctx.renderer.getPixelRatio()));
    sourceWidth = fbWidth;
    sourceHeight = fbHeight;
    if (!sceneCaptureTexture
      || sceneCaptureTexture.image.width !== fbWidth
      || sceneCaptureTexture.image.height !== fbHeight) {
      sceneCaptureTexture?.dispose();
      sceneCaptureTexture = new THREE.FramebufferTexture(fbWidth, fbHeight);
      sceneCaptureTexture.minFilter = THREE.LinearFilter;
      sceneCaptureTexture.magFilter = THREE.LinearFilter;
    }
    ctx.tmpVec2.set(0, 0);
    ctx.renderer.copyFramebufferToTexture(ctx.tmpVec2, sceneCaptureTexture);
    const nativeFramebufferCaptureTex = sceneCaptureTexture;
    sceneCaptureSource = {
      id: 'refraction_scene_framebuffer_copy',
      get width() { return sourceWidth; },
      get height() { return sourceHeight; },
      get isVideoTexture() { return false; },
      update() {},
      updateSubRegion() {},
      setFilter() {},
      setWrap() {},
      dispose() {},
      getNativeTexture: () => nativeFramebufferCaptureTex,
    } as unknown as ITexture;

    if (!refractionScene) {
      refractionScene = new THREE.Scene();
    }
    refractionScene.clear();

    for (const obj of refractionObjects) {
      const refractionMesh = ctx.getOrUpdateRefractionMesh(obj, sceneCaptureSource, cameraTransform);
      if (refractionMesh) {
        refractionScene.add(refractionMesh);
        triangleCount += 2 * obj.instances!.count;
      }
    }

    const prevAutoClear = ctx.renderer.autoClear;
    ctx.renderer.autoClear = false;
    ctx.renderer.render(refractionScene, renderCamera);
    ctx.renderer.autoClear = prevAutoClear;

    if (afterRefraction.length > 0) {
      ctx.scene.clear();
      for (const obj of afterRefraction) {
        const isInstanced = obj.hint === RenderObjectHint.Instanced || obj.hint === RenderObjectHint.InstancedRefraction;
        if (isInstanced && obj.instances && obj.instances.count > 0) {
          const instancedMesh = ctx.getOrUpdateInstancedMesh(obj, cameraTransform);
          if (instancedMesh) {
            ctx.scene.add(instancedMesh);
            triangleCount += 2 * obj.instances.count;
          }
          continue;
        }
        const threeMesh = ctx.getOrCreateThreeMesh(obj);
        if (threeMesh) {
          ctx.applyTransform(threeMesh, obj.transform, cameraTransform);
          if (threeMesh.material instanceof THREE.Material) {
            threeMesh.material.opacity = obj.opacity;
          }
          ctx.scene.add(threeMesh);
          if (threeMesh.geometry.index) {
            triangleCount += threeMesh.geometry.index.count / 3;
          } else {
            const position = threeMesh.geometry.getAttribute('position');
            if (position) triangleCount += position.count / 3;
          }
        }
      }
      const prevAutoClearAfter = ctx.renderer.autoClear;
      ctx.renderer.autoClear = false;
      ctx.renderer.clearDepth();
      ctx.renderer.render(ctx.scene, renderCamera);
      ctx.renderer.autoClear = prevAutoClearAfter;
    }
  }

  if (captureTarget) {
    ctx.renderer.setRenderTarget(null);
    if (ctx.presentForcedTarget || (!ctx.forcedTarget && ctx.allowSceneCaptureFlow && ctx.useSceneCaptureRenderToTexture)) {
      ctx.presentRenderTargetToScreen(captureTarget);
    }
    if (!ctx.forcedTarget && ctx.allowSceneCaptureFlow && ctx.useSceneCaptureRenderToTexture) {
      sceneCapturedViaRenderTarget = true;
    }
  }

  if (needCameraOverride) {
    ctx.camera.left = savedCamLeft;
    ctx.camera.right = savedCamRight;
    ctx.camera.top = savedCamTop;
    ctx.camera.bottom = savedCamBottom;
    ctx.camera.updateProjectionMatrix();
  }

  ctx.renderer.autoClear = true;
  const endTime = performance.now();
  if (ctx.updateStats) {
    ctx.stats.renderTime = endTime - startTime;
    ctx.stats.drawCalls = ctx.renderer.info.render.calls;
    ctx.stats.triangles = triangleCount;
    ctx.stats.textures = ctx.renderer.info.memory.textures;
    ctx.stats.programs = ((ctx.renderer.info as unknown as { programs?: unknown[] }).programs?.length ?? 0);
    ctx.stats.geometries = ctx.renderer.info.memory.geometries ?? 0;
    const nextFrameCount = ctx.frameCount + 1;
    if (endTime - ctx.fpsUpdateTime >= 1000) {
      ctx.stats.fps = nextFrameCount;
      ctx.frameCount = 0;
      ctx.fpsUpdateTime = endTime;
    } else {
      ctx.frameCount = nextFrameCount;
    }
  }

  return {
    sceneCaptureTexture,
    sceneCapturedViaRenderTarget,
    refractionScene,
    frameCount: ctx.frameCount,
    fpsUpdateTime: ctx.fpsUpdateTime,
    lastFrameTime: endTime,
  };
}
