import { Engine } from 'moyu-engine';
import { parseColor3 } from 'moyu-engine/math';
import { createTextLayer } from 'moyu-engine/scenario/layers';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from 'moyu-engine/components/scripting';
import { parsePkg } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import type { ProjectJson, SceneEffect, SceneObject } from '../LoaderTypes';
import { loadGenericImageEffects } from './EffectLoader';
import { logLoaderVerbose } from '../LoaderUtils';
import {
  computeSceneLayout,
  getScriptFieldValue,
  getWeLayerMetadata,
  resolveObjectTransform,
  resolveScriptPropertyUserValues,
  resolveUserProperty,
  toSourceAngles,
  toSourceScale,
  toScriptBindingConfig,
  parseVector2,
} from '../LoaderUtils';

type PkgData = ReturnType<typeof parsePkg>;
const console = { ...globalThis.console, log: logLoaderVerbose };

export function computeTextScaleComp(
  coverScale: number,
  combinedScaleY: number,
): number {
  const FONT_FLOOR_SCALE = 0.20;
  // 96/72: pt -> px conversion, 1.5: cross-platform visual size compensation.
  const FONT_SIZE_MULTIPLIER = (96 / 72) * 1.5;
  // Keep 3840x2160-class scenes unchanged (coverScale ~= 0.5 at 1920x1080 viewport),
  // and only shrink text for much larger source scenes.
  const REF_COVER_SCALE = 0.5;
  const coverScaleNorm = Math.min(1, coverScale / REF_COVER_SCALE);
  const effectiveScaleY = Math.max(combinedScaleY, FONT_FLOOR_SCALE);
  const scaleCompH = (combinedScaleY > 0 && combinedScaleY < 1)
    ? effectiveScaleY / combinedScaleY
    : 1;
  return scaleCompH * FONT_SIZE_MULTIPLIER * coverScaleNorm;
}

/**
 * 加载文本图层对象
 */
export async function loadTextObject(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  sceneSize: { width: number; height: number },
  basePath: string,
  zIndex: number,
  projectJson?: ProjectJson | null,
  afterProjectLayer = false,
  io?: ResourceIO,
): Promise<void> {
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  if (!obj.text) return;

  // 可见性检查
  const resolvedVisible = resolveUserProperty(obj.visible, projectJson);
  if (resolvedVisible === false) return;

  // 解析尺寸和位置
  const size = parseVector2(obj.size as [number, number] | string | undefined) || [200, 50];
  const transform = resolveObjectTransform(obj, sceneSize);
  const originParsed = transform.origin;
  const scaleVec = transform.scaleVec;
  const anglesVec = transform.anglesVec;

  const displayWidth = size[0];
  const displayHeight = size[1];
  const combinedScaleY = scaleVec ? Math.abs(scaleVec[1] ?? 1) : 1;
  const { coverScale, sceneOffset } = computeSceneLayout(engine.width, engine.height, sceneSize);
  const textScaleComp = computeTextScaleComp(coverScale, combinedScaleY);
  const adjustedWidth = Math.max(1, Math.round(displayWidth * textScaleComp));
  const adjustedHeight = Math.max(1, Math.round(displayHeight * textScaleComp));
  const resolvedPointSize = Number(resolveUserProperty(obj.pointsize as unknown as string | { user?: string | { name?: string; condition?: string }; value?: string }, projectJson)) || 24;
  const adjustedPointSize = resolvedPointSize * textScaleComp;
  const x = originParsed[0] * coverScale - sceneOffset[0];
  const y = originParsed[1] * coverScale - sceneOffset[1];

  const resolvedColor = resolveUserProperty(obj.color as string | { user?: string | { name?: string; condition?: string }; value?: string }, projectJson);
  const rawColorStr = typeof resolvedColor === 'string' ? resolvedColor : undefined;
  const parsedTextColor = rawColorStr
    ? parseColor3(rawColorStr, { fallback: null })
    : null;
  const parsedBgColor = obj.backgroundcolor
    ? parseColor3(obj.backgroundcolor, { fallback: null })
    : null;
  const textColor: [number, number, number] = parsedTextColor
    ? [parsedTextColor.r, parsedTextColor.g, parsedTextColor.b]
    : [1, 1, 1];
  const bgColor: [number, number, number] = parsedBgColor
    ? [parsedBgColor.r, parsedBgColor.g, parsedBgColor.b]
    : [0, 0, 0];

  const rawAlpha = resolveUserProperty(getScriptFieldValue(obj.alpha), projectJson);
  const alpha = typeof rawAlpha === 'number' ? rawAlpha : 1.0;
  const resolvedText = getScriptFieldValue<string>(
    obj.text as unknown as string | { script: string; value?: string } | undefined
  );
  const textStr = typeof resolvedText === 'string' ? resolvedText : '';
  const textObj = (typeof obj.text === 'object' && obj.text !== null)
    ? obj.text as Record<string, unknown>
    : null;

  let fontData: ArrayBuffer | undefined;
  if (obj.font && !obj.font.startsWith('systemfont_')) {
    fontData = (await resourceIO.loadBinary(obj.font, [`materials/${obj.font}`])) ?? undefined;
  }

  const effects = Array.isArray(obj.effects) ? obj.effects : [];
  const visibleEffects = effects.filter((effect): effect is SceneEffect => {
    if (!effect || typeof effect !== 'object') return false;
    const file = (effect as { file?: unknown }).file;
    if (typeof file !== 'string') return false;
    const visible = (effect as { visible?: unknown }).visible;
    return resolveUserProperty(visible, projectJson) !== false;
  });
  const effectResult = visibleEffects.length > 0
    ? await loadGenericImageEffects(
      engine,
      pkg,
      basePath,
      visibleEffects,
      [adjustedWidth, adjustedHeight],
      { r: textColor[0], g: textColor[1], b: textColor[2] },
      projectJson,
      String(obj.name ?? obj.id ?? 'text'),
    )
    : { passes: [], fbos: [] };

  // WE UV Y=0 在顶部，WebGL UV Y=0 在底部。
  // squareToQuad 把 (0,0)→p0, (1,0)→p1, (1,1)→p2, (0,1)→p3；
  // 在 WE 中 (0,0)=左上，(0,1)=左下；在 WebGL 中 (0,0)=左下，(0,1)=左上。
  // 因此需要同时：翻转 Y（修正屏幕形状）+ 交换上下点对 0↔3 / 1↔2（修正纹理角落映射）。
  //
  // textScaleComp 放大了文本图层的显示矩形（adjustedSize = displaySize * textScaleComp），
  // 透视点仍在 [0,1] UV 空间，其离中心偏移在放大矩形上被同比放大。
  // 将点围绕 (0.5,0.5) 按 1/textScaleComp 缩放，还原到 WE 原始显示矩形的等效偏移。
  const invTextScale = textScaleComp > 1.001 ? 1.0 / textScaleComp : 1.0;
  for (const pass of effectResult.passes) {
    const pts: Array<{ x: number; y: number } | null> = [];
    for (let i = 0; i < 4; i++) {
      const v = pass.uniforms[`g_Point${i}`];
      pts.push(v && typeof v === 'object' && 'x' in v && 'y' in v ? v as { x: number; y: number } : null);
    }
    if (pts[0] && pts[1] && pts[2] && pts[3]) {
      const remap = (p: { x: number; y: number }) => ({
        x: 0.5 + (p.x - 0.5) * invTextScale,
        y: 0.5 + ((1.0 - p.y) - 0.5) * invTextScale,
      });
      pass.uniforms.g_Point0 = remap(pts[3]);
      pass.uniforms.g_Point1 = remap(pts[2]);
      pass.uniforms.g_Point2 = remap(pts[1]);
      pass.uniforms.g_Point3 = remap(pts[0]);
    }
  }

  const layer = createTextLayer({
    id: `layer-${obj.id || Math.random().toString(36).substr(2, 9)}`,
    name: obj.name || 'Text Layer',
    width: adjustedWidth,
    height: adjustedHeight,
    x,
    y,
    sourceSize: [adjustedWidth, adjustedHeight],
    sourceOrigin: [originParsed[0], originParsed[1]],
    sourceScale: toSourceScale(scaleVec),
    sourceAngles: toSourceAngles(anglesVec),
    coverScale,
    sceneOffset,
    parallaxDepth: transform.parallaxDepth,
    zIndex,
    // WE 中 projectlayer 捕获其前序对象；位于其后的文本应作为 overlay，不参与捕获。
    isPostProcess: afterProjectLayer,
    opacity: alpha,
    text: textStr,
    script: typeof textObj?.script === 'string' ? textObj.script : undefined,
    scriptProperties: (textObj?.scriptproperties as Record<string, unknown> | undefined),
    font: obj.font,
    fontData,
    pointSize: adjustedPointSize,
    color: textColor,
    backgroundColor: bgColor,
    opaqueBackground: obj.opaquebackground,
    horizontalAlign: obj.horizontalalign as 'left' | 'center' | 'right',
    verticalAlign: obj.verticalalign as 'top' | 'center' | 'bottom',
    padding: Math.round((obj.padding ?? 0) * textScaleComp),
    effectPasses: effectResult.passes,
    effectFbos: effectResult.fbos,
    textureSize: [adjustedWidth, adjustedHeight],
    ...getWeLayerMetadata(obj),
  });
  const scriptBindings: ScriptBindingConfig[] = [];
  const originBinding = toScriptBindingConfig('origin', obj.origin);
  const scaleBinding = toScriptBindingConfig('scale', obj.scale);
  const colorBinding = toScriptBindingConfig('color', obj.color);
  const alphaBinding = toScriptBindingConfig('alpha', obj.alpha);
  const visibleBinding = toScriptBindingConfig('visible', obj.visible);
  const textBinding = toScriptBindingConfig('text', obj.text);
  const anglesBinding = toScriptBindingConfig('angles', obj.angles);
  for (const binding of [originBinding, scaleBinding, colorBinding, alphaBinding, visibleBinding, textBinding, anglesBinding]) {
    if (binding) {
      if (projectJson && binding.scriptProperties) {
        resolveScriptPropertyUserValues(binding.scriptProperties, projectJson);
      }
      scriptBindings.push(binding);
    }
  }
  if (scriptBindings.length > 0) {
    layer.setScriptBindings(createScriptBindingsForLayer(layer, scriptBindings));
  }

  engine.addLayer(layer);
  console.log(`文本图层: ${obj.name || obj.id} "${textStr.substring(0, 30)}" font=${obj.font || 'default'} pt=${adjustedPointSize.toFixed(1)} box=${adjustedWidth.toFixed(0)}x${adjustedHeight.toFixed(0)} pos=(${x.toFixed(0)},${y.toFixed(0)}) scale=(${scaleVec ? scaleVec[0].toFixed(3) : '1'},${scaleVec ? scaleVec[1].toFixed(3) : '1'})${fontData ? ' [PKG字体]' : ''}`);
}
