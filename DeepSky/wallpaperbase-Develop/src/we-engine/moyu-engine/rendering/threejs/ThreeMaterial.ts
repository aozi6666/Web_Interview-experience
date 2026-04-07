import * as THREE from 'three';
import type { Color3 } from '../../math';
import type {
  IMaterial,
  MaterialProps,
  UniformValue
} from '../interfaces/IMaterial';
import { BlendMode, CullMode, DepthFunc } from '../interfaces/IMaterial';
import type { ITexture } from '../interfaces/ITexture';
import { ThreeTexture } from './ThreeTexture';

/**
 * 生成唯一ID
 */
let materialIdCounter = 0;
function generateMaterialId(): string {
  return `mat_${++materialIdCounter}_${Date.now()}`;
}

/**
 * 转换混合模式到Three.js
 */
function toThreeBlending(mode: BlendMode): THREE.Blending {
  switch (mode) {
    case BlendMode.None: return THREE.NoBlending;
    case BlendMode.Additive: return THREE.AdditiveBlending;
    case BlendMode.Multiply: return THREE.MultiplyBlending;
    case BlendMode.Screen: return THREE.CustomBlending;
    case BlendMode.Lighten: return THREE.CustomBlending;
    case BlendMode.Darken: return THREE.CustomBlending;
    case BlendMode.Normal:
    default: return THREE.NormalBlending;
  }
}

/**
 * 转换剔除模式到Three.js
 */
function toThreeSide(cullMode: CullMode): THREE.Side {
  switch (cullMode) {
    case CullMode.Front: return THREE.BackSide;
    case CullMode.Back: return THREE.FrontSide;
    case CullMode.None:
    default: return THREE.DoubleSide;
  }
}

/**
 * 转换深度函数到Three.js
 */
function toThreeDepthFunc(func: DepthFunc): THREE.DepthModes {
  const map: Record<DepthFunc, THREE.DepthModes> = {
    'never': THREE.NeverDepth,
    'less': THREE.LessDepth,
    'equal': THREE.EqualDepth,
    'less_equal': THREE.LessEqualDepth,
    'greater': THREE.GreaterDepth,
    'not_equal': THREE.NotEqualDepth,
    'greater_equal': THREE.GreaterEqualDepth,
    'always': THREE.AlwaysDepth,
  };
  return map[func] || THREE.LessEqualDepth;
}

/**
 * 默认顶点着色器
 */
const DEFAULT_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * 默认片段着色器
 */
const DEFAULT_FRAGMENT_SHADER = `
uniform sampler2D map;
uniform float opacity;
uniform vec3 color;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  float a = texColor.a * opacity;
  // 输出预乘 alpha：渲染器 premultipliedAlpha=true 时 NormalBlending 使用
  // (ONE, ONE_MINUS_SRC_ALPHA)，需要 rgb 已乘以 alpha 才能正确混合
  gl_FragColor = vec4(texColor.rgb * color * a, a);
}
`;

/**
 * 预乘 alpha 纹理用的片段着色器。
 *
 * 当 texture.premultiplyAlpha = true 时，GPU 在上传纹理时已将 RGB 乘以 Alpha，
 * 即 texColor.rgb = originalRgb * texColor.a。
 *
 * 关键区别：此着色器不再用 texColor.a 乘 RGB（否则会双重预乘），
 * 只乘 color 和 opacity。这样双线性滤波在透明边缘产生的插值像素能正确合成，
 * 避免黑边 (dark fringing)。
 */
const PREMULTIPLIED_TEXTURE_FRAGMENT_SHADER = `
uniform sampler2D map;
uniform float opacity;
uniform vec3 color;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  float a = texColor.a * opacity;
  // texColor.rgb 已经是 originalRgb * texColor.a（GPU 上传时预乘），
  // 所以只乘 color * opacity，不再乘 texColor.a
  gl_FragColor = vec4(texColor.rgb * color * opacity, a);
}
`;

const LIT_SPRITE_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LIT_SPRITE_FRAGMENT_SHADER = `
uniform sampler2D map;
uniform float opacity;
uniform vec3 color;
uniform float u_ReceiveLighting;
uniform float u_PremultipliedTexture;
uniform int u_LightCount;
uniform vec4 u_LightPos[4];
uniform vec4 u_LightColor[4];
uniform vec3 u_AmbientColor;
uniform vec2 u_SpriteOrigin;
uniform vec2 u_SpriteSize;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  float a = texColor.a * opacity;
  vec3 baseColor = (u_PremultipliedTexture > 0.5)
    ? (texColor.rgb * color * opacity)
    : (texColor.rgb * color * a);

  if (u_ReceiveLighting > 0.5) {
    const float INV_PI = 0.31830989;
    vec2 scenePos = u_SpriteOrigin + (vUv - vec2(0.5)) * u_SpriteSize;
    vec3 fragPos = vec3(scenePos, 0.0);
    vec3 normal = vec3(0.0, 0.0, 1.0);
    vec3 lightAccum = u_AmbientColor;

    for (int i = 0; i < 4; i++) {
      if (i >= u_LightCount) break;
      vec3 delta = u_LightPos[i].xyz - fragPos;
      float dist = length(delta);
      float radius = max(u_LightPos[i].w, 1e-4);
      float attn = clamp((radius - dist) / radius, 0.0, 1.0);
      attn *= attn;
      float ndotl = 0.0;
      if (dist > 1e-4) {
        ndotl = max(dot(normal, delta / dist), 0.0);
      }
      lightAccum += u_LightColor[i].rgb * (u_LightColor[i].a * INV_PI) * ndotl * attn;
    }
    baseColor *= max(lightAccum, vec3(0.0));
  }

  gl_FragColor = vec4(baseColor, a);
}
`;

function updateUniformValueInPlace(previous: unknown, next: UniformValue): boolean {
  if (previous instanceof THREE.Vector2 && typeof next === 'object' && next !== null && 'x' in next && 'y' in next
    && !('z' in next) && !('w' in next)) {
    previous.set(next.x, next.y);
    return true;
  }
  if (previous instanceof THREE.Vector3 && typeof next === 'object' && next !== null && 'x' in next && 'y' in next && 'z' in next && !('w' in next)) {
    previous.set(next.x, next.y, next.z);
    return true;
  }
  if (previous instanceof THREE.Vector4 && typeof next === 'object' && next !== null && 'x' in next && 'y' in next && 'z' in next && 'w' in next) {
    previous.set(next.x, next.y, next.z, next.w);
    return true;
  }
  if (previous instanceof THREE.Color && typeof next === 'object' && next !== null && 'r' in next && 'g' in next && 'b' in next) {
    previous.setRGB(next.r, next.g, next.b);
    return true;
  }
  if (previous instanceof THREE.Matrix4 && (Array.isArray(next) || next instanceof Float32Array) && next.length === 16) {
    previous.fromArray(Array.from(next));
    return true;
  }
  if (previous instanceof THREE.Matrix3 && (Array.isArray(next) || next instanceof Float32Array) && next.length === 9) {
    previous.fromArray(Array.from(next));
    return true;
  }
  return false;
}

function parseStringToUniformValue(value: string): UniformValue | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
    const hex = Number.parseInt(trimmed.slice(1), 16);
    return {
      r: ((hex >> 16) & 0xff) / 255,
      g: ((hex >> 8) & 0xff) / 255,
      b: (hex & 0xff) / 255,
    };
  }
  const matches = trimmed
    .replace(/[,;]+/g, ' ')
    .match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!matches || matches.length === 0) return undefined;
  const parts = matches.map(Number).filter((n) => Number.isFinite(n));
  if (parts.length === 0) return undefined;
  switch (parts.length) {
    case 1:
      return parts[0];
    case 2:
      return { x: parts[0], y: parts[1] };
    case 3:
      return { r: parts[0], g: parts[1], b: parts[2] };
    case 4:
      return { x: parts[0], y: parts[1], z: parts[2], w: parts[3] };
    default:
      return parts;
  }
}

function normalizeUniformValue(value: unknown): UniformValue | undefined {
  if (value == null) return undefined;
  if (value instanceof Float32Array) {
    return value as UniformValue;
  }
  if (typeof value === 'string') {
    return parseStringToUniformValue(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value as UniformValue;
  }
  if (Array.isArray(value)) {
    const nums = value.map((item) => Number(item)).filter((n) => Number.isFinite(n));
    return nums.length > 0 ? nums : undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('getNativeTexture' in obj && typeof obj.getNativeTexture === 'function') {
      return value as UniformValue;
    }
    if ('value' in obj && !('x' in obj) && !('r' in obj)) {
      return normalizeUniformValue(obj.value);
    }
    if ('r' in obj && 'g' in obj && 'b' in obj) {
      const r = Number(obj.r);
      const g = Number(obj.g);
      const b = Number(obj.b);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return { r, g, b };
      }
      return undefined;
    }
    if ('x' in obj && 'y' in obj) {
      const x = Number(obj.x);
      const y = Number(obj.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
      if ('z' in obj) {
        const z = Number(obj.z);
        if (!Number.isFinite(z)) return undefined;
        if ('w' in obj) {
          const w = Number(obj.w);
          if (!Number.isFinite(w)) return undefined;
          return { x, y, z, w };
        }
        return { x, y, z };
      }
      return { x, y };
    }
    return undefined;
  }
  return undefined;
}

function normalizeForPreviousUniform(previous: unknown, next: UniformValue): UniformValue | undefined {
  const toFiniteOrUndefined = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const scalar = typeof next === 'number' || typeof next === 'boolean'
    ? toFiniteOrUndefined(next)
    : undefined;
  const asObject = typeof next === 'object' && next !== null
    ? (next as Record<string, unknown>)
    : null;
  const asArray = Array.isArray(next) ? next : null;
  if (previous instanceof THREE.Vector2) {
    if (scalar !== undefined) return { x: scalar, y: scalar };
    if (asObject && 'x' in asObject && 'y' in asObject) {
      const x = toFiniteOrUndefined(asObject.x);
      const y = toFiniteOrUndefined(asObject.y);
      if (x === undefined || y === undefined) return undefined;
      return { x, y };
    }
    if (asObject && 'r' in asObject && 'g' in asObject) {
      const x = toFiniteOrUndefined(asObject.r);
      const y = toFiniteOrUndefined(asObject.g);
      if (x === undefined || y === undefined) return undefined;
      return { x, y };
    }
    if (asArray && asArray.length >= 2) {
      const x = toFiniteOrUndefined(asArray[0]);
      const y = toFiniteOrUndefined(asArray[1]);
      if (x === undefined || y === undefined) return undefined;
      return { x, y };
    }
    return undefined;
  }
  if (previous instanceof THREE.Vector3) {
    if (scalar !== undefined) return { x: scalar, y: scalar, z: scalar };
    if (asObject && 'x' in asObject && 'y' in asObject && 'z' in asObject) {
      const x = toFiniteOrUndefined(asObject.x);
      const y = toFiniteOrUndefined(asObject.y);
      const z = toFiniteOrUndefined(asObject.z);
      if (x === undefined || y === undefined || z === undefined) return undefined;
      return { x, y, z };
    }
    if (asObject && 'r' in asObject && 'g' in asObject && 'b' in asObject) {
      const x = toFiniteOrUndefined(asObject.r);
      const y = toFiniteOrUndefined(asObject.g);
      const z = toFiniteOrUndefined(asObject.b);
      if (x === undefined || y === undefined || z === undefined) return undefined;
      return { x, y, z };
    }
    if (asArray && asArray.length >= 3) {
      const x = toFiniteOrUndefined(asArray[0]);
      const y = toFiniteOrUndefined(asArray[1]);
      const z = toFiniteOrUndefined(asArray[2]);
      if (x === undefined || y === undefined || z === undefined) return undefined;
      return { x, y, z };
    }
    return undefined;
  }
  if (previous instanceof THREE.Vector4) {
    if (scalar !== undefined) return { x: scalar, y: scalar, z: scalar, w: scalar };
    if (asObject && 'x' in asObject && 'y' in asObject && 'z' in asObject && 'w' in asObject) {
      const x = toFiniteOrUndefined(asObject.x);
      const y = toFiniteOrUndefined(asObject.y);
      const z = toFiniteOrUndefined(asObject.z);
      const w = toFiniteOrUndefined(asObject.w);
      if (x === undefined || y === undefined || z === undefined || w === undefined) return undefined;
      return { x, y, z, w };
    }
    if (asArray && asArray.length >= 4) {
      const x = toFiniteOrUndefined(asArray[0]);
      const y = toFiniteOrUndefined(asArray[1]);
      const z = toFiniteOrUndefined(asArray[2]);
      const w = toFiniteOrUndefined(asArray[3]);
      if (x === undefined || y === undefined || z === undefined || w === undefined) return undefined;
      return { x, y, z, w };
    }
    return undefined;
  }
  if (previous instanceof THREE.Color) {
    if (scalar !== undefined) return { r: scalar, g: scalar, b: scalar };
    if (asObject && 'r' in asObject && 'g' in asObject && 'b' in asObject) {
      const r = toFiniteOrUndefined(asObject.r);
      const g = toFiniteOrUndefined(asObject.g);
      const b = toFiniteOrUndefined(asObject.b);
      if (r === undefined || g === undefined || b === undefined) return undefined;
      return { r, g, b };
    }
    if (asObject && 'x' in asObject && 'y' in asObject && 'z' in asObject) {
      const r = toFiniteOrUndefined(asObject.x);
      const g = toFiniteOrUndefined(asObject.y);
      const b = toFiniteOrUndefined(asObject.z);
      if (r === undefined || g === undefined || b === undefined) return undefined;
      return { r, g, b };
    }
    if (asArray && asArray.length >= 3) {
      const r = toFiniteOrUndefined(asArray[0]);
      const g = toFiniteOrUndefined(asArray[1]);
      const b = toFiniteOrUndefined(asArray[2]);
      if (r === undefined || g === undefined || b === undefined) return undefined;
      return { r, g, b };
    }
    return undefined;
  }
  return next;
}

/**
 * Three.js材质实现
 */
export class ThreeMaterial implements IMaterial {
  readonly id: string;
  private _material: THREE.Material;
  private _uniforms: Record<string, THREE.IUniform>;
  private _isShaderMaterial: boolean;
  
  constructor(props: MaterialProps) {
    this.id = generateMaterialId();
    this._uniforms = {};
    this._isShaderMaterial = !!(props.vertexShader || props.fragmentShader);
    
    if (this._isShaderMaterial) {
      // 创建自定义着色器材质
      this._uniforms = {
        map: { value: null },
        opacity: { value: props.opacity ?? 1.0 },
        color: { value: new THREE.Color(
          props.color?.r ?? 1, 
          props.color?.g ?? 1, 
          props.color?.b ?? 1
        )},
      };
      
      // 添加用户自定义uniforms
      if (props.uniforms) {
        for (const [key, value] of Object.entries(props.uniforms)) {
          const normalizedValue = normalizeUniformValue(value);
          if (normalizedValue === undefined) {
            console.warn(`[ThreeMaterial] Skip invalid initial uniform "${key}" value`, value);
            continue;
          }
          this._uniforms[key] = { value: this.convertUniformValue(normalizedValue) };
        }
      }
      
      this._material = new THREE.ShaderMaterial({
        vertexShader: props.vertexShader || DEFAULT_VERTEX_SHADER,
        fragmentShader: props.fragmentShader || DEFAULT_FRAGMENT_SHADER,
        uniforms: this._uniforms,
        transparent: props.transparent ?? true,
        side: toThreeSide(props.cullMode || CullMode.None),
        depthTest: props.depthTest ?? true,
        depthWrite: props.depthWrite ?? true,
      });
      // 默认自定义着色器按预乘 alpha 路径处理；对非预乘输出可按需关闭。
      this._material.premultipliedAlpha = props.premultipliedAlpha ?? true;
      this.applyBlendMode(props.blendMode || BlendMode.Normal);
    } else {
      // 创建标准材质
      const basicMat = new THREE.MeshBasicMaterial({
        transparent: props.transparent ?? true,
        opacity: props.opacity ?? 1.0,
        color: new THREE.Color(
          props.color?.r ?? 1, 
          props.color?.g ?? 1, 
          props.color?.b ?? 1
        ),
        side: toThreeSide(props.cullMode || CullMode.None),
        depthTest: props.depthTest ?? true,
        depthWrite: props.depthWrite ?? true,
      });
      // 默认基础材质按预乘 alpha 处理；对非预乘输出可按需关闭。
      basicMat.premultipliedAlpha = props.premultipliedAlpha ?? true;
      this._material = basicMat;
      this.applyBlendMode(props.blendMode || BlendMode.Normal);
    }
    
    // 设置纹理
    if (props.texture) {
      this.setTexture(props.texture);
    }
  }
  
  private convertUniformValue(value: UniformValue): unknown {
    if (value instanceof ThreeTexture) {
      return value.getNativeTexture();
    }
    // 处理任意 ITexture 包装器（场景捕获、FBO 纹理等），
    // 通过 duck-typing 检测 getNativeTexture 方法
    if (typeof value === 'object' && value !== null && 'getNativeTexture' in value &&
        typeof (value as unknown as Record<string, unknown>).getNativeTexture === 'function') {
      return (value as unknown as { getNativeTexture(): unknown }).getNativeTexture();
    }
    // 数组类型：16 元素 = mat4, 9 = mat3 等
    if (Array.isArray(value)) {
      if (value.length === 16) {
        const m = new THREE.Matrix4();
        m.fromArray(value as number[]);
        return m;
      }
      if (value.length === 9) {
        const m = new THREE.Matrix3();
        m.fromArray(value as number[]);
        return m;
      }
      return value; // 其他数组直接传递
    }
    if (typeof value === 'object' && value !== null) {
      if ('r' in value && 'g' in value && 'b' in value) {
        return new THREE.Color(value.r, value.g, value.b);
      }
      if ('x' in value && 'y' in value) {
        if ('z' in value) {
          if ('w' in value) {
            return new THREE.Vector4(value.x, value.y, value.z, value.w);
          }
          return new THREE.Vector3(value.x, value.y, value.z);
        }
        return new THREE.Vector2(value.x, value.y);
      }
    }
    return value;
  }
  
  get transparent(): boolean {
    return this._material.transparent;
  }
  
  set transparent(value: boolean) {
    this._material.transparent = value;
    this._material.needsUpdate = true;
  }
  
  get opacity(): number {
    return this._material.opacity;
  }
  
  set opacity(value: number) {
    this._material.opacity = value;
    if (this._isShaderMaterial && this._uniforms['opacity']) {
      this._uniforms['opacity'].value = value;
    }
  }
  
  setUniform(name: string, value: UniformValue): void {
    if (this._isShaderMaterial) {
      const shaderMat = this._material as THREE.ShaderMaterial;
      const normalizedValue = normalizeUniformValue(value);
      if (normalizedValue === undefined) {
        console.warn(`[ThreeMaterial] Skip invalid uniform "${name}" value`, value);
        return;
      }
      if (!shaderMat.uniforms[name]) {
        shaderMat.uniforms[name] = { value: this.convertUniformValue(normalizedValue) };
        return;
      }
      const prevValue = shaderMat.uniforms[name].value;
      const normalizedForPrev = normalizeForPreviousUniform(prevValue, normalizedValue as UniformValue);
      if (normalizedForPrev === undefined) {
        console.warn(`[ThreeMaterial] Skip incompatible uniform "${name}" value`, normalizedValue);
        return;
      }
      if (updateUniformValueInPlace(prevValue, normalizedForPrev as UniformValue)) {
        return;
      }
      shaderMat.uniforms[name].value = this.convertUniformValue(normalizedForPrev as UniformValue);
    }
  }
  
  getUniform(name: string): UniformValue | undefined {
    if (this._isShaderMaterial) {
      const shaderMat = this._material as THREE.ShaderMaterial;
      return shaderMat.uniforms[name]?.value;
    }
    return undefined;
  }
  
  setTexture(texture: ITexture): void {
    const threeTexture = (texture as ThreeTexture).getNativeTexture();
    
    if (this._isShaderMaterial) {
      const shaderMat = this._material as THREE.ShaderMaterial;
      shaderMat.uniforms['map'].value = threeTexture;
    } else {
      (this._material as THREE.MeshBasicMaterial).map = threeTexture;
      this._material.needsUpdate = true;
    }
  }
  
  setColor(r: number, g: number, b: number): void {
    if (this._isShaderMaterial && this._uniforms['color']) {
      (this._uniforms['color'].value as THREE.Color).setRGB(r, g, b);
    } else {
      (this._material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
    }
  }
  
  setBlendMode(mode: BlendMode): void {
    this.applyBlendMode(mode);
    this._material.needsUpdate = true;
  }
  
  setDepth(test: boolean, write: boolean, func?: DepthFunc): void {
    this._material.depthTest = test;
    this._material.depthWrite = write;
    if (func) {
      this._material.depthFunc = toThreeDepthFunc(func);
    }
    this._material.needsUpdate = true;
  }
  
  clone(): IMaterial {
    const clonedMaterial = this._material.clone();
    const cloned = new ThreeMaterial({});
    cloned._material.dispose();
    (cloned as unknown as { _material: THREE.Material })._material = clonedMaterial;
    return cloned;
  }
  
  dispose(): void {
    this._material.dispose();
  }
  
  getNativeMaterial(): THREE.Material {
    return this._material;
  }

  private applyBlendMode(mode: BlendMode): void {
    if (mode === BlendMode.Screen) {
      this._material.blending = THREE.CustomBlending;
      this._material.blendEquation = THREE.AddEquation;
      this._material.blendSrc = THREE.OneFactor;
      this._material.blendDst = THREE.OneMinusSrcColorFactor;
      this._material.blendEquationAlpha = THREE.AddEquation;
      this._material.blendSrcAlpha = THREE.OneFactor;
      this._material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      return;
    }
    if (mode === BlendMode.Lighten) {
      // Lighten = max(src, dst)
      // 渲染器使用 premultipliedAlpha，精灵着色器输出 (rgb*a, a)
      // RGB: max(src_premul, dst) — 半透明像素 src_premul 较小，自然显示背景
      this._material.blending = THREE.CustomBlending;
      this._material.blendEquation = THREE.MaxEquation;
      this._material.blendSrc = THREE.OneFactor;
      this._material.blendDst = THREE.OneFactor;
      this._material.blendEquationAlpha = THREE.AddEquation;
      this._material.blendSrcAlpha = THREE.OneFactor;
      this._material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      return;
    }
    if (mode === BlendMode.Darken) {
      // Darken = min(src, dst)
      this._material.blending = THREE.CustomBlending;
      this._material.blendEquation = THREE.MinEquation;
      this._material.blendSrc = THREE.OneFactor;
      this._material.blendDst = THREE.OneFactor;
      this._material.blendEquationAlpha = THREE.AddEquation;
      this._material.blendSrcAlpha = THREE.OneFactor;
      this._material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      return;
    }
    this._material.blending = toThreeBlending(mode);
  }
}

/**
 * 创建精灵材质
 * @param premultipliedTexture 纹理是否已预乘 alpha（texture.premultiplyAlpha=true）。
 *   为 true 时使用 PREMULTIPLIED_TEXTURE_FRAGMENT_SHADER（ShaderMaterial），
 *   避免 MeshBasicMaterial 的 premultiplied_alpha_fragment 导致双重预乘。
 */
export function createSpriteMaterial(
  texture: ITexture, 
  transparent = true,
  color?: Color3,
  premultipliedTexture = false,
): ThreeMaterial {
  if (premultipliedTexture) {
    // 预乘纹理：用 ShaderMaterial + 专用片段着色器
    return new ThreeMaterial({
      texture,
      transparent,
      blendMode: BlendMode.Normal,
      depthTest: false,
      depthWrite: false,
      color,
      vertexShader: DEFAULT_VERTEX_SHADER,
      fragmentShader: PREMULTIPLIED_TEXTURE_FRAGMENT_SHADER,
    });
  }
  return new ThreeMaterial({
    texture,
    transparent,
    blendMode: BlendMode.Normal,
    depthTest: false,
    depthWrite: false,
    color,
  });
}

export function createLitSpriteMaterial(
  texture: ITexture,
  transparent = true,
  color?: Color3,
  premultipliedTexture = false,
): ThreeMaterial {
  return new ThreeMaterial({
    texture,
    transparent,
    blendMode: BlendMode.Normal,
    depthTest: false,
    depthWrite: false,
    color,
    vertexShader: LIT_SPRITE_VERTEX_SHADER,
    fragmentShader: LIT_SPRITE_FRAGMENT_SHADER,
    uniforms: {
      u_ReceiveLighting: 0,
      u_PremultipliedTexture: premultipliedTexture ? 1 : 0,
      u_LightCount: 0,
      u_LightPos: new Float32Array(16),
      u_LightColor: new Float32Array(16),
      u_AmbientColor: { r: 1, g: 1, b: 1 },
      u_SpriteOrigin: { x: 0, y: 0 },
      u_SpriteSize: { x: 1, y: 1 },
    },
  });
}

// ==================== Instanced Rendering ====================

/**
 * 支持 instancing 的顶点着色器
 * 当 USE_INSTANCING 被定义时（THREE.InstancedMesh 自动定义），
 * 使用 instanceMatrix 和自定义 instanceOpacity 属性
 */
const INSTANCED_SPRITE_VERTEX = `
varying vec2 vUv;
varying float vInstanceOpacity;
varying float vFrame;
varying vec3 vInstanceColor;

#ifdef USE_INSTANCING
  attribute float instanceOpacity;
  attribute float instanceFrame;
  attribute vec3 instanceColor;
#endif

void main() {
  vUv = uv;

  #ifdef USE_INSTANCING
    vInstanceOpacity = instanceOpacity;
    vFrame = instanceFrame;
    vInstanceColor = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vInstanceOpacity = 1.0;
    vFrame = 0.0;
    vInstanceColor = vec3(1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #endif
}
`;

/**
 * 支持 instancing 的片段着色器
 * 使用 per-instance opacity 而非 uniform opacity
 */
const INSTANCED_SPRITE_FRAGMENT = `
uniform sampler2D map;
uniform vec3 color;
uniform vec2 u_SpritesheetSize; // x=cols, y=rows; (0,0) 表示不使用 spritesheet

varying vec2 vUv;
varying float vInstanceOpacity;
varying float vFrame;
varying vec3 vInstanceColor;

void main() {
  vec2 uv = vUv;
  
  // Spritesheet UV 计算：将完整纹理 UV 映射到当前帧对应的子区域
  // C++ OpenGL 中不 flip，V=0 对应图像顶部。因此 Y 需要翻转。
  if (u_SpritesheetSize.x > 0.0) {
    float cols = u_SpritesheetSize.x;
    float rows = u_SpritesheetSize.y;
    float frameIndex = floor(vFrame);
    
    float frameX = mod(frameIndex, cols);
    // 翻转 frameY：C++ 中 frameY=0 映射到纹理顶部(V=0)，
    float rawFrameY = floor(frameIndex / cols);
    float frameY = rows - 1.0 - rawFrameY;
    
    float frameWidth = 1.0 / cols;
    float frameHeight = 1.0 / rows;
    
    uv = vec2(
      frameX * frameWidth + vUv.x * frameWidth,
      frameY * frameHeight + vUv.y * frameHeight
    );
  }
  
  vec4 texColor = texture2D(map, uv);
  float a = texColor.a * vInstanceOpacity;
  vec3 finalColor = texColor.rgb * color * vInstanceColor;
  gl_FragColor = vec4(finalColor * a, a);
}
`;

const INSTANCED_SPRITE_FRAGMENT_STRAIGHT_ALPHA = `
uniform sampler2D map;
uniform vec3 color;
uniform vec2 u_SpritesheetSize; // x=cols, y=rows; (0,0) 表示不使用 spritesheet

varying vec2 vUv;
varying float vInstanceOpacity;
varying float vFrame;
varying vec3 vInstanceColor;

void main() {
  vec2 uv = vUv;
  if (u_SpritesheetSize.x > 0.0) {
    float cols = u_SpritesheetSize.x;
    float rows = u_SpritesheetSize.y;
    float frameIndex = floor(vFrame);
    float frameX = mod(frameIndex, cols);
    float rawFrameY = floor(frameIndex / cols);
    float frameY = rows - 1.0 - rawFrameY;
    float frameWidth = 1.0 / cols;
    float frameHeight = 1.0 / rows;
    uv = vec2(
      frameX * frameWidth + vUv.x * frameWidth,
      frameY * frameHeight + vUv.y * frameHeight
    );
  }
  vec4 texColor = texture2D(map, uv);
  texColor.rgb *= texColor.rgb;
  float a = texColor.a * vInstanceOpacity;
  vec3 finalColor = texColor.rgb * color * vInstanceColor;
  gl_FragColor = vec4(finalColor, a);
}
`;

/**
 * 创建支持 instanced rendering 的粒子材质
 * 使用自定义 ShaderMaterial 支持 per-instance opacity
 */
export function createInstancedSpriteMaterial(
  texture: ITexture,
  blendMode: BlendMode = BlendMode.Normal,
  color?: Color3,
  spritesheetSize?: [number, number]
): THREE.ShaderMaterial {
  const threeTexture = (texture as ThreeTexture).getNativeTexture();
  const isAdditive = blendMode === BlendMode.Additive;
  
  const mat = new THREE.ShaderMaterial({
    vertexShader: INSTANCED_SPRITE_VERTEX,
    fragmentShader: isAdditive ? INSTANCED_SPRITE_FRAGMENT_STRAIGHT_ALPHA : INSTANCED_SPRITE_FRAGMENT,
    uniforms: {
      map: { value: threeTexture },
      color: { value: new THREE.Color(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1) },
      u_SpritesheetSize: { value: new THREE.Vector2(
        spritesheetSize?.[0] ?? 0,
        spritesheetSize?.[1] ?? 0
      ) },
    },
    transparent: true,
    blending: toThreeBlending(blendMode),
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  // Additive 走 straight-alpha（srcAlpha, one），Normal 走 premultiplied-alpha（one, oneMinusSrcAlpha）。
  mat.premultipliedAlpha = !isAdditive;
  return mat;
}

// ==================== Rope Rendering (per-vertex rgba) ====================

const ROPE_VERTEX = `
varying vec2 vUv;
varying float vVertexAlpha;
varying vec3 vVertexColor;
attribute vec4 color; // per-vertex rgba stored in 'color' attribute (itemSize=4)

void main() {
  vUv = uv;
  vVertexColor = color.rgb;
  vVertexAlpha = color.a;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ROPE_FRAGMENT = `
uniform sampler2D map;
uniform vec3 u_Color;

varying vec2 vUv;
varying float vVertexAlpha;
varying vec3 vVertexColor;

void main() {
  vec4 texColor = texture2D(map, vUv);
  float a = texColor.a * vVertexAlpha;
  vec3 finalColor = texColor.rgb * u_Color * vVertexColor;
  // 预乘 alpha 输出
  gl_FragColor = vec4(finalColor * a, a);
}
`;

/**
 * 创建 rope 粒子专用材质（支持 per-vertex rgba）
 */
export function createRopeMaterial(
  texture: ITexture,
  color?: Color3,
): ThreeMaterial {
  return new ThreeMaterial({
    texture,
    transparent: true,
    blendMode: BlendMode.Normal,
    depthTest: false,
    depthWrite: false,
    vertexShader: ROPE_VERTEX,
    fragmentShader: ROPE_FRAGMENT,
    uniforms: {
      u_Color: color ? { r: color.r, g: color.g, b: color.b } : { r: 1, g: 1, b: 1 },
    },
  });
}

// ==================== Refraction Instanced Rendering ====================

/** 折射粒子顶点着色器: instanced sprite + 屏幕空间 UV */
const INSTANCED_REFRACTION_VERTEX = `
varying vec2 vUv;
varying float vInstanceOpacity;
varying float vFrame;
varying vec2 vScreenUv;

#ifdef USE_INSTANCING
  attribute float instanceOpacity;
  attribute float instanceFrame;
#endif

void main() {
  vUv = uv;

  #ifdef USE_INSTANCING
    vInstanceOpacity = instanceOpacity;
    vFrame = instanceFrame;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vInstanceOpacity = 1.0;
    vFrame = 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #endif
  
  // 从裁剪坐标计算屏幕空间 UV (0-1 范围)
  vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
}
`;

/** 折射粒子片段着色器: 法线贴图偏移屏幕UV → 场景折射 */
const INSTANCED_REFRACTION_FRAGMENT = `
uniform sampler2D map;
uniform sampler2D normalMap;
uniform sampler2D sceneTex;
uniform float refractAmount;
uniform vec3 color;
uniform vec2 u_SpritesheetSize;
uniform float u_ColorTexIsFlowMap;

varying vec2 vUv;
varying float vInstanceOpacity;
varying float vFrame;
varying vec2 vScreenUv;

void main() {
  vec2 uv = vUv;

  // Spritesheet UV: 映射到当前帧子区域
  if (u_SpritesheetSize.x > 0.0) {
    float cols = u_SpritesheetSize.x;
    float rows = u_SpritesheetSize.y;
    float frameIndex = floor(vFrame);
    float frameX = mod(frameIndex, cols);
    float frameY = rows - 1.0 - floor(frameIndex / cols);
    float fw = 1.0 / cols;
    float fh = 1.0 / rows;
    uv = vec2(frameX * fw + vUv.x * fw, frameY * fh + vUv.y * fh);
  }

  vec4 texColor = texture2D(map, uv);
  if (u_ColorTexIsFlowMap > 0.5) {
    // rg88 flow map: RG 存位移向量，避免将其作为灰色方块颜色/alpha 参与混合
    vec2 flow = texColor.rg * 2.0 - 1.0;
    float alpha = min(length(flow), 1.0) * vInstanceOpacity;
    if (alpha < 0.001) discard;

    vec2 offset = vec2(flow.x, -flow.y) * refractAmount;
    vec2 refUv = clamp(vScreenUv + offset, 0.0, 1.0);
    vec3 refracted = texture2D(sceneTex, refUv).rgb;
    gl_FragColor = vec4(refracted, alpha);
    return;
  }

  // DecompressNormalWithMask (RGBA8888): A→normalX, G→normalY, R→mask
  vec4 nRaw = texture2D(normalMap, uv);
  float nx = nRaw.a * 2.0 - 1.0;
  float ny = nRaw.g * 2.0 - 1.0;
  float mask = nRaw.r;

  vec4 pc = vec4(color, 1.0) * texColor;
  pc.a *= vInstanceOpacity;
  if (pc.a < 0.001) discard;

  // 与 WE 语义保持一致：mask 仅调制折射偏移，不直接裁剪最终输出 alpha。
  vec2 offset = vec2(nx, -ny) * refractAmount * mask * pc.a;
  vec2 refUv = clamp(vScreenUv + offset, 0.0, 1.0);
  pc.rgb *= texture2D(sceneTex, refUv).rgb;

  gl_FragColor = pc;
}
`;

const SHARED_REFRACTION_SCENE_PLACEHOLDER = new THREE.DataTexture(
  new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat,
);
SHARED_REFRACTION_SCENE_PLACEHOLDER.needsUpdate = true;

/** 创建折射粒子 instanced 材质（sceneTex 在渲染时由 copyFramebufferToTexture 填充） */
export function createInstancedRefractionMaterial(
  colorTexture: ITexture,
  normalMapTexture: ITexture,
  refractAmount: number,
  color?: Color3,
  spritesheetSize?: [number, number],
  isFlowMap = false,
  blending: THREE.Blending = THREE.NormalBlending,
): THREE.ShaderMaterial {
  const colorTex = (colorTexture as ThreeTexture).getNativeTexture();
  const normalTex = (normalMapTexture as ThreeTexture).getNativeTexture();

  return new THREE.ShaderMaterial({
    vertexShader: INSTANCED_REFRACTION_VERTEX,
    fragmentShader: INSTANCED_REFRACTION_FRAGMENT,
    uniforms: {
      map: { value: colorTex },
      normalMap: { value: normalTex },
      sceneTex: { value: SHARED_REFRACTION_SCENE_PLACEHOLDER },
      refractAmount: { value: refractAmount },
      color: { value: new THREE.Color(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1) },
      u_SpritesheetSize: { value: new THREE.Vector2(
        spritesheetSize?.[0] ?? 0, spritesheetSize?.[1] ?? 0
      ) },
      u_ColorTexIsFlowMap: { value: isFlowMap ? 1.0 : 0.0 },
    },
    transparent: true,
    blending,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: false,
  });
}
