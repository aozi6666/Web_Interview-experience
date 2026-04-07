/**
 * Wallpaper Engine 粒子对象加载器
 *
 * 负责加载 scene.json 中的 particle 类型对象
 */

import { Engine } from 'moyu-engine';
import { createParticleLayer } from 'moyu-engine/scenario/layers';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from 'moyu-engine/components/scripting';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { ParticleOriginAnimationConfig } from 'moyu-engine/components/particle';
import type { Color3, Vec2Like, Vec3Like } from 'moyu-engine/math';
import { parsePkg } from "../PkgLoader";
import { parseParticleConfig, extractTexturePath, parseColorString, type WEParticleConfig } from "./ParticleConfigLoader";
import { resolveParticleConfigStage } from "./ParticleObjectStages";
import type { LoadResult, ProjectJson, SceneObject, SpritesheetMeta } from "../LoaderTypes";
import { logLoaderVerbose } from '../LoaderUtils';
import {
  getScriptFieldValue,
  getWeLayerMetadata,
  parseOrigin,
  parsePropertyColor,
  parseTimelineAnimation,
  resolveLayerParallaxDepth,
  resolveScriptPropertyUserValues,
  resolveUserProperty,
  toScriptBindingConfig,
} from "../LoaderUtils";
import {
  loadAssetTexJson,
  loadAssetTexture,
  loadJsonFile,
  tryLoadParticleTexture,
  tryLoadTexture,
} from "../TextureLoader";

type PkgData = ReturnType<typeof parsePkg>;
const console = { ...globalThis.console, log: logLoaderVerbose };

function collectParticleScriptBindings(obj: SceneObject, projectJson?: ProjectJson | null): ScriptBindingConfig[] {
  const bindings: ScriptBindingConfig[] = [];
  const candidates = [
    toScriptBindingConfig('origin', obj.origin),
    toScriptBindingConfig('scale', obj.scale),
    toScriptBindingConfig('color', obj.color),
    toScriptBindingConfig('alpha', obj.alpha),
    toScriptBindingConfig('visible', obj.visible),
  ];
  for (const item of candidates) {
    if (item) {
      if (projectJson && item.scriptProperties) {
        resolveScriptPropertyUserValues(item.scriptProperties, projectJson);
      }
      bindings.push(item);
    }
  }
  return bindings;
}

function parseParticleOriginAnimation(
  rawOrigin: SceneObject["origin"] | undefined,
  fallback: Vec2Like,
): ParticleOriginAnimationConfig | undefined {
  if (!rawOrigin || typeof rawOrigin !== "object" || Array.isArray(rawOrigin)) return undefined;
  const originObj = rawOrigin as unknown as Record<string, unknown>;
  const rawAnimation = originObj.animation;
  if (!rawAnimation || typeof rawAnimation !== "object") return undefined;
  const baseOrigin = parseOrigin(rawOrigin) ?? [fallback.x, fallback.y];
  const parsedAnimation = parseTimelineAnimation(rawAnimation, [baseOrigin[0], baseOrigin[1], 0]);
  if (!parsedAnimation) {
    return undefined;
  }
  const xTrackRaw = parsedAnimation.tracks[0] ?? [];
  const yTrackRaw = parsedAnimation.tracks[1] ?? [];
  const xTrack = xTrackRaw.map((k) => ({
    frame: k.frame,
    value: k.value,
    back: { x: k.back.x, y: k.back.y },
    front: { x: k.front.x, y: k.front.y },
  }));
  const yTrack = yTrackRaw.map((k) => ({
    frame: k.frame,
    value: k.value,
    back: { x: k.back.x, y: k.back.y },
    front: { x: k.front.x, y: k.front.y },
  }));
  if (xTrack.length === 0 || yTrack.length === 0) return undefined;

  const mode = parsedAnimation.mode === "single" ? "single" : parsedAnimation.mode;
  return {
    duration: parsedAnimation.lengthFrames / parsedAnimation.fps,
    lengthFrames: parsedAnimation.lengthFrames,
    mode,
    x: xTrack,
    y: yTrack,
  };
}

function applyParentOriginTimelineBinding(
  layer: ReturnType<typeof createParticleLayer>,
  obj: SceneObject,
  baseOrigin: [number, number],
  hasOriginScriptBinding: boolean,
): void {
  if (hasOriginScriptBinding) return;
  const rawParentAnim = (obj as unknown as Record<string, unknown>)._parentOriginAnimation;
  if (!rawParentAnim || typeof rawParentAnim !== 'object') return;
  const parsed = parseTimelineAnimation(rawParentAnim, [baseOrigin[0], baseOrigin[1], 0]);
  if (!parsed) return;
  layer.addTimelinePropertyBinding({
    target: 'origin',
    animation: parsed.animation,
  });
}

function bindParticleTimelineAndScript(
  layer: ReturnType<typeof createParticleLayer>,
  obj: SceneObject,
  projectJson: ProjectJson | null | undefined,
  layerOriginBase: [number, number],
): void {
  const scriptBindings = collectParticleScriptBindings(obj, projectJson);
  const hasOriginScriptBinding = scriptBindings.some((binding) => binding.target === 'origin');
  if (scriptBindings.length > 0) {
    layer.setScriptBindings(createScriptBindingsForLayer(layer, scriptBindings));
  }
  applyParentOriginTimelineBinding(layer, obj, layerOriginBase, hasOriginScriptBinding);
}

function readParticleMultiplier(
  parsedConfig: ReturnType<typeof parseParticleConfig>,
  key: 'speedMultiplier' | 'sizeMultiplier' | 'alphaMultiplier',
  fallback: number,
): number {
  const value = (parsedConfig as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : fallback;
}

export async function loadParticleObject(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  result: LoadResult,
  projectJson?: ProjectJson | null
): Promise<void> {
  if (!obj.particle) return;

  // visible=false 的粒子仍然加载但不发射，脚本可在运行时切换可见性。
  const isVisible = resolveUserProperty(getScriptFieldValue(obj.visible), projectJson) !== false;
  
  const resolvedStage = await resolveParticleConfigStage(pkg, obj, basePath, projectJson);
  if (!resolvedStage) return;
  let parsedConfig = resolvedStage.parsedConfig;
  const controlPointOverrides = resolvedStage.controlPointOverrides;
  const controlPointAnimations = resolvedStage.controlPointAnimations;
  let instanceBrightnessMultiplier = resolvedStage.instanceBrightnessMultiplier;
  const instanceOverride = resolvedStage.instanceOverride;
  
  // 使用与背景图层相同的 cover 缩放策略，确保粒子位置与背景对齐
  const viewportScale = {
    x: engine.width / sceneSize.width,
    y: engine.height / sceneSize.height,
  };
  const coverScale = Math.max(viewportScale.x, viewportScale.y);
  const scale = Math.min(viewportScale.x, viewportScale.y);
  
  // cover 策略下，背景图会溢出视口，居中裁剪，产生偏移量
  const bgDisplayWidth = sceneSize.width * coverScale;
  const bgDisplayHeight = sceneSize.height * coverScale;
  const sceneOffset = {
    x: (bgDisplayWidth - engine.width) / 2,
    y: (bgDisplayHeight - engine.height) / 2,
  };
  
  // 解析 origin（场景坐标系中的位置）
  const originValue = getScriptFieldValue(obj.origin);
  const origin = parseOrigin(originValue);
  const layerOriginBase: [number, number] = origin
    ? [origin[0], origin[1]]
    : [sceneSize.width / 2, sceneSize.height / 2];
  const originAnimation = parseParticleOriginAnimation(
    originValue,
    {
      x: origin?.[0] ?? sceneSize.width / 2,
      y: origin?.[1] ?? sceneSize.height / 2,
    },
  );

  // 解析 scale（对象缩放，影响发射区域和速度方向）
  // 负数 scale 表示镜像翻转：需要翻转对应轴的速度方向
  // 保存原始 scale 值用于渲染模型矩阵 (C++: model = translate * rotate * scale)
  let objScale: Vec2Like = { x: 1, y: 1 };
  let scaleSign: Vec2Like = { x: 1, y: 1 };
  let rawScale: Vec2Like = { x: 1, y: 1 };
  const rawScaleValue = getScriptFieldValue(obj.scale);
  if (rawScaleValue) {
    const scaleVec = typeof rawScaleValue === 'string' 
      ? rawScaleValue.split(/\s+/).map(Number) 
      : Array.isArray(rawScaleValue) ? rawScaleValue : [];
    if (scaleVec.length >= 2) {
      rawScale = { x: scaleVec[0], y: scaleVec[1] };
      scaleSign = { x: scaleVec[0] < 0 ? -1 : 1, y: scaleVec[1] < 0 ? -1 : 1 };
      objScale = { x: Math.abs(scaleVec[0]), y: Math.abs(scaleVec[1]) };
    }
  }
  
  // 解析 angles（对象旋转，Z轴旋转影响发射方向和渲染变换）
  // WE 原版存储的是弧度值: -0.192 rad = -11° (可见的轻微倾斜)
  // C++ Linux 版 glm::radians() 是错误的双重转换 → -0.192° ≈ 0 → 导致退化
  let emitAngle = 0;
  let rawAngleZ = 0; // 原始弧度值
  if (obj.angles) {
    const anglesVec = typeof obj.angles === 'string'
      ? obj.angles.split(/\s+/).map(Number)
      : Array.isArray(obj.angles) ? obj.angles : [];
    if (anglesVec.length >= 3) {
      rawAngleZ = anglesVec[2]; // 原始 Z 轴旋转（弧度）
      emitAngle = anglesVec[2]; // 直接使用弧度值
    }
  }
  
  // 计算发射区域（从粒子配置的 emitArea 和对象的 scale 综合计算）
  // parsedConfig.emitArea 已经是全宽度 (distancemax * 2)，直接使用
  // ParticleLayer 中 (random-0.5)*emitWidth 产生 [-emitWidth/2, +emitWidth/2] 范围
  const baseEmitW = parsedConfig.emitArea.width;
  const baseEmitH = parsedConfig.emitArea.height;
  const emitW = baseEmitW * Math.abs(objScale.x);
  const emitH = baseEmitH * Math.abs(objScale.y);
  
  // 计算发射中心：(对象origin + modelMatrix * emitterOrigin) → cover缩放 → 减去裁剪偏移
  // 关键：emitterOrigin 在 C++ 中位于对象局部空间，需要先经过 rotateZ * scale 变换。
  // 否则在非单位 scale/angle 的粒子（如 Light shafts）会出现中心偏移。
  const emitterLocal = { x: parsedConfig.emitterOrigin.x, y: parsedConfig.emitterOrigin.y };
  const cosAngle = Math.cos(rawAngleZ);
  const sinAngle = Math.sin(rawAngleZ);
  const emitterOffset = {
    x: (rawScale.x * cosAngle) * emitterLocal.x + (-rawScale.y * sinAngle) * emitterLocal.y,
    y: (rawScale.x * sinAngle) * emitterLocal.x + (rawScale.y * cosAngle) * emitterLocal.y,
  };
  const emitCenter = origin
    ? { x: origin[0] + emitterOffset.x, y: origin[1] + emitterOffset.y }
    : { x: sceneSize.width / 2, y: sceneSize.height / 2 };
  
  // ===== 通用渲染位置变换 (model matrix: translate * rotateZ * scale) =====
  // C++ 中粒子在局部空间运动，渲染时通过 model matrix 变换到屏幕空间。
  // 我们用 position transform 实现：变换粒子中心位置，精灵在屏幕空间展开(billboard)。
  //
  // 通用公式 (适用于所有壁纸，不做特殊分支):
  //   renderScale.x = rawScale.x !== 0 ? rawScale.x : 1  —— 保留镜像符号，0 时回退为 1
  //   renderScale.y = rawScale.y !== 0 ? rawScale.y : 1  —— 保留镜像符号，0 时回退为 1
  //   renderAngle  = rawAngleZ              —— 弧度，直接使用
  //
  // 零值处理: C++ 中 scaleX=0 使 model matrix 退化 → billboard 零面积不可见。
  // 我们的屏幕空间 billboard 方案不受 model matrix 影响，scaleX=0 时用 1 替代，
  // 让发射/力场/湍流的 X 分量保持可见，产生自然的光带宽度。
  const renderScale = {
    x: rawScale.x !== 0 ? rawScale.x : 1,
    y: rawScale.y !== 0 ? rawScale.y : 1,
  };
  const renderAngle = rawAngleZ;   // 弧度，直接使用

  // controlpointN: 绝对场景坐标 -> 局部偏移（inverse(model) = inverse(scale) * inverse(rotateZ)）
  if (controlPointOverrides.length > 0) {
    if (!parsedConfig.controlPoints) {
      parsedConfig.controlPoints = [];
    }
    const originPos = { x: origin?.[0] ?? 0, y: origin?.[1] ?? 0 };
    const cosNeg = Math.cos(-rawAngleZ);
    const sinNeg = Math.sin(-rawAngleZ);
    const invSx = renderScale.x > 1e-6 ? 1 / renderScale.x : 1;
    const invSy = renderScale.y > 1e-6 ? 1 / renderScale.y : 1;
    for (const cpOverride of controlPointOverrides) {
      const dx = cpOverride.absolute[0] - originPos.x;
      const dy = cpOverride.absolute[1] - originPos.y;
      const rotDx = cosNeg * dx - sinNeg * dy;
      const rotDy = sinNeg * dx + cosNeg * dy;
      const localOffset = {
        x: rotDx * invSx,
        y: rotDy * invSy,
        z: cpOverride.absolute[2],
      };
      const current = parsedConfig.controlPoints[cpOverride.id];
      if (current) {
        current.offset = localOffset;
        current.worldSpace = false;
      } else {
        parsedConfig.controlPoints[cpOverride.id] = {
          id: cpOverride.id,
          offset: localOffset,
          linkMouse: false,
          worldSpace: false,
        };
      }
    }
  }

  console.log(`粒子[${obj.name}]: emitCenter=(${emitCenter.x.toFixed(0)}, ${emitCenter.y.toFixed(0)}), scale=(${renderScale.x.toFixed(2)}, ${renderScale.y.toFixed(2)}), angle=${(rawAngleZ * 180 / Math.PI).toFixed(1)}°`);
  
  // 加载纹理与材质参数
  let textureSource: string | ITexture | undefined;
  let particleBlendMode: 'normal' | 'additive' = 'additive';
  let spritesheetMeta: SpritesheetMeta | undefined;
  let isRefract = false;
  let refractAmount = 0.04;
  let normalMapSource: ITexture | string | undefined;
  let colorTexIsFlowMap = false;
  let overbright = 1.0;
  const particleTextureLoadOptions = {
    alphaFromRed: true,
    alphaFromGreen: true,
    alphaMode: 'fromBrightness',
  } as const;
  
  if (parsedConfig.materialPath) {
    const materialData = await loadJsonFile<{ passes?: Array<{ textures?: string[]; blending?: string; combos?: Record<string, number>; constantshadervalues?: Record<string, unknown> }> }>(
      pkg,
      parsedConfig.materialPath,
      basePath
    );
    if (materialData) {
      // 检测折射粒子 (REFRACT: 1)
      const combos = materialData.passes?.[0]?.combos;
      if (combos && combos['REFRACT'] === 1) {
        isRefract = true;
        // 提取折射强度
        const csv = materialData.passes?.[0]?.constantshadervalues;
        if (csv && typeof csv['ui_editor_properties_refract_amount'] === 'number') {
          refractAmount = csv['ui_editor_properties_refract_amount'] as number;
        }
        // 加载折射法线贴图: 材质 textures[1] → 回退 particle/drop_normal
        const normalMapPath = materialData.passes?.[0]?.textures?.[1];
        if (normalMapPath) {
          const nmUrl = await tryLoadTexture(pkg, basePath, normalMapPath, {});
          if (nmUrl) normalMapSource = nmUrl;
        }
        if (!normalMapSource) {
          const dropNormal = await loadAssetTexture(engine, 'particle/drop_normal', {});
          if (dropNormal) {
            normalMapSource = dropNormal;
          } else {
            console.warn(`粒子[${obj.name}]: 折射法线贴图未找到`);
          }
        }
      }
      
      // 提取 overbright 亮度倍增 (C++: ui_editor_properties_overbright)
      const csv = materialData.passes?.[0]?.constantshadervalues;
      if (csv) {
        const ob = csv['ui_editor_properties_overbright'] ?? csv['overbright'];
        if (typeof ob === 'number' && ob > 0) {
          overbright = ob;
        }
      }
      
      const texturePath = extractTexturePath(materialData);
      if (texturePath) {
        // 使用 tryLoadParticleTexture 以获取 spritesheet 元数据
        const texResult = await tryLoadParticleTexture(pkg, basePath, texturePath, particleTextureLoadOptions);
        if (texResult) {
          textureSource = texResult.url;
          spritesheetMeta = texResult.spritesheet;
          if (!spritesheetMeta) {
            spritesheetMeta = await loadAssetTexJson(texturePath);
          }
          colorTexIsFlowMap = isRefract && texResult.channels === 2;
          if (!spritesheetMeta) {
            console.log(`[particle spritesheet] missing: obj=${obj.name}, texture=${texturePath}, source=tryLoadParticleTexture`);
          }
        } else {
          // 从 assets 目录加载粒子纹理
          const assetTex = await loadAssetTexture(engine, texturePath, particleTextureLoadOptions);
          if (assetTex) {
            textureSource = assetTex;
            // 同时尝试从 .tex-json 获取 spritesheet 元数据
            spritesheetMeta = await loadAssetTexJson(texturePath);
            console.log(`粒子纹理从 assets 加载: ${texturePath}` + (spritesheetMeta ? ` (spritesheet ${spritesheetMeta.cols}x${spritesheetMeta.rows}, ${spritesheetMeta.frames} frames)` : ''));
            if (!spritesheetMeta) {
              console.log(`[particle spritesheet] missing: obj=${obj.name}, texture=${texturePath}, source=loadAssetTexture`);
            }
          } else {
            console.warn(`粒子纹理未找到: ${texturePath}`);
          }
        }
      }
      const blending = materialData.passes?.[0]?.blending?.toLowerCase();
      if (blending) {
        if (blending.includes('add')) {
          particleBlendMode = 'additive';
        } else if (blending.includes('translucent') || blending.includes('normal')) {
          particleBlendMode = 'normal';
        }
      }
    }
  }
  if (instanceBrightnessMultiplier !== 1.0) {
    overbright *= instanceBrightnessMultiplier;
  }
  if (particleBlendMode === 'additive' && (overbright > 1.0 || overbright < 1.0)) {
    console.log(`粒子[${obj.name}]: additive 混合, overbright=${overbright.toFixed(3)} (可能影响亮度累积)`);
  }

  // 解析材质颜色乘数（u_Color）
  // 注意：逐粒子 colorrandom 已在 ParticleLayer 中通过 per-particle color 生效。
  // 这里若再乘 avg(colorrandom) 会导致 colorrandom 被应用两次，从而整体偏暗。
  let color: Color3 | undefined;

  // 从 instanceoverride.colorn 提取颜色乘数
  // colorn 可能是字符串 "r g b" 或对象 { user: "...", value: "r g b" }
  // C++ 流程: colorn 有 "user" 字段时 → 查找 project.json 属性 → 连接到 Property 对象
  // 若找不到属性 → 使用 colorn.value 回退值
  let colornMultiplier: Color3 | null = null;
  if (obj.instanceoverride?.colorn) {
    const colornRaw = obj.instanceoverride.colorn;
    
    if (typeof colornRaw === 'string') {
      // 简单字符串 "r g b"，直接解析
      colornMultiplier = parseColorString(colornRaw);
    } else if (typeof colornRaw === 'object' && colornRaw !== null) {
      const colornObj = colornRaw as { user?: string; value?: string };
      
      // 优先从 project.json 属性系统解析
      if (colornObj.user && projectJson?.general?.properties) {
        const prop = projectJson.general.properties[colornObj.user];
        if (prop && typeof prop.value === 'string') {
          colornMultiplier = parsePropertyColor(prop.value);
          if (colornMultiplier) {
            console.log(`粒子[${obj.name}] colorn 属性 "${colornObj.user}" 从 project.json 解析: (${colornMultiplier.r.toFixed(4)},${colornMultiplier.g.toFixed(4)},${colornMultiplier.b.toFixed(4)})`);
          }
        }
      }
      
      // 回退: 使用 instanceoverride.colorn.value
      if (!colornMultiplier && colornObj.value) {
        colornMultiplier = parseColorString(colornObj.value);
      }
    }
  }

  if (colornMultiplier) {
    // u_Color 仅承载 instanceoverride.colorn；colorrandom 由逐粒子颜色处理
    color = colornMultiplier;
  }
  
  // 检查鼠标拖尾
  const objName = (obj.name || '').toLowerCase();
  const isMouseTrail = objName.includes('trail') || objName.includes('mouse');
  
  // 速度范围直接使用粒子配置值，不再受对象 scale 符号翻转影响。
  // 通用规则：对象镜像(scale<0)只影响渲染空间，不应反向粒子物理速度。
  // 这样可避免像 Snow particles 这类“配置本身上升，但因对象负缩放被反向”的问题。
  let velocityMin: Vec3Like | undefined;
  let velocityMax: Vec3Like | undefined;
  const emitterVelocityMin = parsedConfig.emitter.velocityMin;
  const emitterVelocityMax = parsedConfig.emitter.velocityMax;
  if (emitterVelocityMin && emitterVelocityMax) {
    velocityMin = {
      x: Math.min(emitterVelocityMin.x, emitterVelocityMax.x),
      y: Math.min(emitterVelocityMin.y, emitterVelocityMax.y),
      z: Math.min(emitterVelocityMin.z, emitterVelocityMax.z),
    };
    velocityMax = {
      x: Math.max(emitterVelocityMin.x, emitterVelocityMax.x),
      y: Math.max(emitterVelocityMin.y, emitterVelocityMax.y),
      z: Math.max(emitterVelocityMin.z, emitterVelocityMax.z),
    };
  }
  
  const emitterConfig = {
    ...parsedConfig.emitter,
    instantaneous: parsedConfig.emitter.instantaneous,
    // C++: size 直接使用 JSON 值 × instanceOverride.size，仅需 coverScale 映射
    size: parsedConfig.emitter.size ?? 20,
    sizeRandom: parsedConfig.emitter.sizeRandom || 0,
    speed: parsedConfig.emitter.speed ?? 0,
    speedRandom: parsedConfig.emitter.speedRandom || 0,
    velocityMin,
    velocityMax,
    // 物理参数
    drag: parsedConfig.drag,
    gravity: parsedConfig.emitter.gravity ?? { x: 0, y: 0, z: 0 },
    attractStrength: parsedConfig.attractStrength,
    attractThreshold: parsedConfig.attractThreshold || 0,
    initialSpeedMin: parsedConfig.initialSpeedMin || 0,
    initialSpeedMax: parsedConfig.initialSpeedMax || 0,
    initVelNoiseScale: parsedConfig.initVelNoiseScale,
    initVelTimeScale: parsedConfig.initVelTimeScale,
    turbulentForward: {
      x: parsedConfig.turbulentForward?.x ?? 0,
      y: parsedConfig.turbulentForward?.y ?? 0,
    },
    // 湍流参数缩放
    turbulence: parsedConfig.turbulenceSpeed || 0,
    turbulenceSpeedMin: parsedConfig.emitter.turbulenceSpeedMin || 0,
    turbulenceSpeedMax: parsedConfig.emitter.turbulenceSpeedMax || 0,
    turbulenceTimeScale: parsedConfig.emitter.turbulenceTimeScale,
    turbulenceScale: parsedConfig.emitter.turbulenceScale,
    sizeChange: parsedConfig.sizeChange,
    colorChange: parsedConfig.colorChange,
    colorMin: parsedConfig.colorMin,
    colorMax: parsedConfig.colorMax,
    colorExponent: parsedConfig.colorExponent,
  };
  
  // (DEBUG) 粒子详细参数 — 仅在需要时取消注释
  // console.log(`粒子[${obj.name}] emitter: drag=${emitterConfig.drag}, vel=[${emitterConfig.velocityMin?.x?.toFixed(0)},${emitterConfig.velocityMax?.x?.toFixed(0)}]x[${emitterConfig.velocityMin?.y?.toFixed(0)},${emitterConfig.velocityMax?.y?.toFixed(0)}]`);
  // console.log(`粒子[${obj.name}] emitArea=${emitW.toFixed(0)}x${emitH.toFixed(0)}, renderer=${parsedConfig.rendererType}`);
  
  const layer = createParticleLayer({
    id: `particle-${obj.id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || 'Particle Layer',
    texture: textureSource,
    width: engine.width,
    height: engine.height,
    x: engine.width / 2,
    y: engine.height / 2,
    sourceSize: [sceneSize.width, sceneSize.height],
    sourceOrigin: layerOriginBase,
    sourceScale: [rawScale.x, rawScale.y, 1],
    sourceAngles: [0, 0, rawAngleZ],
    sceneOffset: [sceneOffset.x, sceneOffset.y],
    parallaxDepth: resolveLayerParallaxDepth(obj as Record<string, unknown>),
    zIndex: (obj as Record<string, unknown>)._zIndex as number ?? obj.id ?? 0,
    emitWidth: emitW,
    emitHeight: emitH,
    emitCenter: { x: emitCenter.x, y: emitCenter.y },
    emitterOrigin: [emitterLocal.x, emitterLocal.y],
    originAnimation,
    // C++ 中发射在局部空间（无旋转），旋转通过 model matrix (renderAngle) 渲染时应用
    emitAngle: 0,
    emitter: emitterConfig,
    maxParticles: parsedConfig.maxCount,
    blendMode: particleBlendMode,
    oscillate: parsedConfig.oscillate,
    oscillateFrequency: parsedConfig.oscillateFrequency,
    oscillateScaleMin: parsedConfig.oscillateScaleMin,
    // per-particle oscillate operators
    oscillateAlpha: parsedConfig.oscillateAlpha,
    oscillateSize: parsedConfig.oscillateSize,
    oscillatePosition: parsedConfig.oscillatePosition ? {
      ...parsedConfig.oscillatePosition,
      scaleMin: parsedConfig.oscillatePosition.scaleMin || 0,
      scaleMax: parsedConfig.oscillatePosition.scaleMax,
    } : undefined,
    color,
    followMouse: isMouseTrail,
    rendererType: parsedConfig.rendererType,
    subdivision: parsedConfig.subdivision,
    sequenceMultiplier: parsedConfig.sequenceMultiplier,
    animationMode: parsedConfig.animationMode,
    // spritesheet 数据（来自 TEX 文件的 TEXS 动画帧）
    spritesheetCols: spritesheetMeta?.cols,
    spritesheetRows: spritesheetMeta?.rows,
    spritesheetFrames: spritesheetMeta?.frames,
    spritesheetDuration: spritesheetMeta?.duration,
    // 新增：控制点和操作符
    controlPoints: parsedConfig.controlPoints?.map((cp) => ({
      ...cp,
      offset: {
        x: cp.offset.x,
        y: cp.offset.y,
        z: cp.offset.z,
      },
    })),
    controlPointAnimations,
    mapSequenceBetweenCP: parsedConfig.mapSequenceBetweenCP,
    mapSequenceAroundCP: parsedConfig.mapSequenceAroundCP ? {
      ...parsedConfig.mapSequenceAroundCP,
      speedMin: {
        x: parsedConfig.mapSequenceAroundCP.speedMin.x,
        y: parsedConfig.mapSequenceAroundCP.speedMin.y,
        z: parsedConfig.mapSequenceAroundCP.speedMin.z,
      },
      speedMax: {
        x: parsedConfig.mapSequenceAroundCP.speedMax.x,
        y: parsedConfig.mapSequenceAroundCP.speedMax.y,
        z: parsedConfig.mapSequenceAroundCP.speedMax.z,
      },
    } : undefined,
    vortex: parsedConfig.vortex ? {
      ...parsedConfig.vortex,
      distanceInner: parsedConfig.vortex.distanceInner,
      distanceOuter: parsedConfig.vortex.distanceOuter,
      speedInner: parsedConfig.vortex.speedInner,
      speedOuter: parsedConfig.vortex.speedOuter,
      offset: {
        x: parsedConfig.vortex.offset.x,
        y: parsedConfig.vortex.offset.y,
        z: parsedConfig.vortex.offset.z,
      },
    } : undefined,
    controlPointAttracts: parsedConfig.controlPointAttractConfigs?.map((cpAttract) => ({
      ...cpAttract,
      scale: cpAttract.scale,
      threshold: cpAttract.threshold,
      origin: {
        x: cpAttract.origin.x,
        y: cpAttract.origin.y,
        z: cpAttract.origin.z,
      },
    })),
    angularMovement: parsedConfig.angularMovement,
    trailLength: parsedConfig.trailLength,
    trailMinLength: parsedConfig.trailMinLength,
    trailMaxLength: parsedConfig.trailMaxLength,
    uvScrolling: parsedConfig.uvScrolling,
    // instanceOverride 乘数（C++: speed/size 是乘法因子，不是替换值）
    speedMultiplier: readParticleMultiplier(parsedConfig, 'speedMultiplier', 1.0),
    sizeMultiplier: readParticleMultiplier(parsedConfig, 'sizeMultiplier', 1.0),
    alphaMultiplier: readParticleMultiplier(parsedConfig, 'alphaMultiplier', 1.0),
    // 球形发射器半径（局部坐标 → 屏幕坐标，不预乘 obj.scale）
    // C++: 粒子在局部空间发射(球面 r=distanceMin)，model matrix 在渲染时变换
    // obj.scale 的形状效果通过 renderScale/renderAngle（位置变换）在渲染时实现
    emitterRadius: parsedConfig.emitterRadius,
    emitterInnerRadius: parsedConfig.emitterInnerRadius,
    // C++ 初始化器/操作符: alphaRandom, rotationRandom, angularVelocityRandom, alphaChange
    alphaMin: parsedConfig.alphaMin,
    alphaMax: parsedConfig.alphaMax,
    alphaExponent: parsedConfig.alphaExponent,
    rotationMin: parsedConfig.rotationMin,
    rotationMax: parsedConfig.rotationMax,
    rotationExponent: parsedConfig.rotationExponent,
    angVelMin: parsedConfig.angVelMin,
    angVelMax: parsedConfig.angVelMax,
    angVelExponent: parsedConfig.angVelExponent,
    alphaChange: parsedConfig.alphaChange,
    spherical: parsedConfig.spherical,
    // 位置变换 = C++ model matrix: rotateZ(angle) * scale(sx, sy)
    // 变换粒子中心位置，精灵在屏幕空间展开（billboard）保持可见
    renderScale: { x: renderScale.x, y: renderScale.y },
    renderAngle: renderAngle,
    // 通用数值体系: coverScale 用于噪声空间转换 (display_px → scene_px)
    coverScale,
    // 折射粒子 (REFRACT: 1)
    refract: isRefract,
    refractAmount: refractAmount,
    normalMapTexture: normalMapSource,
    colorTexIsFlowMap,
    // 材质 overbright 亮度倍增 (C++: ui_editor_properties_overbright)
    overbright,
    startTime: parsedConfig.startTime,
    capVelocityMax: parsedConfig.capVelocityMax,
    collision: parsedConfig.collision,
    colorList: parsedConfig.colorList,
    positionOffsetRandom: parsedConfig.positionOffsetRandom,
    oscillatePhaseMin: parsedConfig.oscillatePhaseMin,
    oscillatePhaseMax: parsedConfig.oscillatePhaseMax,
    ...getWeLayerMetadata(obj),
  });
  bindParticleTimelineAndScript(layer, obj, projectJson, layerOriginBase);
  
  await engine.addLayer(layer);
  if (!isVisible) {
    layer.visible = false;
  }
  
  // 加载 eventfollow 子粒子（例如 shootingstar -> shootingstarglow）
  if (parsedConfig.children && parsedConfig.children.length > 0) {
    for (let childIndex = 0; childIndex < parsedConfig.children.length; childIndex++) {
      const child = parsedConfig.children[childIndex];
      const childType = child.type.toLowerCase();
      if (!['eventfollow', 'eventspawn', 'eventdeath', 'static'].includes(childType)) continue;
      const childRawConfig = await loadJsonFile<WEParticleConfig>(pkg, child.name, basePath);
      if (!childRawConfig) continue;
      const childParsed = parseParticleConfig(childRawConfig);

      // C++ 中 instanceoverride 也会影响子粒子系统（lifetime/speed/size/alpha），rate/count 除外
      let childSpeedMult = 1.0;
      let childSizeMult = 1.0;
      let childAlphaMult = 1.0;
      if (instanceOverride) {
        if (instanceOverride.lifetime !== undefined && !childParsed.disableOverrides?.lifetime) {
          const mult = instanceOverride.lifetime;
          childParsed.emitter.lifetime = (childParsed.emitter.lifetime ?? 5) * mult;
          if (childParsed.emitter.lifetimeRandom) {
            childParsed.emitter.lifetimeRandom *= mult;
          }
        }
        if (instanceOverride.speed !== undefined && !childParsed.disableOverrides?.speed) {
          childSpeedMult = instanceOverride.speed;
        }
        if (instanceOverride.size !== undefined && !childParsed.disableOverrides?.size) {
          childSizeMult = instanceOverride.size;
        }
        if (instanceOverride.alpha !== undefined) {
          childAlphaMult = instanceOverride.alpha;
        }
      }
      
      // 子粒子材质/纹理
      let childTextureSource: string | ITexture | undefined;
      let childBlendMode: 'normal' | 'additive' = 'additive';
      let childSpritesheetMeta: SpritesheetMeta | undefined;
      let childIsRefract = false;
      let childRefractAmount = 0.04;
      let childNormalMapSource: ITexture | string | undefined;
      let childColorTexIsFlowMap = false;
      let childOverbright = 1.0;
      if (childParsed.materialPath) {
        const childMaterialData = await loadJsonFile<{ passes?: Array<{ textures?: string[]; blending?: string; combos?: Record<string, number>; constantshadervalues?: Record<string, unknown> }> }>(
          pkg,
          childParsed.materialPath,
          basePath
        );
        if (childMaterialData) {
          const childCombos = childMaterialData.passes?.[0]?.combos;
          if (childCombos && childCombos['REFRACT'] === 1) {
            childIsRefract = true;
            const childCsv = childMaterialData.passes?.[0]?.constantshadervalues;
            if (childCsv && typeof childCsv['ui_editor_properties_refract_amount'] === 'number') {
              childRefractAmount = childCsv['ui_editor_properties_refract_amount'] as number;
            }
            const childNormalMapPath = childMaterialData.passes?.[0]?.textures?.[1];
            if (childNormalMapPath) {
              const nmUrl = await tryLoadTexture(pkg, basePath, childNormalMapPath, {});
              if (nmUrl) childNormalMapSource = nmUrl;
            }
            if (!childNormalMapSource) {
              const dropNormal = await loadAssetTexture(engine, 'particle/drop_normal', {});
              if (dropNormal) childNormalMapSource = dropNormal;
            }
          }
          const childCsv = childMaterialData.passes?.[0]?.constantshadervalues;
          if (childCsv) {
            const ob = childCsv['ui_editor_properties_overbright'] ?? childCsv['overbright'];
            if (typeof ob === 'number' && ob > 0) childOverbright = ob;
          }
          const childTexturePath = extractTexturePath(childMaterialData);
          if (childTexturePath) {
            const texResult = await tryLoadParticleTexture(pkg, basePath, childTexturePath, particleTextureLoadOptions);
            if (texResult) {
              childTextureSource = texResult.url;
              childSpritesheetMeta = texResult.spritesheet;
              if (!childSpritesheetMeta) {
                childSpritesheetMeta = await loadAssetTexJson(childTexturePath);
              }
              childColorTexIsFlowMap = childIsRefract && texResult.channels === 2;
              if (!childSpritesheetMeta) {
                console.log(`[particle spritesheet] missing: obj=${obj.name}, child=${child.name}, texture=${childTexturePath}, source=tryLoadParticleTexture`);
              }
            } else {
              const assetTex = await loadAssetTexture(engine, childTexturePath, particleTextureLoadOptions);
              if (assetTex) {
                childTextureSource = assetTex;
                childSpritesheetMeta = await loadAssetTexJson(childTexturePath);
                if (!childSpritesheetMeta) {
                  console.log(`[particle spritesheet] missing: obj=${obj.name}, child=${child.name}, texture=${childTexturePath}, source=loadAssetTexture`);
                }
              }
            }
          }
          const childBlending = childMaterialData.passes?.[0]?.blending?.toLowerCase();
          if (childBlending) {
            if (childBlending.includes('add')) {
              childBlendMode = 'additive';
            } else if (childBlending.includes('translucent') || childBlending.includes('normal')) {
              childBlendMode = 'normal';
            }
          }
        }
      }
      
      // 子粒子同样依赖逐粒子 colorrandom，避免在材质层重复预乘
      const childColor: Color3 | undefined = undefined;
      
      let childVelocityMinResolved: Vec3Like | undefined;
      let childVelocityMaxResolved: Vec3Like | undefined;
      const childVelocityMin = childParsed.emitter.velocityMin;
      const childVelocityMax = childParsed.emitter.velocityMax;
      if (childVelocityMin && childVelocityMax) {
        childVelocityMinResolved = {
          x: Math.min(childVelocityMin.x, childVelocityMax.x),
          y: Math.min(childVelocityMin.y, childVelocityMax.y),
          z: Math.min(childVelocityMin.z, childVelocityMax.z),
        };
        childVelocityMaxResolved = {
          x: Math.max(childVelocityMin.x, childVelocityMax.x),
          y: Math.max(childVelocityMin.y, childVelocityMax.y),
          z: Math.max(childVelocityMin.z, childVelocityMax.z),
        };
      }
      
      const childEmitW = childParsed.emitArea.width;
      const childEmitH = childParsed.emitArea.height;
      const childEmitterOffset = {
        x: childParsed.emitterOrigin.x * scaleSign.x,
        y: childParsed.emitterOrigin.y * scaleSign.y,
      };
      const childLocalOrigin = child.origin;
      const childOffset = childLocalOrigin
        ? { x: childLocalOrigin[0] * renderScale.x, y: childLocalOrigin[1] * renderScale.y }
        : { x: 0, y: 0 };
      const childEmitCenter = origin
        ? {
          x: origin[0] + childEmitterOffset.x + childOffset.x,
          y: origin[1] + childEmitterOffset.y + childOffset.y,
        }
        : { x: sceneSize.width / 2, y: sceneSize.height / 2 };
      // eventfollow 子粒子常用于“头部高亮”，按最终 lifetime 归一化 fadeIn，
      // 避免 parent lifetime override 拉长后头部出现明显滞后。
      if (childType === 'eventfollow') {
        const childLifetime = Math.max(0.001, childParsed.emitter.lifetime ?? 5);
        const fi = childParsed.emitter.fadeIn;
        if (typeof fi === 'number' && fi > 0) {
          childParsed.emitter.fadeIn = Math.max(0, Math.min(1, fi / childLifetime));
        }
      }
      const childEmitterConfig = {
        ...childParsed.emitter,
        instantaneous: childParsed.emitter.instantaneous,
        size: childParsed.emitter.size ?? 20,
        sizeRandom: childParsed.emitter.sizeRandom || 0,
        speed: childParsed.emitter.speed ?? 0,
        speedRandom: childParsed.emitter.speedRandom || 0,
        velocityMin: childVelocityMinResolved,
        velocityMax: childVelocityMaxResolved,
        drag: childParsed.drag,
        gravity: childParsed.emitter.gravity ?? { x: 0, y: 0, z: 0 },
        attractStrength: childParsed.attractStrength,
        attractThreshold: childParsed.attractThreshold || 0,
        initialSpeedMin: childParsed.initialSpeedMin || 0,
        initialSpeedMax: childParsed.initialSpeedMax || 0,
        initVelNoiseScale: childParsed.initVelNoiseScale,
        initVelTimeScale: childParsed.initVelTimeScale,
        turbulentForward: {
          x: childParsed.turbulentForward?.x ?? 0,
          y: childParsed.turbulentForward?.y ?? 0,
        },
        turbulence: childParsed.turbulenceSpeed || 0,
        turbulenceSpeedMin: childParsed.emitter.turbulenceSpeedMin || 0,
        turbulenceSpeedMax: childParsed.emitter.turbulenceSpeedMax || 0,
        turbulenceTimeScale: childParsed.emitter.turbulenceTimeScale,
        turbulenceScale: childParsed.emitter.turbulenceScale,
        sizeChange: childParsed.sizeChange,
        colorChange: childParsed.colorChange,
        colorMin: childParsed.colorMin,
        colorMax: childParsed.colorMax,
        colorExponent: childParsed.colorExponent,
      };
      
      const childLayer = createParticleLayer({
        id: `particle-${obj.id || Math.random().toString(36).substr(2, 9)}-child-${childIndex}`,
        name: `${obj.name || 'Particle Layer'}-child-${childIndex}`,
        texture: childTextureSource,
        width: engine.width,
        height: engine.height,
        x: engine.width / 2,
        y: engine.height / 2,
        sourceSize: [sceneSize.width, sceneSize.height],
        sourceOrigin: layerOriginBase,
        sourceScale: [rawScale.x, rawScale.y, 1],
        sourceAngles: [0, 0, rawAngleZ],
        sceneOffset: [sceneOffset.x, sceneOffset.y],
        parallaxDepth: resolveLayerParallaxDepth(obj as Record<string, unknown>),
        zIndex: (obj as Record<string, unknown>)._zIndex as number ?? obj.id ?? 0,
        emitWidth: childEmitW,
        emitHeight: childEmitH,
        emitCenter: { x: childEmitCenter.x, y: childEmitCenter.y },
        emitterOrigin: [childParsed.emitterOrigin.x, childParsed.emitterOrigin.y],
        emitAngle: 0,
        emitter: childEmitterConfig,
        maxParticles: child.maxcount ?? childParsed.maxCount,
        blendMode: childBlendMode,
        oscillate: childParsed.oscillate,
        oscillateFrequency: childParsed.oscillateFrequency,
        oscillateScaleMin: childParsed.oscillateScaleMin,
        oscillateAlpha: childParsed.oscillateAlpha,
        oscillateSize: childParsed.oscillateSize,
        oscillatePosition: childParsed.oscillatePosition ? {
          ...childParsed.oscillatePosition,
          scaleMin: childParsed.oscillatePosition.scaleMin || 0,
          scaleMax: childParsed.oscillatePosition.scaleMax,
        } : undefined,
        color: childColor,
        followMouse: isMouseTrail && (childParsed.rendererType === 'rope' || childParsed.rendererType === 'ropetrail'),
        rendererType: childParsed.rendererType,
        subdivision: childParsed.subdivision,
        sequenceMultiplier: childParsed.sequenceMultiplier,
        animationMode: childParsed.animationMode,
        spritesheetCols: childSpritesheetMeta?.cols,
        spritesheetRows: childSpritesheetMeta?.rows,
        spritesheetFrames: childSpritesheetMeta?.frames,
        spritesheetDuration: childSpritesheetMeta?.duration,
        controlPoints: childParsed.controlPoints?.map((cp) => ({
          ...cp,
          offset: {
            x: cp.offset.x,
            y: cp.offset.y,
            z: cp.offset.z,
          },
        })),
        mapSequenceBetweenCP: childParsed.mapSequenceBetweenCP,
        mapSequenceAroundCP: childParsed.mapSequenceAroundCP ? {
          ...childParsed.mapSequenceAroundCP,
          speedMin: {
            x: childParsed.mapSequenceAroundCP.speedMin.x,
            y: childParsed.mapSequenceAroundCP.speedMin.y,
            z: childParsed.mapSequenceAroundCP.speedMin.z,
          },
          speedMax: {
            x: childParsed.mapSequenceAroundCP.speedMax.x,
            y: childParsed.mapSequenceAroundCP.speedMax.y,
            z: childParsed.mapSequenceAroundCP.speedMax.z,
          },
        } : undefined,
        vortex: childParsed.vortex ? {
          ...childParsed.vortex,
          distanceInner: childParsed.vortex.distanceInner,
          distanceOuter: childParsed.vortex.distanceOuter,
          speedInner: childParsed.vortex.speedInner,
          speedOuter: childParsed.vortex.speedOuter,
          offset: {
            x: childParsed.vortex.offset.x,
            y: childParsed.vortex.offset.y,
            z: childParsed.vortex.offset.z,
          },
        } : undefined,
        controlPointAttracts: childParsed.controlPointAttractConfigs?.map((cpAttract) => ({
          ...cpAttract,
          scale: cpAttract.scale,
          threshold: cpAttract.threshold,
          origin: {
            x: cpAttract.origin.x,
            y: cpAttract.origin.y,
            z: cpAttract.origin.z,
          },
        })),
        angularMovement: childParsed.angularMovement,
        trailLength: childParsed.trailLength,
        trailMinLength: childParsed.trailMinLength,
        trailMaxLength: childParsed.trailMaxLength,
        uvScrolling: childParsed.uvScrolling,
        speedMultiplier: childSpeedMult,
        sizeMultiplier: childSizeMult,
        alphaMultiplier: childAlphaMult,
        emitterRadius: childParsed.emitterRadius,
        emitterInnerRadius: childParsed.emitterInnerRadius,
        alphaMin: childParsed.alphaMin,
        alphaMax: childParsed.alphaMax,
        alphaExponent: childParsed.alphaExponent,
        rotationMin: childParsed.rotationMin,
        rotationMax: childParsed.rotationMax,
        rotationExponent: childParsed.rotationExponent,
        angVelMin: childParsed.angVelMin,
        angVelMax: childParsed.angVelMax,
        angVelExponent: childParsed.angVelExponent,
        alphaChange: childParsed.alphaChange,
        spherical: childParsed.spherical,
        // 子粒子位置来自父粒子本地坐标，不应再叠加父对象位置变换
        renderScale: { x: 1, y: 1 },
        renderAngle: 0,
        coverScale,
        refract: childIsRefract,
        refractAmount: childRefractAmount,
        normalMapTexture: childNormalMapSource,
        colorTexIsFlowMap: childColorTexIsFlowMap,
        overbright: childOverbright,
        startTime: childParsed.startTime,
        capVelocityMax: childParsed.capVelocityMax,
        collision: childParsed.collision,
        colorList: childParsed.colorList,
        positionOffsetRandom: childParsed.positionOffsetRandom,
        oscillatePhaseMin: childParsed.oscillatePhaseMin,
        oscillatePhaseMax: childParsed.oscillatePhaseMax,
      });
      bindParticleTimelineAndScript(childLayer, obj, projectJson, layerOriginBase);
      if (childType === 'eventfollow' || childType === 'eventspawn' || childType === 'eventdeath') {
        childLayer.setFollowParent(layer, childType as 'eventfollow' | 'eventspawn' | 'eventdeath');
      }
      await engine.addLayer(childLayer);
      if (!isVisible) {
        childLayer.visible = false;
      }
      if (childType === 'static') {
        const childIsRope = childParsed.rendererType === 'rope' || childParsed.rendererType === 'ropetrail';
        if (isMouseTrail && childIsRope) {
          result.mouseTrailLayers.push(childLayer);
        } else {
          (childLayer as unknown as { _weEmitStaticOnce?: boolean })._weEmitStaticOnce = true;
          childLayer.emitStaticOnce();
        }
      }
    }
  }
  
  if (isMouseTrail) {
    result.mouseTrailLayers.push(layer);
  }
}
