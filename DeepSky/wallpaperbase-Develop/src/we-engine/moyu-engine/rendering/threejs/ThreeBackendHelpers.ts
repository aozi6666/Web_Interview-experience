import * as THREE from 'three';
import { BackendCapability } from '../interfaces/IRenderBackend';
import type { ITexture, TextureData } from '../interfaces/ITexture';
import { TextureFilter, TextureFormat, TextureWrap } from '../interfaces/ITexture';
import type { GeometryData, IMesh } from '../interfaces/IMesh';
import type { IMaterial, MaterialProps } from '../interfaces/IMaterial';
import type { Color3 } from '../../math';
import { ThreeMaterial, createLitSpriteMaterial, createRopeMaterial, createSpriteMaterial } from './ThreeMaterial';
import { ThreeMesh, createDeformableMesh } from './ThreeMesh';
import { ThreeTexture } from './ThreeTexture';

export function createTexture(data: TextureData): ITexture {
  return new ThreeTexture(data);
}

export function createVideoTexture(videoElement: HTMLVideoElement): ITexture {
  return new ThreeTexture({ source: videoElement });
}

export async function createTextureFromURL(url: string): Promise<ITexture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        const threeTexture = new ThreeTexture({});
        (threeTexture as unknown as { _texture: THREE.Texture })._texture = texture;
        resolve(threeTexture);
      },
      undefined,
      (error) => reject(error),
    );
  });
}

export function createTextureFromRGBA(data: Uint8Array, width: number, height: number): ITexture {
  return new ThreeTexture({
    data,
    width,
    height,
    format: TextureFormat.RGBA,
    flipY: true,
    generateMipmaps: false,
    minFilter: TextureFilter.Linear,
    magFilter: TextureFilter.Linear,
    wrapS: TextureWrap.ClampToEdge,
    wrapT: TextureWrap.ClampToEdge,
  });
}

export function createMesh(geometry: GeometryData): IMesh {
  return new ThreeMesh(geometry);
}

export function createDeformableMeshRuntime(
  vertices: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array,
  alphas?: Float32Array,
): IMesh {
  return createDeformableMesh(vertices, uvs, indices, alphas);
}

export function updateMeshVertices(mesh: IMesh, vertices: Float32Array): void {
  mesh.updatePositions(vertices);
}

export function createMaterial(props: MaterialProps): IMaterial {
  return new ThreeMaterial(props);
}

export function createSpriteMaterialRuntime(
  texture: ITexture,
  transparent = true,
  color?: Color3,
  premultipliedTexture = false,
): IMaterial {
  return createSpriteMaterial(texture, transparent, color, premultipliedTexture);
}

export function createLitSpriteMaterialRuntime(
  texture: ITexture,
  transparent = true,
  color?: Color3,
  premultipliedTexture = false,
): IMaterial {
  return createLitSpriteMaterial(texture, transparent, color, premultipliedTexture);
}

export function createRopeMaterialRuntime(texture: ITexture, color?: Color3): IMaterial {
  return createRopeMaterial(texture, color);
}

export function hasBackendCapability(cap: BackendCapability): boolean {
  return (
    cap === BackendCapability.Instancing
    || cap === BackendCapability.CustomShaders
    || cap === BackendCapability.VideoTexture
    || cap === BackendCapability.SceneCapture
    || cap === BackendCapability.PremultipliedAlpha
  );
}

export function setTexturePremultiplyAlpha(texture: ITexture, enabled: boolean): void {
  const native = (texture as { getNativeTexture?: () => unknown }).getNativeTexture?.();
  if (!native || typeof native !== 'object') return;
  const maybeTexture = native as { premultiplyAlpha?: boolean; needsUpdate?: boolean };
  if ('premultiplyAlpha' in maybeTexture) {
    maybeTexture.premultiplyAlpha = enabled;
    maybeTexture.needsUpdate = true;
  }
}

export function createIdentityMatrix(): Float32Array {
  const matrix = new Float32Array(16);
  matrix[0] = 1;
  matrix[5] = 1;
  matrix[10] = 1;
  matrix[15] = 1;
  return matrix;
}

export function createTransformMatrix(
  tmpTransformMatrix: THREE.Matrix4,
  tmpRotMatrix: THREE.Matrix4,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
): Float32Array {
  const matrix = tmpTransformMatrix;
  matrix.identity();
  matrix.makeScale(scaleX, scaleY, 1);
  if (rotation !== 0) {
    tmpRotMatrix.makeRotationZ(rotation);
    matrix.premultiply(tmpRotMatrix);
  }
  matrix.setPosition(x, y, 0);
  return new Float32Array(matrix.elements);
}

export function captureCanvasFrame(
  canvas: HTMLCanvasElement | null,
  format: 'png' | 'jpeg' = 'png',
  quality = 0.92,
): string {
  if (!canvas) return '';
  return canvas.toDataURL(`image/${format}`, quality);
}

export function resizeRuntime(
  renderer: THREE.WebGLRenderer | null,
  camera: THREE.OrthographicCamera | null,
  cameraPerspective: THREE.PerspectiveCamera | null,
  width: number,
  height: number,
  maxDpr: number,
): void {
  if (!renderer || !camera) return;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  camera.left = 0;
  camera.right = width;
  camera.top = height;
  camera.bottom = 0;
  camera.updateProjectionMatrix();
  if (cameraPerspective) {
    cameraPerspective.aspect = width / Math.max(1, height);
    const perspZ = height / (2 * Math.tan(THREE.MathUtils.degToRad(cameraPerspective.fov / 2)));
    cameraPerspective.position.set(width / 2, height / 2, perspZ);
    cameraPerspective.lookAt(width / 2, height / 2, 0);
    cameraPerspective.updateProjectionMatrix();
  }
}

export function clearRuntime(
  renderer: THREE.WebGLRenderer | null,
  tmpColor: THREE.Color,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (!renderer) return;
  tmpColor.setRGB(r, g, b);
  renderer.setClearColor(tmpColor, a);
  renderer.clear();
}
