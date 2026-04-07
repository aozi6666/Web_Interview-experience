import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SceneLoader } from '../src/loader/SceneLoader';
import { parseParticleConfig, type WEParticleConfig } from '../src/loader/ParticleConfigLoader';
import { parsePkg, listFiles, extractFile } from '../src/loader/PkgLoader';
import { parseTex } from '../src/loader/TexLoader';
import { parseMdl } from '../src/loader/MdlLoader';
import { createProjectLoader } from '../src/loader/ProjectLoader';
import type { WEScene } from '../src/loader/types';

const WALLPAPERS_DIR = path.resolve(process.cwd(), 'resources/wallpapers');
const JSON_DECODER = new TextDecoder('utf-8');

function getWallpaperDirs(): string[] {
  if (!fs.existsSync(WALLPAPERS_DIR)) {
    return [];
  }

  return fs.readdirSync(WALLPAPERS_DIR)
    .map((name) => path.join(WALLPAPERS_DIR, name))
    .filter((fullPath) => fs.statSync(fullPath).isDirectory())
    .sort();
}

function walkFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function pushError(errors: string[], msg: string): void {
  errors.push(msg);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function failWithErrors(errors: string[]): never {
  const previewLimit = 60;
  const preview = errors.slice(0, previewLimit).join('\n');
  const suffix = errors.length > previewLimit
    ? `\n... 还有 ${errors.length - previewLimit} 个错误未展示`
    : '';
  throw new Error(`发现 ${errors.length} 个资源解析错误:\n${preview}${suffix}`);
}

interface ResourceStats {
  projects: number;
  scenes: number;
  extractedJson: number;
  particles: number;
  effects: number;
  materials: number;
  models: number;
  shaders: number;
  tex: number;
  mdl: number;
  pkgs: number;
  pkgEntries: number;
}

function createStats(): ResourceStats {
  return {
    projects: 0,
    scenes: 0,
    extractedJson: 0,
    particles: 0,
    effects: 0,
    materials: 0,
    models: 0,
    shaders: 0,
    tex: 0,
    mdl: 0,
    pkgs: 0,
    pkgEntries: 0,
  };
}

describe('wallpaper resources read and transform', () => {
  const wallpaperDirs = getWallpaperDirs();

  it('should discover wallpaper directories', () => {
    expect(wallpaperDirs.length).toBeGreaterThan(0);
  });

  it('should parse all wallpaper resources without errors', async () => {
    const errors: string[] = [];
    const projectLoader = createProjectLoader();
    const sceneLoader = new SceneLoader();
    const stats = createStats();
    const totalWallpapers = wallpaperDirs.length;
    const suiteStartTime = Date.now();
    let processedCount = 0;

    const tick = async (): Promise<void> => {
      processedCount += 1;
      if (processedCount % 200 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    };

    const originalLog = console.log;
    const originalWarn = console.warn;
    const verbose = process.env.RESOURCE_TEST_VERBOSE === '1';
    const log = (message: string): void => {
      originalLog(message);
    };
    console.log = () => {};
    console.warn = () => {};

    try {
      log(`[resources-test] 开始: wallpapers=${totalWallpapers}, verbose=${verbose ? 'on' : 'off'}`);
      for (const [index, wallpaperDir] of wallpaperDirs.entries()) {
        const wallpaperId = path.basename(wallpaperDir);
        const current = index + 1;
        const progress = ((current / totalWallpapers) * 100).toFixed(1);
        const projectPath = path.join(wallpaperDir, 'project.json');
        const wallpaperStart = Date.now();
        const wallpaperStatsBefore = { ...stats };

        if (verbose) {
          log(`[resources-test] -> [${current}/${totalWallpapers} ${progress}%] ${wallpaperId}`);
        }

        if (!fs.existsSync(projectPath)) {
          pushError(errors, `[${wallpaperId}] 缺少 project.json`);
          continue;
        }

        let projectRaw: unknown;
        try {
          projectRaw = readJson(projectPath);
          stats.projects += 1;
          await tick();
        } catch (error) {
          pushError(errors, `[${wallpaperId}] project.json 解析失败: ${String(error)}`);
          continue;
        }

        const projectValidation = projectLoader.validate(projectRaw as Parameters<typeof projectLoader.validate>[0]);
        if (!projectValidation.valid) {
          pushError(
            errors,
            `[${wallpaperId}] project.json 校验失败: ${projectValidation.errors.join('; ')}`
          );
        }

        const project = projectRaw as {
          type?: string;
          file?: string;
        };
        const wallpaperType = (project.type ?? 'scene').toLowerCase();

        // 场景 JSON: 优先 extracted/scene.json，再回退 pkg
        if (wallpaperType === 'scene') {
          const extractedScenePath = path.join(wallpaperDir, 'extracted', project.file ?? 'scene.json');
          if (fs.existsSync(extractedScenePath)) {
            try {
              const scene = readJson(extractedScenePath) as WEScene;
              const parsed = sceneLoader.parseScene(scene, wallpaperDir);
              expect(parsed).toBeTruthy();
              stats.scenes += 1;
              await tick();
            } catch (error) {
              pushError(errors, `[${wallpaperId}] scene 转换失败(${extractedScenePath}): ${String(error)}`);
            }
          }
        }

        // 提取目录资源：逐个读取并转换
        const extractedDir = path.join(wallpaperDir, 'extracted');
        if (fs.existsSync(extractedDir)) {
          const extractedFiles = walkFiles(extractedDir);

          for (const filePath of extractedFiles) {
            const relPath = path.relative(wallpaperDir, filePath).replace(/\\/g, '/');
            const lowerRel = relPath.toLowerCase();

            try {
              if (lowerRel.endsWith('.json')) {
                const jsonData = readJson(filePath) as Record<string, unknown>;
                stats.extractedJson += 1;

                if (lowerRel.includes('/particles/')) {
                  parseParticleConfig(jsonData as WEParticleConfig);
                  stats.particles += 1;
                } else if (lowerRel.endsWith('/scene.json')) {
                  sceneLoader.parseScene(jsonData as WEScene, wallpaperDir);
                  stats.scenes += 1;
                } else if (lowerRel.endsWith('/effect.json')) {
                  const passes = jsonData.passes;
                  if (!Array.isArray(passes)) {
                    throw new Error('effect.json 缺少 passes 数组');
                  }
                  stats.effects += 1;
                } else if (lowerRel.includes('/materials/')) {
                  const passes = jsonData.passes;
                  if (passes !== undefined && !Array.isArray(passes)) {
                    throw new Error('material passes 必须是数组');
                  }
                  stats.materials += 1;
                } else if (lowerRel.includes('/models/')) {
                  if (!('vertices' in jsonData) && !('meshes' in jsonData) && !('model' in jsonData)) {
                    // model 文件差异较大，这里只保证可读可解析，不强制结构
                  }
                  stats.models += 1;
                }
              } else if (lowerRel.endsWith('.vert') || lowerRel.endsWith('.frag') || lowerRel.endsWith('.h')) {
                const shaderSource = fs.readFileSync(filePath, 'utf-8');
                if (!shaderSource.trim()) {
                  throw new Error('shader 文件为空');
                }
                stats.shaders += 1;
              } else if (lowerRel.endsWith('.tex')) {
                const texBuffer = fs.readFileSync(filePath);
                const texInfo = parseTex(
                  texBuffer.buffer.slice(texBuffer.byteOffset, texBuffer.byteOffset + texBuffer.byteLength)
                );
                if (!texInfo) {
                  throw new Error('parseTex 返回 null');
                }
                stats.tex += 1;
              } else if (lowerRel.endsWith('.mdl')) {
                const mdlBuffer = fs.readFileSync(filePath);
                const mdlInfo = parseMdl(
                  mdlBuffer.buffer.slice(mdlBuffer.byteOffset, mdlBuffer.byteOffset + mdlBuffer.byteLength)
                );
                if (!mdlInfo) {
                  throw new Error('parseMdl 返回 null');
                }
                stats.mdl += 1;
              }
              await tick();
            } catch (error) {
              pushError(errors, `[${wallpaperId}] 解析失败(${relPath}): ${String(error)}`);
            }
          }
        }

        // PKG 资源：读取并转换
        const pkgFiles = fs.readdirSync(wallpaperDir)
          .filter((name) => name.toLowerCase().endsWith('.pkg'))
          .map((name) => path.join(wallpaperDir, name));

        for (const pkgPath of pkgFiles) {
          const pkgName = path.basename(pkgPath);
          try {
            const pkgBuffer = fs.readFileSync(pkgPath);
            const pkg = parsePkg(
              pkgBuffer.buffer.slice(pkgBuffer.byteOffset, pkgBuffer.byteOffset + pkgBuffer.byteLength)
            );
            const entries = listFiles(pkg);
            if (entries.length === 0) {
              throw new Error('PKG 文件条目为空');
            }
            stats.pkgs += 1;
            await tick();

            for (const entryName of entries) {
              const lowerEntry = entryName.toLowerCase();

              try {
                if (
                  lowerEntry.endsWith('.json') ||
                  lowerEntry.endsWith('.tex') ||
                  lowerEntry.endsWith('.mdl')
                ) {
                  const raw = extractFile(pkg, entryName);
                  if (!raw) {
                    throw new Error('extractFile 返回 null');
                  }
                  stats.pkgEntries += 1;

                  if (lowerEntry.endsWith('.json')) {
                    const jsonText = JSON_DECODER.decode(new Uint8Array(raw));
                    const jsonData = JSON.parse(jsonText) as Record<string, unknown>;

                    if (entryName.endsWith('scene.json')) {
                      sceneLoader.parseScene(jsonData as WEScene, wallpaperDir);
                      stats.scenes += 1;
                    } else if (lowerEntry.includes('/particles/')) {
                      parseParticleConfig(jsonData as WEParticleConfig);
                      stats.particles += 1;
                    }
                  } else if (lowerEntry.endsWith('.tex')) {
                    const texInfo = parseTex(toArrayBuffer(raw));
                    if (!texInfo) {
                      throw new Error('parseTex 返回 null');
                    }
                    stats.tex += 1;
                  } else if (lowerEntry.endsWith('.mdl')) {
                    const mdlInfo = parseMdl(toArrayBuffer(raw));
                    if (!mdlInfo) {
                      throw new Error('parseMdl 返回 null');
                    }
                    stats.mdl += 1;
                  }
                }
                await tick();
              } catch (error) {
                pushError(
                  errors,
                  `[${wallpaperId}] PKG 条目解析失败(${pkgName} -> ${entryName}): ${String(error)}`
                );
              }
            }
          } catch (error) {
            pushError(errors, `[${wallpaperId}] PKG 解析失败(${pkgName}): ${String(error)}`);
          }
        }

        if (verbose) {
          const elapsedMs = Date.now() - wallpaperStart;
          const deltaJson = stats.extractedJson - wallpaperStatsBefore.extractedJson;
          const deltaTex = stats.tex - wallpaperStatsBefore.tex;
          const deltaPkgEntries = stats.pkgEntries - wallpaperStatsBefore.pkgEntries;
          const deltaParticles = stats.particles - wallpaperStatsBefore.particles;
          const completedProgress = ((current / totalWallpapers) * 100).toFixed(1);
          log(
            `[resources-test] <- [${current}/${totalWallpapers} ${completedProgress}%] ${wallpaperId} done ${elapsedMs}ms ` +
            `(json=${deltaJson}, tex=${deltaTex}, particles=${deltaParticles}, pkgEntries=${deltaPkgEntries})`
          );
        }
      }
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }

    const totalElapsedMs = Date.now() - suiteStartTime;
    originalLog(
      '[resources-test] 汇总: ' +
      `wallpapers=${wallpaperDirs.length}, totalTimeMs=${totalElapsedMs}, ` +
      `project=${stats.projects}, scene=${stats.scenes}, json=${stats.extractedJson}, ` +
      `particle=${stats.particles}, effect=${stats.effects}, material=${stats.materials}, model=${stats.models}, ` +
      `shader=${stats.shaders}, tex=${stats.tex}, mdl=${stats.mdl}, pkg=${stats.pkgs}, pkgEntries=${stats.pkgEntries}, ` +
      `errors=${errors.length}`
    );

    if (errors.length > 0) {
      failWithErrors(errors);
    }
  });
});
