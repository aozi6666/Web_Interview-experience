import { Engine } from 'moyu-engine';
import { FBORegistry } from 'moyu-engine/components/effects/FBORegistry';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from 'moyu-engine/components/scripting';
import { getWhite1x1Texture } from 'moyu-engine/rendering/EffectDefaults';
import { BlendMode } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import { TextureFilter, TextureWrap } from 'moyu-engine/rendering/interfaces/ITexture';
import { createEffectLayer } from 'moyu-engine/scenario/layers';
import type { SceneObject } from '../LoaderTypes';
import {
  computeSceneLayout,
  getScriptFieldValue, getWeLayerMetadata, isScriptField, logLoaderVerbose, parseMaterialBlendMode,
  parseOrigin, parseVector3FromString, resolveLayerParallaxDepth
} from '../LoaderUtils';
import { parsePkg } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import { loadWEEffectShaders } from '../shader/ShaderTranspiler';
import { loadAssetTexture, tryCreateTexture } from '../TextureLoader';
import { autoMapUniforms, logLightShaftsDebugInfo, resolveSystemUserTextureBindingName } from './EffectLoader';
import { buildEffectObjectMaterialLoadPaths } from './EffectMaterialPathResolver';

type PkgData = ReturnType<typeof parsePkg>;
const console = { ...globalThis.console, log: logLoaderVerbose };

export async function loadEffectObject(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  io?: ResourceIO,
): Promise<void> {
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  if (!obj.effects || obj.effects.length === 0) return;
  if (obj.shape?.toLowerCase() !== 'quad') return;
  // 检查对象自身的可见性（包括从父层通过 SceneHierarchyResolver 继承的 visible=false）
  const objVisible = obj.visible;
  if (objVisible === false
    || (typeof objVisible === 'object' && objVisible !== null && (objVisible as Record<string, unknown>).value === false)) {
    return;
  }
  if (engine.backend.getShaderLanguage() !== 'glsl_webgl') {
    console.warn(`后端着色器语言 ${engine.backend.getShaderLanguage()} 暂不支持 EffectObject 转译，跳过 ${obj.name || obj.id}`);
    return;
  }

  const effect = obj.effects.find(e => e.visible !== false && (typeof e.visible !== 'object' || e.visible.value !== false)) || obj.effects[0];
  if (!effect?.file) return;

  // 加载效果定义 JSON：先从 PKG/壁纸目录，再从 assets 目录
  const effectData = await resourceIO.loadJsonWithAssets<{ replacementkey?: string; passes?: Array<{ material?: string }> }>(effect.file);
  const effectKey = effectData?.replacementkey || effect.file;

  // 提取效果名称（如 "lightshafts"）
  let effectName: string;
  if (effectData?.replacementkey) {
    effectName = effectData.replacementkey;
  } else {
    const pathMatch = effectKey.match(/effects\/([^/]+)/);
    effectName = pathMatch ? pathMatch[1] : effectKey.replace(/^.*\//, '').replace(/\.json$/, '');
  }

  const pass = effect.passes?.[0];
  const values = pass?.constantshadervalues || {};
  const uniformScriptBindings: ScriptBindingConfig[] = [];
  const combos = pass?.combos || {};

  // shape: "quad" 表示独立绘制模式，设置 DIRECTDRAW=1。
  // BLENDMODE 需要始终有定义，否则 shader 中 ApplyBlending(BLENDMODE, ...) 会编译失败。
  // 这里固定为 0，避免此前 31(additive) 的过亮问题。
  const extraDefines: Record<string, number> = { DIRECTDRAW: 1, BLENDMODE: 0 };

  // 使用转译器加载原始 WE 着色器
  const shaders = await loadWEEffectShaders(effectName, combos as Record<string, number>, extraDefines);
  if (!shaders) {
    console.warn(`效果 ${effectName} 着色器加载失败，跳过`);
    return;
  }

  // 加载纹理：优先使用 pass 中指定的纹理，其次使用着色器默认路径
  const textures: Record<string, ITexture> = {};
  const dynamicTextureBinds: Array<{ uniformName: string; bindingName: string }> = [];
  const passTextures = pass?.textures || [];
  const passUserTextures = pass?.usertextures || [];

  const addDynamicTextureBind = (uniformName: string, bindingName: string): void => {
    if (!uniformName || !bindingName) return;
    if (dynamicTextureBinds.some((item) => item.uniformName === uniformName && item.bindingName === bindingName)) {
      return;
    }
    dynamicTextureBinds.push({ uniformName, bindingName });
  };

  const tryBindDynamicTexture = (uniformName: string, texturePath: string | null | undefined): ITexture | null => {
    if (typeof texturePath !== 'string' || !texturePath.startsWith('_rt_')) return null;
    const texture = FBORegistry.getGlobalTexture(texturePath);
    addDynamicTextureBind(uniformName, texturePath);
    return texture;
  };

  for (const [uniformName, defaultPath] of Object.entries(shaders.textureDefaults)) {
    const slotMatch = uniformName.match(/g_Texture(\d+)/);
    const slotIndex = slotMatch ? parseInt(slotMatch[1], 10) : -1;

    const userTexture = slotIndex >= 0 ? passUserTextures[slotIndex] : null;
    const userTextureBinding = (
      userTexture
      && typeof userTexture === 'object'
      && !Array.isArray(userTexture)
    )
      ? resolveSystemUserTextureBindingName(
        typeof userTexture.name === 'string' ? userTexture.name : undefined,
        typeof userTexture.type === 'string' ? userTexture.type : undefined,
      )
      : null;

    const overridePath = slotIndex >= 0 ? passTextures[slotIndex] : null;
    const texPath = userTextureBinding || overridePath || defaultPath;

    const dynamicTexture = tryBindDynamicTexture(uniformName, texPath);
    if (dynamicTexture) {
      textures[uniformName] = dynamicTexture;
      continue;
    }

    let texture: ITexture | null = await tryCreateTexture(engine, pkg, basePath, texPath);
    if (!texture) {
      texture = await loadAssetTexture(engine, texPath, {
        wrap: texPath.includes('noise') ? 'repeat' : undefined,
      });
    }

    if (texture) {
      if (texPath.includes('noise')) {
        texture.setWrap(TextureWrap.Repeat, TextureWrap.Repeat);
      }
      texture.setFilter(TextureFilter.Linear, TextureFilter.Linear);
      textures[uniformName] = texture;
    } else {
      textures[uniformName] = getWhite1x1Texture(engine.backend);
      console.warn(`效果纹理 ${uniformName} 加载失败 (${texPath})，使用 1x1 白色默认纹理`);
    }
  }

  // 使用着色器注释中的 "material" 映射自动解析 uniform
  const uniforms = autoMapUniforms(values, shaders.uniformDefaults);

  // shape: "quad" 效果对象是全屏后处理四边形，覆盖整个视口。
  const displayWidth = engine.width;
  const displayHeight = engine.height;
  const x = engine.width / 2;
  const y = engine.height / 2;
  const { coverScale, sceneOffset } = computeSceneLayout(engine.width, engine.height, sceneSize);

  const origin = parseOrigin(obj.origin) || [sceneSize.width / 2, sceneSize.height / 2];
  const rawScale = getScriptFieldValue(obj.scale);
  const scaleVec = parseVector3FromString(rawScale as string | undefined)
    || (Array.isArray(rawScale) ? rawScale as number[] : null);
  const objScaleX = scaleVec?.[0] ?? 1;
  const objScaleY = scaleVec?.[1] ?? 1;
  const rawAngles = getScriptFieldValue(obj.angles);
  const anglesVec = parseVector3FromString(rawAngles as string | undefined)
    || (Array.isArray(rawAngles) ? rawAngles as number[] : null);
  const angleZ = anglesVec?.[2] ?? 0;
  const cosA = Math.cos(angleZ);
  const sinA = Math.sin(angleZ);

  // 局部 UV -> 场景像素坐标（square UV：X/Y 都按 sceneWidth）
  // 旋转使用 CW 数学公式以补偿 viewport UV 的 Y-flip 方向反转。
  const perspectivePoints: Array<{ sceneX: number; sceneY: number }> = [];
  for (let i = 0; i < 4; i++) {
    const key = `g_Point${i}`;
    const val = uniforms[key];
    if (val && typeof val === 'object' && 'x' in val && 'y' in val) {
      const pos = val as { x: number; y: number };
      const du = (pos.x - 0.5) * sceneSize.width * objScaleX;
      const dv = (pos.y - 0.5) * sceneSize.width * objScaleY;
      const rdx = du * cosA + dv * sinA;
      const rdy = -du * sinA + dv * cosA;
      const sceneX = origin[0] + rdx;
      const sceneY = origin[1] + rdy;
      perspectivePoints.push({ sceneX, sceneY });
      const vu = (sceneX * coverScale - sceneOffset[0]) / engine.width;
      const vv = (sceneY * coverScale - sceneOffset[1]) / engine.height;
      uniforms[key] = { x: vu, y: 1.0 - vv };
    }
  }
  logLightShaftsDebugInfo({
    effectName,
    source: 'effectObject',
    layerName: obj.name,
    objectId: obj.id,
    combos: combos as Record<string, unknown>,
    uniforms,
  });
  const uniformDefaultsLower = new Map<string, { uniformName: string }>();
  for (const [materialKey, info] of Object.entries(shaders.uniformDefaults)) {
    uniformDefaultsLower.set(materialKey.toLowerCase(), { uniformName: info.uniformName });
  }
  for (const [materialKey, rawValue] of Object.entries(values)) {
    if (isScriptField(rawValue)) {
      const uniformName = shaders.uniformDefaults[materialKey]?.uniformName
        ?? uniformDefaultsLower.get(materialKey.toLowerCase())?.uniformName
        ?? materialKey;
      uniformScriptBindings.push({
        target: 'uniform',
        script: rawValue.script,
        scriptProperties: rawValue.scriptproperties ?? {},
        value: rawValue.value,
        uniformName,
      });
    }
  }

  // 添加纹理 uniform
  Object.assign(uniforms, textures);

  // 添加时间 uniform
  uniforms['g_Time'] = 0;

  // DIRECTDRAW shader 输出 (fxColor*intensity*fx, fx)——不是预乘 alpha。
  // premultipliedAlpha=false 使 Three.js 对 NormalBlending 用 (SRC_ALPHA, ONE_MINUS_SRC_ALPHA)，
  // 即 fxColor*intensity*fx² + bg*(1-fx)，匹配 WE 原生的 "blending":"normal" 行为。
  let blendMode = BlendMode.Additive;
  const premultipliedAlpha = false;
  const materialPath = effectData?.passes?.[0]?.material;
  if (materialPath) {
    const materialLoadPaths = buildEffectObjectMaterialLoadPaths(effect.file, materialPath);
    const matData = await resourceIO.loadJson<{ passes?: Array<{ blending?: string }> }>(
      materialLoadPaths.filePath,
      materialLoadPaths.fallbackPaths,
    );
    const matBlend = parseMaterialBlendMode(matData?.passes?.[0]?.blending);
    if (matBlend != null) {
      blendMode = matBlend;
    }
  }
  const layer = createEffectLayer({
    id: `effect-${obj.id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || 'Effect Layer',
    width: displayWidth,
    height: displayHeight,
    x,
    y,
    sourceSize: [sceneSize.width, sceneSize.height],
    sourceOrigin: [sceneSize.width / 2, sceneSize.height / 2],
    sourceScale: [1, 1, 1],
    sourceAngles: [0, 0, 0],
    coverScale,
    sceneOffset,
    parallaxDepth: resolveLayerParallaxDepth(obj as Record<string, unknown>),
    zIndex: (obj as Record<string, unknown>)._zIndex as number ?? obj.id ?? 0,
    vertexShader: shaders.vertexShader,
    fragmentShader: shaders.fragmentShader,
    blendMode,
    premultipliedAlpha,
    depthTest: false,
    depthWrite: false,
    uniforms,
    timeUniform: 'g_Time',
    dynamicTextureBinds: dynamicTextureBinds.length > 0 ? dynamicTextureBinds : undefined,
    perspectivePoints: perspectivePoints.length > 0 ? perspectivePoints : undefined,
    ...getWeLayerMetadata(obj),
  });
  if (uniformScriptBindings.length > 0) {
    layer.setScriptBindings(createScriptBindingsForLayer(layer, uniformScriptBindings));
  }

  if (/\bg_AudioSpectrum\w*\b/.test(`${shaders.vertexShader}\n${shaders.fragmentShader}`)) {
    engine.setAudioEnabled(true);
  }

  await engine.addLayer(layer);
}
