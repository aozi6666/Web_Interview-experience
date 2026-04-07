import type { IMaterial, UniformValue } from '../../rendering/interfaces/IMaterial';
import type { Color3 } from '../../math';

export function applyLightingUniforms(material: IMaterial, engine: any): void {
  const manager = engine?.lightManager;
  if (manager) {
    material.setUniform('g_LightAmbientColor', manager.ambientColor);
    material.setUniform('g_LightSkylightColor', manager.skylightColor);
    const lightUniforms = manager.getUniforms();
    for (const [name, value] of Object.entries(lightUniforms)) {
      material.setUniform(name, value as any);
    }
    return;
  }
  material.setUniform('g_LightAmbientColor', { r: 1, g: 1, b: 1 });
  material.setUniform('g_LightSkylightColor', { r: 1, g: 1, b: 1 });
}

export function applyLitSpriteUniforms(
  material: IMaterial,
  engine: any,
  spriteSceneOrigin: [number, number],
  spriteSceneSize: [number, number],
  receiveLighting: boolean,
): void {
  const manager = engine?.lightManager;
  const sceneLightData = manager?.getSceneLightData?.(4);
  material.setUniform('u_ReceiveLighting', receiveLighting ? 1 : 0);
  material.setUniform('u_SpriteOrigin', { x: spriteSceneOrigin[0], y: spriteSceneOrigin[1] });
  material.setUniform('u_SpriteSize', { x: spriteSceneSize[0], y: spriteSceneSize[1] });
  if (!receiveLighting || !sceneLightData) {
    material.setUniform('u_LightCount', 0);
    material.setUniform('u_LightPos', new Float32Array(16));
    material.setUniform('u_LightColor', new Float32Array(16));
    material.setUniform('u_AmbientColor', { r: 1, g: 1, b: 1 });
    return;
  }
  material.setUniform('u_LightCount', sceneLightData.pointCount);
  material.setUniform('u_LightPos', sceneLightData.lightPos);
  material.setUniform('u_LightColor', sceneLightData.lightColor);
  material.setUniform('u_AmbientColor', sceneLightData.ambientColor);
}

export function applyEffectFrameUniforms(
  material: IMaterial,
  options: {
    engine: any;
    width: number;
    height: number;
    opacity: number;
    brightness?: number;
    color?: Color3;
    userAlpha?: number;
  },
): void {
  const { engine, width, height, opacity, brightness = 1, color = { r: 1, g: 1, b: 1 }, userAlpha = opacity } = options;
  if (engine) {
    material.setUniform('g_PointerPosition', { x: engine.mouseX, y: engine.mouseY });
    material.setUniform('g_PointerPositionLast', { x: engine.lastMouseX, y: engine.lastMouseY });
  }
  const now = new Date();
  const daytime = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  material.setUniform('g_Daytime', daytime);

  const w = width || 1;
  const h = height || 1;
  material.setUniform('g_TexelSize', { x: 1.0 / w, y: 1.0 / h });
  material.setUniform('g_TexelSizeHalf', { x: 0.5 / w, y: 0.5 / h });
  material.setUniform('g_Alpha', opacity);
  material.setUniform('g_UserAlpha', userAlpha);
  material.setUniform('g_Brightness', brightness);
  material.setUniform('g_Color', color);
  material.setUniform('g_Color4', { x: color.r, y: color.g, z: color.b, w: opacity });

  applyLightingUniforms(material, engine);
}

export function setupWEPerFrameUniforms(
  material: IMaterial,
  options: {
    effectTime: number;
    engine: any;
    passIndex: number;
    protectedTextureSlots?: Set<number>;
    applyGlobalLightingUniforms: (material: IMaterial) => void;
    applyReflectionUniforms: (material: IMaterial, existingKeys?: Set<string>, protectedTextureSlots?: Set<number>) => void;
  },
): void {
  const {
    effectTime,
    engine,
    passIndex,
    protectedTextureSlots,
    applyGlobalLightingUniforms,
    applyReflectionUniforms,
  } = options;

  material.setUniform('g_Time', effectTime);
  const now = new Date();
  const daytime = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  material.setUniform('g_Daytime', daytime);

  if (engine) {
    material.setUniform('g_PointerPosition', { x: engine.mouseX, y: engine.mouseY });
    material.setUniform('g_PointerPositionLast', { x: engine.lastMouseX, y: engine.lastMouseY });
    material.setUniform('g_ParallaxPosition', { x: engine.parallaxPositionX, y: engine.parallaxPositionY });
  }
  applyGlobalLightingUniforms(material);
  applyReflectionUniforms(material, undefined, protectedTextureSlots);
  void passIndex;
}

export function setupWEDefaultUniforms(
  material: IMaterial,
  options: {
    existingKeys: Set<string>;
    rtWidth: number;
    rtHeight: number;
    opacity: number;
    userAlpha: number;
    brightness: number;
    color: Color3;
    layerWidth: number;
    layerHeight: number;
    engine: any;
    applyGlobalLightingUniforms: (material: IMaterial) => void;
    applyReflectionUniforms: (material: IMaterial, existingKeys?: Set<string>, protectedTextureSlots?: Set<number>) => void;
  },
): void {
  const {
    existingKeys,
    rtWidth,
    rtHeight,
    opacity,
    userAlpha,
    brightness,
    color,
    layerWidth,
    layerHeight,
    engine,
    applyGlobalLightingUniforms,
    applyReflectionUniforms,
  } = options;
  const set = (name: string, value: UniformValue) => {
    if (!existingKeys.has(name)) {
      material.setUniform(name, value);
    }
  };

  set('g_TexelSize', { x: 1.0 / rtWidth, y: 1.0 / rtHeight });
  set('g_TexelSizeHalf', { x: 0.5 / rtWidth, y: 0.5 / rtHeight });
  set('g_Alpha', opacity);
  set('g_UserAlpha', userAlpha);
  set('g_Brightness', brightness);
  set('g_Color', color);
  set('g_Color4', {
    x: color.r, y: color.g, z: color.b, w: opacity,
  });
  set('g_CompositeColor', color);

  set('g_LightAmbientColor', engine?.lightManager.ambientColor ?? { r: 1, g: 1, b: 1 });
  set('g_LightSkylightColor', engine?.lightManager.skylightColor ?? { r: 1, g: 1, b: 1 });

  set('g_Texture0Rotation', { x: 1, y: 0, z: 0, w: 1 });
  set('g_Texture0Translation', { x: 0, y: 0 });

  const identityMatrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  set('g_ModelViewProjectionMatrix', identityMatrix);
  set('g_ModelViewProjectionMatrixInverse', identityMatrix);
  set('g_ModelMatrix', identityMatrix);
  set('g_ModelMatrixInverse', identityMatrix);
  set('g_NormalModelMatrix', [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
  set('g_AltModelMatrix', identityMatrix);
  set('g_AltNormalModelMatrix', [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
  set('g_AltViewProjectionMatrix', identityMatrix);
  set('g_ViewProjectionMatrix', identityMatrix);
  set('g_EffectTextureProjectionMatrix', identityMatrix);
  set('g_EffectTextureProjectionMatrixInverse', identityMatrix);
  set('g_EffectModelViewProjectionMatrix', identityMatrix);
  set('g_EffectModelViewProjectionMatrixInverse', identityMatrix);

  set('g_EyePosition', { x: 0, y: 0, z: 1 });
  set('g_ViewUp', { x: 0, y: 1, z: 0 });
  set('g_ViewRight', { x: 1, y: 0, z: 0 });
  set('g_OrientationUp', { x: 0, y: 1, z: 0 });
  set('g_OrientationRight', { x: 1, y: 0, z: 0 });
  set('g_OrientationForward', { x: 0, y: 0, z: 1 });

  set('g_ParallaxPosition', { x: 0.5, y: 0.5 });

  const texRes = { x: rtWidth, y: rtHeight, z: rtWidth, w: rtHeight };
  set('g_Texture0Resolution', texRes);
  for (let slot = 1; slot <= 7; slot++) {
    set(`g_Texture${slot}Resolution`, texRes);
  }

  set('g_TextureReductionScale', 1.0);
  const engineW = engine?.width ?? layerWidth;
  const engineH = engine?.height ?? layerHeight;
  set('g_Screen', { x: engineW, y: engineH, z: engineW / engineH });
  applyGlobalLightingUniforms(material);
  applyReflectionUniforms(material, existingKeys);
}
