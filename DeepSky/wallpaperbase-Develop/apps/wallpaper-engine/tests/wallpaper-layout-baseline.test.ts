import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePkg } from 'formats/we/PkgLoader';
import { resolveSceneHierarchy } from 'formats/we/scene/SceneHierarchyResolver';

type AnyObject = Record<string, unknown>;

const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..');
const SAMPLE_IDS = ['3581882134', '3446971952', '3347978935'] as const;
const TARGET_OBJECT_IDS: Record<typeof SAMPLE_IDS[number], number[]> = {
  '3581882134': [352, 343, 359, 223, 237],
  '3446971952': [2559, 2554, 2565, 155, 200],
  '3347978935': [31818, 31825, 31831, 18526, 16],
};

function parseVec2(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    return null;
  }
  if (typeof value === 'string') {
    const parts = value.split(/\s+/).map(Number);
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1]];
    }
  }
  if (value && typeof value === 'object' && 'value' in (value as AnyObject)) {
    return parseVec2((value as AnyObject).value);
  }
  return null;
}

function computeAlignmentOffset(alignment: string | undefined, overflowX: number, overflowY: number): [number, number] {
  const safeX = Math.max(0, overflowX);
  const safeY = Math.max(0, overflowY);
  let offsetX = safeX / 2;
  let offsetY = safeY / 2;
  const normalized = (alignment ?? '').toLowerCase();
  if (normalized.includes('left')) offsetX = 0;
  else if (normalized.includes('right')) offsetX = safeX;
  if (normalized.includes('top')) offsetY = 0;
  else if (normalized.includes('bottom')) offsetY = safeY;
  return [offsetX, offsetY];
}

function loadWallpaperLayoutBaseline(wallpaperId: typeof SAMPLE_IDS[number]): unknown {
  const wallpaperDir = path.join(WORKSPACE_ROOT, 'resources/wallpapers', wallpaperId);
  const scenePath = path.join(wallpaperDir, 'extracted/scene.json');
  const projectPath = path.join(wallpaperDir, 'project.json');
  const pkgPath = path.join(wallpaperDir, 'scene.pkg');
  expect(fs.existsSync(scenePath)).toBe(true);
  expect(fs.existsSync(projectPath)).toBe(true);
  expect(fs.existsSync(pkgPath)).toBe(true);

  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8')) as AnyObject;
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as AnyObject;
  const pkgBuffer = fs.readFileSync(pkgPath);
  const pkg = parsePkg(pkgBuffer.buffer.slice(pkgBuffer.byteOffset, pkgBuffer.byteOffset + pkgBuffer.byteLength));
  const rawObjects = JSON.parse(JSON.stringify(scene.objects ?? [])) as AnyObject[];
  const resolved = resolveSceneHierarchy(rawObjects, project as any, pkg).sortedObjects;

  const ortho = (scene.general as AnyObject)?.orthogonalprojection as AnyObject | undefined;
  const sceneWidth = Number(ortho?.width ?? 0) || 1;
  const sceneHeight = Number(ortho?.height ?? 0) || 1;
  const engineWidth = 1920;
  const engineHeight = 1080;
  const coverScale = Math.max(engineWidth / sceneWidth, engineHeight / sceneHeight);
  const overflowX = sceneWidth * coverScale - engineWidth;
  const overflowY = sceneHeight * coverScale - engineHeight;

  const rows = TARGET_OBJECT_IDS[wallpaperId].map((id) => {
    const obj = resolved.find((item) => Number(item.id) === id) ?? {};
    const origin = parseVec2(obj.origin);
    const [offsetX, offsetY] = computeAlignmentOffset((obj.alignment as string | undefined), overflowX, overflowY);
    const displayX = origin ? origin[0] * coverScale - offsetX : null;
    const displayY = origin ? origin[1] * coverScale - offsetY : null;
    return {
      id,
      name: obj.name ?? '',
      parent: obj.parent ?? null,
      weParentId: obj._weParentId ?? null,
      weRelativeOrigin: obj._weRelativeOrigin ?? null,
      alignment: obj.alignment ?? null,
      origin: origin ?? null,
      scale: obj.scale ?? null,
      parallaxDepth: obj.parallaxDepth ?? obj._weInheritedParallaxDepth ?? null,
      display: displayX === null || displayY === null
        ? null
        : {
          x: Number(displayX.toFixed(3)),
          y: Number(displayY.toFixed(3)),
          coverScale: Number(coverScale.toFixed(6)),
        },
    };
  });

  return {
    wallpaperId,
    sceneSize: [sceneWidth, sceneHeight],
    rows,
  };
}

describe('sample wallpaper layout baseline', () => {
  for (const wallpaperId of SAMPLE_IDS) {
    it(`keeps baseline layout fields for ${wallpaperId}`, () => {
      const baseline = loadWallpaperLayoutBaseline(wallpaperId);
      expect(baseline).toMatchSnapshot();
    });
  }
});
