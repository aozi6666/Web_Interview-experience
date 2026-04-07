import * as THREE from 'three';

export function createEffectFallbackMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
    },
    vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
    fragmentShader: `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(map, vUv);
}
`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export type EffectPassShaderMaterialLike = THREE.ShaderMaterial & {
  userData?: Record<string, unknown>;
  uniforms: Record<string, { value: unknown }>;
};

export interface EffectPassContext {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;
  nativeMaterial: THREE.Material;
  shaderMaterialLike: EffectPassShaderMaterialLike;
  debugLabel?: string;
  fullscreenQuad: THREE.Mesh | null;
  fullscreenScene: THREE.Scene | null;
  fullscreenCamera: THREE.OrthographicCamera | null;
  effectFallbackMaterial: THREE.ShaderMaterial | null;
  effectPassErrorSignatures: Set<string>;
  effectPassLinkErrorSignatures: Set<string>;
  threeProgramDiagSignatures: Set<string>;
  verboseShaderLogs: boolean;
  logShaderErrorContext: (tag: string, source: string, log: string, radius?: number) => void;
  clear: boolean;
  resetTarget: boolean;
}

export interface EffectPassResult {
  fullscreenQuad: THREE.Mesh;
  fullscreenScene: THREE.Scene;
  fullscreenCamera: THREE.OrthographicCamera;
  effectFallbackMaterial: THREE.ShaderMaterial;
}

export function renderEffectPassInternal(ctx: EffectPassContext): EffectPassResult {
  let fullscreenQuad = ctx.fullscreenQuad;
  let fullscreenScene = ctx.fullscreenScene;
  let fullscreenCamera = ctx.fullscreenCamera;
  let effectFallbackMaterial = ctx.effectFallbackMaterial;

  if (!fullscreenQuad || !fullscreenScene || !fullscreenCamera || !effectFallbackMaterial) {
    const geometry = createFullscreenEffectGeometry();
    fullscreenQuad = new THREE.Mesh(geometry);
    fullscreenQuad.frustumCulled = false;
    fullscreenScene = new THREE.Scene();
    fullscreenScene.add(fullscreenQuad);
    fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    effectFallbackMaterial = createEffectFallbackMaterial();
  }

  const gl = ctx.renderer.getContext();
  if (ctx.verboseShaderLogs) {
    while (gl.getError() !== gl.NO_ERROR) {
      // drain stale GL error state in debug mode only
    }
  }

  ctx.renderer.setRenderTarget(ctx.target);
  if (ctx.clear) {
    ctx.renderer.setClearColor(0x000000, 0);
    ctx.renderer.clear();
  }
  ctx.renderer.autoClear = false;

  const shaderMat = ctx.shaderMaterialLike;
  const sourceTex = shaderMat.uniforms?.['g_Texture0']?.value as THREE.Texture | undefined;

  if (shaderMat.userData?.['__weProgramInvalid'] === true && sourceTex) {
    effectFallbackMaterial.uniforms['map'].value = sourceTex;
    fullscreenQuad.material = effectFallbackMaterial;
    ctx.renderer.render(fullscreenScene, fullscreenCamera);
    ctx.renderer.autoClear = true;
    if (ctx.resetTarget) {
      ctx.renderer.setRenderTarget(null);
    }
    return { fullscreenQuad, fullscreenScene, fullscreenCamera, effectFallbackMaterial };
  }

  fullscreenQuad.material = ctx.nativeMaterial;
  ctx.renderer.render(fullscreenScene, fullscreenCamera);

  const programs = (ctx.renderer.info as unknown as {
    programs?: Array<{
      name?: string;
      diagnostics?: {
        programLog?: string;
        vertexShader?: { log?: string; prefix?: string };
        fragmentShader?: { log?: string; prefix?: string };
      };
    }>;
  }).programs;
  if (Array.isArray(programs)) {
    for (const p of programs) {
      const d = p.diagnostics;
      if (!d) continue;
      const programLog = d.programLog ?? '';
      const vertLog = d.vertexShader?.log ?? '';
      const fragLog = d.fragmentShader?.log ?? '';
      if (!programLog && !vertLog && !fragLog) continue;
      const sig = `${p.name ?? 'unnamed'}|${programLog}|${vertLog}|${fragLog}`;
      if (ctx.threeProgramDiagSignatures.has(sig)) continue;
      ctx.threeProgramDiagSignatures.add(sig);
      console.error(`[ThreeProgramDiag] name=${p.name ?? 'unnamed'} pass=${ctx.debugLabel ?? '(unknown-pass)'}`);
      if (programLog) console.error('[ThreeProgramDiag] programLog:', programLog);
      if (vertLog) console.error('[ThreeProgramDiag] vertexLog:', vertLog);
      if (fragLog) console.error('[ThreeProgramDiag] fragmentLog:', fragLog);
      if (ctx.verboseShaderLogs) {
        const vertPrefix = d.vertexShader?.prefix;
        const fragPrefix = d.fragmentShader?.prefix;
        if (vertPrefix) {
          console.error('[ThreeProgramDiag] vertexPrefix(前120行):\n', vertPrefix.split('\n').slice(0, 120).join('\n'));
          ctx.logShaderErrorContext('[ThreeProgramDiag][VS]', vertPrefix, vertLog);
        }
        if (fragPrefix) {
          console.error('[ThreeProgramDiag] fragmentPrefix(前120行):\n', fragPrefix.split('\n').slice(0, 120).join('\n'));
          ctx.logShaderErrorContext('[ThreeProgramDiag][FS]', fragPrefix, fragLog);
        }
      }
    }
  }

  const vs = (shaderMat as { vertexShader?: string }).vertexShader ?? '';
  const fs = (shaderMat as { fragmentShader?: string }).fragmentShader ?? '';
  const rendererAny = ctx.renderer as unknown as {
    properties?: {
      get: (material: THREE.Material) => {
        program?: { program?: WebGLProgram };
      };
    };
  };
  const program = rendererAny.properties?.get(ctx.nativeMaterial)?.program?.program;
  if (program) {
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
    if (!linked) {
      shaderMat.userData = shaderMat.userData || {};
      shaderMat.userData['__weProgramInvalid'] = true;
      const progLog = gl.getProgramInfoLog(program) ?? '(empty)';
      const signature = `${ctx.nativeMaterial.type}|${progLog}|${vs.slice(0, 160)}|${fs.slice(0, 160)}`;
      if (!ctx.effectPassLinkErrorSignatures.has(signature)) {
        ctx.effectPassLinkErrorSignatures.add(signature);
        console.error(
          `[EffectPassLinkError] pass=${ctx.debugLabel ?? '(unknown-pass)'} materialType=${ctx.nativeMaterial.type} transparent=${ctx.nativeMaterial.transparent} depthTest=${ctx.nativeMaterial.depthTest} depthWrite=${ctx.nativeMaterial.depthWrite}`
        );
        console.error('[EffectPassLinkError] ProgramInfoLog:', progLog);
        if (ctx.verboseShaderLogs) {
          if (vs) {
            console.error('[EffectPassLinkError] vertexShader(前120行):\n', vs.split('\n').slice(0, 120).join('\n'));
            ctx.logShaderErrorContext('[EffectPassLinkError][VS]', vs, progLog);
          }
          if (fs) {
            console.error('[EffectPassLinkError] fragmentShader(前120行):\n', fs.split('\n').slice(0, 120).join('\n'));
            ctx.logShaderErrorContext('[EffectPassLinkError][FS]', fs, progLog);
          }
        }
      }
      if (sourceTex) {
        effectFallbackMaterial.uniforms['map'].value = sourceTex;
        fullscreenQuad.material = effectFallbackMaterial;
        ctx.renderer.render(fullscreenScene, fullscreenCamera);
      }
    }
  }

  if (ctx.verboseShaderLogs) {
    const glErr = gl.getError();
    if (glErr !== gl.NO_ERROR) {
      const signature = `${glErr}|${ctx.nativeMaterial.type}|${vs.slice(0, 160)}|${fs.slice(0, 160)}`;
      if (!ctx.effectPassErrorSignatures.has(signature)) {
        ctx.effectPassErrorSignatures.add(signature);
        console.error(
          `[EffectPassError] pass=${ctx.debugLabel ?? '(unknown-pass)'} glError=0x${glErr.toString(16)} materialType=${ctx.nativeMaterial.type} transparent=${ctx.nativeMaterial.transparent} depthTest=${ctx.nativeMaterial.depthTest} depthWrite=${ctx.nativeMaterial.depthWrite}`
        );
        if (vs) {
          console.error('[EffectPassError] vertexShader(前120行):\n', vs.split('\n').slice(0, 120).join('\n'));
        }
        if (fs) {
          console.error('[EffectPassError] fragmentShader(前120行):\n', fs.split('\n').slice(0, 120).join('\n'));
        }
      }
      if (sourceTex) {
        effectFallbackMaterial.uniforms['map'].value = sourceTex;
        fullscreenQuad.material = effectFallbackMaterial;
        ctx.renderer.render(fullscreenScene, fullscreenCamera);
      }
    }
  }

  ctx.renderer.autoClear = true;
  if (ctx.resetTarget) {
    ctx.renderer.setRenderTarget(null);
  }
  return { fullscreenQuad, fullscreenScene, fullscreenCamera, effectFallbackMaterial };
}

function createFullscreenEffectGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3];
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
