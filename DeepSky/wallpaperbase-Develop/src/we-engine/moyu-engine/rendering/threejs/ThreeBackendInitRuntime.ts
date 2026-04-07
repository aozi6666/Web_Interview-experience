import * as THREE from 'three';

export interface InitBackendRuntimeInput {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  maxDpr: number;
  powerPreference: WebGLPowerPreference;
  verboseShaderLogs: boolean;
  getCurrentEffectPassLabel: () => string | null;
  logShaderErrorContext: (tag: string, source: string, log: string, radius: number) => void;
}

export interface InitBackendRuntimeResult {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  cameraPerspective: THREE.PerspectiveCamera;
}

export function initBackendRuntime(input: InitBackendRuntimeInput): InitBackendRuntimeResult {
  const {
    canvas,
    width,
    height,
    maxDpr,
    powerPreference,
    verboseShaderLogs,
    getCurrentEffectPassLabel,
    logShaderErrorContext,
  } = input;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    const vertLog = gl.getShaderInfoLog(vertexShader);
    const fragLog = gl.getShaderInfoLog(fragmentShader);
    const progLog = gl.getProgramInfoLog(program);
    const passLabel = getCurrentEffectPassLabel() ?? '(unknown-pass)';
    console.error('[ShaderError] pass:', passLabel);
    console.error('[ShaderError] 顶点着色器错误:', vertLog);
    console.error('[ShaderError] 片段着色器错误:', fragLog);
    console.error('[ShaderError] 链接错误:', progLog);

    const vertSrc = gl.getShaderSource(vertexShader);
    if (vertSrc && verboseShaderLogs) {
      logShaderErrorContext('[ShaderError][VS]', vertSrc, vertLog ?? '', 5);
    }
    const fragSrc = gl.getShaderSource(fragmentShader);
    if (fragSrc && verboseShaderLogs) {
      logShaderErrorContext('[ShaderError][FS]', fragSrc, fragLog ?? '', 5);
    }

    if (verboseShaderLogs) {
      if (vertSrc) {
        console.error(
          '[ShaderError] 顶点着色器源码(前400行):\n',
          vertSrc.split('\n').slice(0, 400).join('\n')
        );
      }
      if (fragSrc) {
        console.error(
          '[ShaderError] 片段着色器源码(前400行):\n',
          fragSrc.split('\n').slice(0, 400).join('\n')
        );
      }
    }
  };
  renderer.sortObjects = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    0,
    width,
    height,
    0,
    -1000,
    1000
  );
  camera.position.z = 100;

  const perspFov = 45;
  const perspZ = height / (2 * Math.tan(THREE.MathUtils.degToRad(perspFov / 2)));
  const cameraPerspective = new THREE.PerspectiveCamera(perspFov, width / Math.max(1, height), 0.1, 5000);
  cameraPerspective.position.set(width / 2, height / 2, perspZ);
  cameraPerspective.lookAt(width / 2, height / 2, 0);

  return { renderer, scene, camera, cameraPerspective };
}
