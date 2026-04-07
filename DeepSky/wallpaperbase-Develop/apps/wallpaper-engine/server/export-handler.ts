import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { PNG } from 'pngjs';
import {
  EngineDefaults,
  type JsonRecord,
} from 'moyu-engine/scenario/EngineDefaults';
import {
  applyProfileOverlay,
  BASE_DEFAULTS_BUNDLE,
  DEFAULTS_SCHEMA,
  SCHEMA_VERSION,
  type DefaultsProfileDocument,
  type EngineDefaultsOverlay,
} from 'moyu-engine/defaults';
import { extractFile, listFiles, parsePkg } from 'formats/we/PkgLoader';
import { parseTex } from 'formats/we/texture/index';

export interface ExportRequestPayload {
  wallpaperPath: string;
  descriptor?: unknown;
  sceneJson?: unknown;
  originalSceneJson?: unknown;
}

export interface ExportResult {
  exportPath: string;
  fileCount: number;
  warnings: string[];
}

interface ProjectJsonLite {
  file?: string;
  title?: string;
  type?: string;
}

interface ExportManifest {
  generatedAt: string;
  wallpaperPath: string;
  wallpaperTitle: string;
  pkgName: string | null;
  fileCount: number;
  files: string[];
  warnings: string[];
}

const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.wav', '.flac', '.m4a', '.aac']);

type NumericObject = Record<string, unknown>;

type BinScalarType = 'float32' | 'uint16' | 'uint8' | 'mixed';

interface BinSection {
  offset: number;
  byteLength: number;
  type: BinScalarType;
  count?: number;
  numFrames?: number;
  numBones?: number;
  floatOffset?: number;
  floatByteLength?: number;
  activeOffset?: number;
  activeByteLength?: number;
  strideFloatsPerBone?: number;
}

interface MeshBinRef {
  $bin: string;
  format: 'moyu-mesh-bin-v1';
}

interface AnimBinRef {
  $bin: string;
  format: 'moyu-anim-bin-v1';
}

interface AnimBinSections {
  boneIndices?: BinSection;
  boneWeights?: BinSection;
  boneIndices4?: BinSection;
  boneWeights4?: BinSection;
  localMatrix?: BinSection;
  frames: BinSection[];
}

interface ExportDefaults {
  layerDefaults: JsonRecord;
  emitterDefaults: JsonRecord;
  uniformDefaults: JsonRecord;
}

const TEXTURE_RESOLUTION_UNIFORM_PATTERN = /^g_Texture\d+Resolution$/;

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeBinary(root: string, relPath: string, data: Uint8Array): void {
  const abs = join(root, relPath);
  ensureDir(dirname(abs));
  writeFileSync(abs, data);
}

function writeJson(root: string, relPath: string, data: unknown): void {
  const abs = join(root, relPath);
  ensureDir(dirname(abs));
  writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function writeText(root: string, relPath: string, text: string): void {
  const abs = join(root, relPath);
  ensureDir(dirname(abs));
  writeFileSync(abs, text, 'utf-8');
}

function toSafePath(relPath: string): string {
  const norm = normalize(relPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.startsWith('../') || norm.includes('/../')) {
    throw new Error(`非法路径: ${relPath}`);
  }
  return norm;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function extractTex(texData: Uint8Array): { ext: string; bytes: Uint8Array; warning?: string } {
  const texInfo = parseTex(toArrayBuffer(texData));
  if (!texInfo) {
    return { ext: '.tex', bytes: texData, warning: 'TEX 解析失败，保留原始 .tex 文件' };
  }

  if (texInfo.format === 'jpeg') return { ext: '.jpg', bytes: texInfo.imageData };
  if (texInfo.format === 'png') return { ext: '.png', bytes: texInfo.imageData };
  if (texInfo.format === 'mp4') return { ext: '.mp4', bytes: texInfo.imageData };

  if (texInfo.format === 'raw') {
    const raw = texInfo.imageData;
    if (raw.byteLength < 8) {
      return { ext: '.tex', bytes: texData, warning: 'RAW 纹理数据异常，保留原始 .tex 文件' };
    }
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const rgba = raw.slice(8);
    if (width <= 0 || height <= 0 || rgba.byteLength !== width * height * 4) {
      return { ext: '.tex', bytes: texData, warning: 'RAW 纹理尺寸不匹配，保留原始 .tex 文件' };
    }

    const png = new PNG({ width, height });
    png.data = Buffer.from(rgba);
    const encoded = (PNG as unknown as { sync: { write: (value: unknown) => Buffer } }).sync.write(png);
    return { ext: '.png', bytes: new Uint8Array(encoded) };
  }

  return { ext: '.tex', bytes: texData, warning: `未支持的 TEX 格式(${texInfo.format})，保留原始 .tex 文件` };
}

function resolveWallpaperDir(projectRoot: string, wallpaperPath: string): string {
  const cleaned = wallpaperPath.trim();
  if (!cleaned.startsWith('/wallpapers/')) {
    throw new Error(`wallpaperPath 必须以 /wallpapers/ 开头，当前: ${wallpaperPath}`);
  }
  const rel = cleaned.replace(/^\/wallpapers\//, '');
  if (!rel || rel.includes('..')) {
    throw new Error(`非法 wallpaperPath: ${wallpaperPath}`);
  }
  const dir = join(projectRoot, 'resources', 'wallpapers', rel);
  const relToRoot = relative(projectRoot, dir);
  if (relToRoot.startsWith('..')) {
    throw new Error(`wallpaperPath 超出项目目录: ${wallpaperPath}`);
  }
  return dir;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function isRecord(value: unknown): value is JsonRecord {
  return EngineDefaults.isRecord(value);
}

function loadExportDefaults(projectRoot: string, warnings: string[]): ExportDefaults {
  const profilesDir = join(projectRoot, 'config', 'default-profiles');

  const readProfileOverlay = (
    fileName: string,
  ): { overlay: EngineDefaultsOverlay; schemaVersion?: string; profileVersion?: string } | null => {
    const path = join(profilesDir, fileName);
    if (!existsSync(path)) return null;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as DefaultsProfileDocument | unknown;
      if (!isRecord(parsed)) return null;
      const overlay = isRecord(parsed.overlay)
        ? (parsed.overlay as EngineDefaultsOverlay)
        : (parsed as EngineDefaultsOverlay);
      return {
        overlay,
        schemaVersion: typeof parsed.schemaVersion === 'string' ? parsed.schemaVersion : undefined,
        profileVersion: typeof parsed.profileVersion === 'string' ? parsed.profileVersion : undefined,
      };
    } catch (error) {
      warnings.push(`读取 profile 配置失败(${path}): ${(error as Error).message}`);
      return null;
    }
  };

  const baseProfile = readProfileOverlay('base-profile.json');
  const fitProfile = readProfileOverlay('moyu-fit-v1.json');

  let resolved = applyProfileOverlay(BASE_DEFAULTS_BUNDLE, {}, DEFAULTS_SCHEMA);
  if (baseProfile) {
    resolved = applyProfileOverlay(resolved, baseProfile.overlay, DEFAULTS_SCHEMA);
  }
  if (fitProfile) {
    resolved = applyProfileOverlay(resolved, fitProfile.overlay, DEFAULTS_SCHEMA);
  }
  EngineDefaults.configure({
    ...resolved,
    schemaVersion: fitProfile?.schemaVersion ?? baseProfile?.schemaVersion ?? SCHEMA_VERSION,
    profileVersion: fitProfile?.profileVersion ?? baseProfile?.profileVersion ?? 'base-profile',
    defaultsVersion: fitProfile?.profileVersion ?? baseProfile?.profileVersion ?? 'base-profile',
    profileOverlay: fitProfile?.overlay ?? baseProfile?.overlay ?? {},
  });
  return resolved;
}

function isNumericKey(key: string): boolean {
  return /^[0-9]+$/.test(key);
}

function toNumericArray(input: unknown): number[] | null {
  if (Array.isArray(input)) {
    return input.map((value) => Number(value));
  }
  if (!input || typeof input !== 'object') return null;
  const obj = input as NumericObject;
  const numericKeys = Object.keys(obj).filter(isNumericKey);
  if (numericKeys.length === 0) return null;
  numericKeys.sort((a, b) => Number(a) - Number(b));
  return numericKeys.map((key) => Number(obj[key]));
}

function toTypedBuffer(input: unknown, type: Exclude<BinScalarType, 'mixed'>): { buffer: Buffer; count: number } | null {
  const values = toNumericArray(input);
  if (!values || values.length === 0) return null;

  if (type === 'float32') {
    const typed = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) typed[i] = values[i];
    return { buffer: Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength), count: typed.length };
  }
  if (type === 'uint16') {
    const typed = new Uint16Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const v = Number.isFinite(values[i]) ? values[i] : 0;
      typed[i] = Math.max(0, Math.min(65535, Math.round(v)));
    }
    return { buffer: Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength), count: typed.length };
  }

  const typed = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = Number.isFinite(values[i]) ? values[i] : 0;
    typed[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return { buffer: Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength), count: typed.length };
}

function writeBinFile(root: string, relPath: string, chunks: Buffer[]): number {
  const data = Buffer.concat(chunks);
  writeBinary(root, relPath, new Uint8Array(data));
  return data.byteLength;
}

function writeBinFileWithHeader(
  root: string,
  relPath: string,
  header: unknown,
  payloadChunks: Buffer[],
): number {
  const magic = Buffer.from('MOYU');
  const headerJson = Buffer.from(JSON.stringify(header), 'utf-8');
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32LE(headerJson.byteLength, 0);
  return writeBinFile(root, relPath, [magic, headerLength, headerJson, ...payloadChunks]);
}

function appendSection(
  chunks: Buffer[],
  currentOffset: number,
  chunk: Buffer,
  type: BinScalarType,
  count?: number,
): { section: BinSection; nextOffset: number } {
  chunks.push(chunk);
  return {
    section: {
      offset: currentOffset,
      byteLength: chunk.byteLength,
      type,
      ...(typeof count === 'number' ? { count } : {}),
    },
    nextOffset: currentOffset + chunk.byteLength,
  };
}

function flattenAnimFrames(frames: unknown, numBones: number): {
  floatBuffer: Buffer;
  activeBuffer: Buffer;
  numFrames: number;
} {
  const frameList = Array.isArray(frames) ? frames : [];
  const safeNumBones = Number.isFinite(numBones) && numBones > 0 ? Math.floor(numBones) : 0;
  const numFrames = frameList.length;
  const floatData = new Float32Array(numFrames * safeNumBones * 5);
  const activeData = new Uint8Array(numFrames * safeNumBones);

  let floatCursor = 0;
  let activeCursor = 0;
  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const bones = Array.isArray(frameList[frameIndex]) ? (frameList[frameIndex] as unknown[]) : [];
    for (let boneIndex = 0; boneIndex < safeNumBones; boneIndex++) {
      const bone = (bones[boneIndex] as Record<string, unknown> | undefined) ?? undefined;
      const pos = (bone?.pos as Record<string, unknown> | undefined) ?? undefined;
      const scale = (bone?.scale as Record<string, unknown> | undefined) ?? undefined;
      const position = { x: Number(pos?.x ?? 0), y: Number(pos?.y ?? 0) };
      const rotation = Number(bone?.rotation ?? 0);
      const scale2D = { x: Number(scale?.x ?? 1), y: Number(scale?.y ?? 1) };
      floatData[floatCursor++] = Number.isFinite(position.x) ? position.x : 0;
      floatData[floatCursor++] = Number.isFinite(position.y) ? position.y : 0;
      floatData[floatCursor++] = Number.isFinite(rotation) ? rotation : 0;
      floatData[floatCursor++] = Number.isFinite(scale2D.x) ? scale2D.x : 1;
      floatData[floatCursor++] = Number.isFinite(scale2D.y) ? scale2D.y : 1;
      activeData[activeCursor++] = bone?.active ? 1 : 0;
    }
  }

  return {
    floatBuffer: Buffer.from(floatData.buffer, floatData.byteOffset, floatData.byteLength),
    activeBuffer: Buffer.from(activeData.buffer, activeData.byteOffset, activeData.byteLength),
    numFrames,
  };
}

function extractMeshBin(
  layerId: string,
  puppetMesh: Record<string, unknown>,
  exportDir: string,
  files: string[],
  warnings: string[],
): MeshBinRef | null {
  const vertices = toTypedBuffer(puppetMesh.vertices, 'float32');
  const uvs = toTypedBuffer(puppetMesh.uvs, 'float32');
  const indices = toTypedBuffer(puppetMesh.indices, 'uint16');
  if (!vertices || !uvs || !indices) {
    warnings.push(`图层 ${layerId} 的 puppetMesh 数据不完整，跳过 mesh.bin 提取`);
    return null;
  }

  const chunks: Buffer[] = [];
  let offset = 0;
  const vertexSection = appendSection(chunks, offset, vertices.buffer, 'float32', vertices.count);
  offset = vertexSection.nextOffset;
  const uvSection = appendSection(chunks, offset, uvs.buffer, 'float32', uvs.count);
  offset = uvSection.nextOffset;
  const indexSection = appendSection(chunks, offset, indices.buffer, 'uint16', indices.count);
  offset = indexSection.nextOffset;

  const vertexCount = Number(puppetMesh.vertexCount);
  const triangleCount = Number(puppetMesh.triangleCount);
  const safeVertexCount = Number.isFinite(vertexCount) && vertexCount > 0 ? Math.floor(vertexCount) : Math.floor(vertices.count / 3);
  const safeTriangleCount = Number.isFinite(triangleCount) && triangleCount > 0 ? Math.floor(triangleCount) : Math.floor(indices.count / 3);

  const relPath = toSafePath(`buffers/${sanitizeName(layerId)}.mesh.bin`);
  writeBinFileWithHeader(exportDir, relPath, {
    kind: 'mesh',
    version: 1,
    vertexCount: safeVertexCount,
    triangleCount: safeTriangleCount,
    sections: {
      vertices: vertexSection.section,
      uvs: uvSection.section,
      indices: indexSection.section,
    },
  }, chunks);
  files.push(relPath);

  return {
    $bin: relPath,
    format: 'moyu-mesh-bin-v1',
  };
}

function extractAnimBin(
  layerId: string,
  puppetAnimation: Record<string, unknown>,
  exportDir: string,
  files: string[],
  warnings: string[],
): AnimBinRef | null {
  const chunks: Buffer[] = [];
  const sections: AnimBinSections = { frames: [] };
  let offset = 0;

  const boneIndices = toTypedBuffer(puppetAnimation.boneIndices, 'uint8');
  if (boneIndices) {
    const sec = appendSection(chunks, offset, boneIndices.buffer, 'uint8', boneIndices.count);
    offset = sec.nextOffset;
    sections.boneIndices = sec.section;
  }
  const boneWeights = toTypedBuffer(puppetAnimation.boneWeights, 'float32');
  if (boneWeights) {
    const sec = appendSection(chunks, offset, boneWeights.buffer, 'float32', boneWeights.count);
    offset = sec.nextOffset;
    sections.boneWeights = sec.section;
  }
  const boneIndices4 = toTypedBuffer(puppetAnimation.boneIndices4, 'uint16');
  if (boneIndices4) {
    const sec = appendSection(chunks, offset, boneIndices4.buffer, 'uint16', boneIndices4.count);
    offset = sec.nextOffset;
    sections.boneIndices4 = sec.section;
  }
  const boneWeights4 = toTypedBuffer(puppetAnimation.boneWeights4, 'float32');
  if (boneWeights4) {
    const sec = appendSection(chunks, offset, boneWeights4.buffer, 'float32', boneWeights4.count);
    offset = sec.nextOffset;
    sections.boneWeights4 = sec.section;
  }

  const bonesInput = Array.isArray(puppetAnimation.bones) ? (puppetAnimation.bones as Array<Record<string, unknown>>) : [];
  const bonesMeta: unknown[] = [];
  const localMatrixValues: number[] = [];
  for (const bone of bonesInput) {
    const { localMatrix, ...rest } = bone;
    bonesMeta.push(rest);
    const matrixValues = toNumericArray(localMatrix);
    if (!matrixValues || matrixValues.length === 0) {
      for (let i = 0; i < 16; i++) localMatrixValues.push(i % 5 === 0 ? 1 : 0);
      warnings.push(`图层 ${layerId} 的骨骼 localMatrix 缺失，使用单位矩阵填充`);
      continue;
    }
    for (let i = 0; i < 16; i++) {
      const v = Number(matrixValues[i] ?? (i % 5 === 0 ? 1 : 0));
      localMatrixValues.push(Number.isFinite(v) ? v : 0);
    }
  }
  if (localMatrixValues.length > 0) {
    const matrixTyped = new Float32Array(localMatrixValues.length);
    for (let i = 0; i < localMatrixValues.length; i++) matrixTyped[i] = localMatrixValues[i];
    const matrixBuffer = Buffer.from(matrixTyped.buffer, matrixTyped.byteOffset, matrixTyped.byteLength);
    const sec = appendSection(chunks, offset, matrixBuffer, 'float32', matrixTyped.length);
    offset = sec.nextOffset;
    sections.localMatrix = sec.section;
  }

  const animationsInput = Array.isArray(puppetAnimation.animations)
    ? (puppetAnimation.animations as Array<Record<string, unknown>>)
    : [];
  const animationsMeta: unknown[] = [];
  for (let animIndex = 0; animIndex < animationsInput.length; animIndex++) {
    const anim = animationsInput[animIndex];
    const { frames, ...meta } = anim;
    animationsMeta.push(meta);
    const numBonesRaw = Number(anim.numBones);
    const numBones = Number.isFinite(numBonesRaw) && numBonesRaw > 0
      ? Math.floor(numBonesRaw)
      : bonesInput.length;
    const packed = flattenAnimFrames(frames, numBones);

    const floatSection = appendSection(
      chunks,
      offset,
      packed.floatBuffer,
      'float32',
      packed.floatBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    offset = floatSection.nextOffset;
    const activeSection = appendSection(
      chunks,
      offset,
      packed.activeBuffer,
      'uint8',
      packed.activeBuffer.byteLength,
    );
    offset = activeSection.nextOffset;
    sections.frames.push({
      offset: floatSection.section.offset,
      byteLength: floatSection.section.byteLength + activeSection.section.byteLength,
      type: 'mixed',
      numFrames: packed.numFrames,
      numBones,
      floatOffset: floatSection.section.offset,
      floatByteLength: floatSection.section.byteLength,
      activeOffset: activeSection.section.offset,
      activeByteLength: activeSection.section.byteLength,
      strideFloatsPerBone: 5,
      count: packed.numFrames * numBones,
    });
  }

  if (
    !sections.boneIndices &&
    !sections.boneWeights &&
    !sections.boneIndices4 &&
    !sections.boneWeights4 &&
    !sections.localMatrix &&
    sections.frames.length === 0
  ) {
    warnings.push(`图层 ${layerId} 没有可提取的 puppetAnimation 二进制数据`);
    return null;
  }

  const relPath = toSafePath(`buffers/${sanitizeName(layerId)}.anim.bin`);
  writeBinFileWithHeader(exportDir, relPath, {
    kind: 'animation',
    version: 1,
    bones: bonesMeta,
    animations: animationsMeta,
    sections,
  }, chunks);
  files.push(relPath);
  return {
    $bin: relPath,
    format: 'moyu-anim-bin-v1',
  };
}

function extractDescriptorBinaryData(
  descriptor: unknown,
  exportDir: string,
  files: string[],
  warnings: string[],
): unknown {
  if (!descriptor || typeof descriptor !== 'object') return descriptor;
  const root = descriptor as Record<string, unknown>;
  const layers = Array.isArray(root.layers) ? (root.layers as Array<Record<string, unknown>>) : null;
  if (!layers) return descriptor;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerId = typeof layer.id === 'string' && layer.id.length > 0 ? layer.id : `layer-${i}`;

    const puppetMeshRaw = layer.puppetMesh;
    if (puppetMeshRaw && typeof puppetMeshRaw === 'object') {
      const meshRef = extractMeshBin(layerId, puppetMeshRaw as Record<string, unknown>, exportDir, files, warnings);
      if (meshRef) {
        layer.puppetMesh = meshRef;
      }
    }

    const puppetAnimationRaw = layer.puppetAnimation;
    if (puppetAnimationRaw && typeof puppetAnimationRaw === 'object') {
      const animRef = extractAnimBin(
        layerId,
        puppetAnimationRaw as Record<string, unknown>,
        exportDir,
        files,
        warnings,
      );
      if (animRef) {
        layer.puppetAnimation = animRef;
      }
    }
  }
  return descriptor;
}

function extractShaders(descriptor: unknown, exportDir: string, files: string[]): unknown {
  if (!isRecord(descriptor)) return descriptor;
  const layers = Array.isArray(descriptor.layers) ? descriptor.layers : [];
  const contentToPath = new Map<string, string>();
  const pathToContent = new Map<string, string>();
  const written = new Set<string>();

  const getShaderPath = (source: string, ext: '.vert' | '.frag'): string => {
    const cacheKey = `${ext}:${source}`;
    const cached = contentToPath.get(cacheKey);
    if (cached) return cached;

    const hash = createHash('md5').update(source).digest('hex');
    let len = 8;
    let relPath = toSafePath(`shaders/${hash.slice(0, len)}${ext}`);
    while (pathToContent.has(relPath) && pathToContent.get(relPath) !== source && len < hash.length) {
      len += 2;
      relPath = toSafePath(`shaders/${hash.slice(0, len)}${ext}`);
    }
    contentToPath.set(cacheKey, relPath);
    pathToContent.set(relPath, source);
    return relPath;
  };

  for (const layer of layers) {
    if (!isRecord(layer) || !Array.isArray(layer.effectPasses)) continue;
    for (const passRaw of layer.effectPasses) {
      if (!isRecord(passRaw)) continue;
      const pairList: Array<['vertexShader' | 'fragmentShader', '$vertexShader' | '$fragmentShader', '.vert' | '.frag']> = [
        ['vertexShader', '$vertexShader', '.vert'],
        ['fragmentShader', '$fragmentShader', '.frag'],
      ];
      for (const [sourceKey, refKey, ext] of pairList) {
        const shaderSource = passRaw[sourceKey];
        if (typeof shaderSource !== 'string' || shaderSource.length === 0) continue;
        const relPath = getShaderPath(shaderSource, ext);
        if (!written.has(relPath)) {
          writeText(exportDir, relPath, shaderSource);
          files.push(relPath);
          written.add(relPath);
        }
        passRaw[refKey] = relPath;
        delete passRaw[sourceKey];
      }
    }
  }
  return descriptor;
}

function simplifyUniforms(descriptor: unknown): unknown {
  if (!isRecord(descriptor)) return descriptor;
  const layers = Array.isArray(descriptor.layers) ? descriptor.layers : [];
  for (const layer of layers) {
    if (!isRecord(layer) || !Array.isArray(layer.effectPasses)) continue;
    for (const passRaw of layer.effectPasses) {
      if (!isRecord(passRaw) || !isRecord(passRaw.uniforms)) continue;
      const uniforms = passRaw.uniforms;
      for (const [key, value] of Object.entries(uniforms)) {
        if (!isRecord(value)) continue;
        const id = value.id;
        if (typeof id === 'string' && id.length > 0 && '_texture' in value) {
          uniforms[key] = { $ref: id };
        }
      }
    }
  }
  return descriptor;
}

function stripDefaultsInPlace(target: JsonRecord, defaults: JsonRecord): void {
  EngineDefaults.stripDefaultsInPlace(target, defaults);
}

function stripDescriptorDefaults(descriptor: unknown, defaults: ExportDefaults): unknown {
  if (!isRecord(descriptor)) return descriptor;
  const layers = Array.isArray(descriptor.layers) ? descriptor.layers : [];
  const layerDefaults = defaults.layerDefaults;
  const commonDefaults = isRecord(layerDefaults._common) ? layerDefaults._common : null;

  for (const layerRaw of layers) {
    if (!isRecord(layerRaw)) continue;
    if (commonDefaults) stripDefaultsInPlace(layerRaw, commonDefaults);
    const kind = typeof layerRaw.kind === 'string' ? layerRaw.kind : '';
    const kindDefaults = isRecord(layerDefaults[kind]) ? (layerDefaults[kind] as JsonRecord) : null;
    if (kindDefaults) stripDefaultsInPlace(layerRaw, kindDefaults);

    if (kind === 'particle' && isRecord(layerRaw.emitter)) {
      stripDefaultsInPlace(layerRaw.emitter, defaults.emitterDefaults);
    }

    if (!Array.isArray(layerRaw.effectPasses)) continue;
    for (const passRaw of layerRaw.effectPasses) {
      if (!isRecord(passRaw) || !isRecord(passRaw.uniforms)) continue;
      stripDefaultsInPlace(passRaw.uniforms, defaults.uniformDefaults);
      if (Object.keys(passRaw.uniforms).length === 0) delete passRaw.uniforms;
    }
  }
  return descriptor;
}

function parseEffectFileFromDebugLabel(debugLabel: unknown): string | null {
  if (typeof debugLabel !== 'string' || debugLabel.length === 0) return null;
  const m = debugLabel.match(/\(([^)]+\/effect\.json)\)\s*$/i);
  if (!m?.[1]) return null;
  return toSafePath(m[1]);
}

function exportPkgResources(
  pkg: ReturnType<typeof parsePkg>,
  exportDir: string,
  files: string[],
  warnings: string[],
): void {
  const pkgFiles = listFiles(pkg);
  const emitted = new Set<string>();
  const emitFile = (relPath: string, bytes: Uint8Array): void => {
    const safePath = toSafePath(relPath);
    writeBinary(exportDir, safePath, bytes);
    if (!emitted.has(safePath)) {
      files.push(safePath);
      emitted.add(safePath);
    }
  };

  for (const entry of pkgFiles) {
    let safeEntry: string;
    try {
      safeEntry = toSafePath(entry);
    } catch {
      warnings.push(`跳过非法 PKG 路径: ${entry}`);
      continue;
    }
    const lower = safeEntry.toLowerCase();
    const ext = extname(lower);
    const data = extractFile(pkg, entry);
    if (!data) continue;

    if (ext === '.tex') {
      const tex = extractTex(data);
      const basePath = safeEntry.replace(/\.tex$/i, '');
      const relPath = toSafePath(`textures/${basePath}${tex.ext}`);
      emitFile(relPath, tex.bytes);
      if (tex.warning) warnings.push(`${safeEntry}: ${tex.warning}`);
      continue;
    }

    if (AUDIO_EXTS.has(ext)) {
      const relPath = toSafePath(`audio/${safeEntry}`);
      emitFile(relPath, data);
    }
  }
}

function isDefaultControlPoint(cp: unknown, idx: number): boolean {
  if (!isRecord(cp)) return false;
  if (cp.id !== idx) return false;
  if (cp.linkMouse !== false || cp.worldSpace !== false) return false;
  if (!isRecord(cp.offset)) return false;
  return cp.offset.x === 0 && cp.offset.y === 0 && cp.offset.z === 0;
}

function pruneNulls(value: unknown): unknown {
  return EngineDefaults.pruneNil(value);
}

function roundNumericValues(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value;
    if (Number.isInteger(value)) return value;
    return parseFloat(value.toPrecision(6));
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = roundNumericValues(value[i]);
    }
    return value;
  }
  if (!isRecord(value)) return value;
  for (const key of Object.keys(value)) {
    value[key] = roundNumericValues(value[key]);
  }
  return value;
}

function cleanupDescriptorData(descriptor: unknown): unknown {
  if (!isRecord(descriptor)) return descriptor;
  const layers = Array.isArray(descriptor.layers) ? descriptor.layers : [];
  const preferredLayerFieldOrder = [
    'id',
    'name',
    'kind',
    'parentId',
    'size',
    'origin',
    'zIndex',
    'scale',
    'angles',
    'attachment',
  ];

  for (let i = 0; i < layers.length; i++) {
    const layerRaw = layers[i];
    if (!isRecord(layerRaw)) continue;
    if (Array.isArray(layerRaw.sourceSize) && layerRaw.sourceSize.length >= 2) {
      layerRaw.size = layerRaw.sourceSize;
      delete layerRaw.sourceSize;
    }
    if (Array.isArray(layerRaw.sourceOrigin) && layerRaw.sourceOrigin.length >= 2) {
      layerRaw.origin = layerRaw.sourceOrigin;
      delete layerRaw.sourceOrigin;
    }
    if (Array.isArray(layerRaw.weRelativeOrigin) && layerRaw.weRelativeOrigin.length >= 2) {
      const rel: [number, number] = [Number(layerRaw.weRelativeOrigin[0]), Number(layerRaw.weRelativeOrigin[1])];
      layerRaw.origin = rel;
    }
    if (typeof layerRaw.weParentId === 'string' && layerRaw.weParentId.length > 0) {
      layerRaw.parentId = layerRaw.weParentId;
    }
    if (typeof layerRaw.weAttachment === 'string' && layerRaw.weAttachment.length > 0) {
      layerRaw.attachment = layerRaw.weAttachment;
    }
    if (Array.isArray(layerRaw.sourceScale) && layerRaw.sourceScale.length >= 3) {
      layerRaw.scale = layerRaw.sourceScale;
      delete layerRaw.sourceScale;
    }
    if (Array.isArray(layerRaw.sourceAngles) && layerRaw.sourceAngles.length >= 3) {
      layerRaw.angles = layerRaw.sourceAngles;
      delete layerRaw.sourceAngles;
    }
    delete layerRaw.coverScale;
    delete layerRaw.sceneOffset;
    delete layerRaw.weRelativeOrigin;
    delete layerRaw.weParentId;
    delete layerRaw.weAttachment;
    if (Array.isArray(layerRaw.size) && layerRaw.size.length >= 2) {
      delete layerRaw.width;
      delete layerRaw.height;
    }
    if (Array.isArray(layerRaw.origin) && layerRaw.origin.length >= 2) {
      delete layerRaw.x;
      delete layerRaw.y;
    }
    if (isRecord(layerRaw.transform)) {
      const sourceScale = layerRaw.transform.sourceScale;
      const sourceAngles = layerRaw.transform.sourceAngles;
      if (Array.isArray(sourceScale) && sourceScale.length >= 3) {
        layerRaw.scale = sourceScale;
      }
      if (Array.isArray(sourceAngles) && sourceAngles.length >= 3) {
        layerRaw.angles = sourceAngles;
      }
      delete layerRaw.transform;
    }
    delete layerRaw.runtimeTransform;
    if (typeof layerRaw.source === 'string' && layerRaw.source.startsWith('blob:')) {
      delete layerRaw.source;
    }
    if (typeof layerRaw.texture === 'string' && layerRaw.texture.startsWith('blob:')) {
      delete layerRaw.texture;
    }
    if (Array.isArray(layerRaw.effectFbos) && layerRaw.effectFbos.length === 0) {
      delete layerRaw.effectFbos;
    }
    // texture size is runtime-FBO concern, not level-data concern
    delete layerRaw.textureSize;
    if (Array.isArray(layerRaw.controlPointAttracts) && layerRaw.controlPointAttracts.length === 0) {
      delete layerRaw.controlPointAttracts;
    }
    if (
      Array.isArray(layerRaw.controlPoints) &&
      layerRaw.controlPoints.length === 8 &&
      layerRaw.controlPoints.every((cp: unknown, idx: number) => isDefaultControlPoint(cp, idx))
    ) {
      delete layerRaw.controlPoints;
    }

    if (Array.isArray(layerRaw.effectPasses)) {
      for (const passRaw of layerRaw.effectPasses) {
        if (!isRecord(passRaw)) continue;
        const effectFile = parseEffectFileFromDebugLabel(passRaw.debugLabel);
        if (effectFile) passRaw.effectFile = effectFile;
        delete passRaw.debugLabel;
        if (passRaw.command === 'render') delete passRaw.command;

        if (!isRecord(passRaw.uniforms)) continue;
        const uniforms = passRaw.uniforms;
        if (uniforms.g_Time === 0) delete uniforms.g_Time;
        for (const key of Object.keys(uniforms)) {
          if (TEXTURE_RESOLUTION_UNIFORM_PATTERN.test(key) || /^g_Texture\d+$/i.test(key)) {
            delete uniforms[key];
          }
        }
        if (Object.keys(uniforms).length === 0) delete passRaw.uniforms;
      }
    }

    const orderedLayer: Record<string, unknown> = {};
    for (const key of preferredLayerFieldOrder) {
      if (Object.prototype.hasOwnProperty.call(layerRaw, key)) {
        orderedLayer[key] = layerRaw[key];
      }
    }
    for (const key of Object.keys(layerRaw)) {
      if (!Object.prototype.hasOwnProperty.call(orderedLayer, key)) {
        orderedLayer[key] = layerRaw[key];
      }
    }
    layers[i] = orderedLayer;
  }

  return pruneNulls(descriptor);
}

function nextAvailableRelPath(
  preferredRelPath: string,
  usedPaths: Set<string>,
): string {
  let candidate = toSafePath(preferredRelPath);
  if (!usedPaths.has(candidate)) return candidate;

  const dot = candidate.lastIndexOf('.');
  const ext = dot >= 0 ? candidate.slice(dot) : '';
  const stem = dot >= 0 ? candidate.slice(0, dot) : candidate;
  let suffix = 1;
  while (usedPaths.has(candidate)) {
    candidate = toSafePath(`${stem}_${suffix}${ext}`);
    suffix += 1;
  }
  return candidate;
}

function extractLayers(descriptor: unknown, exportDir: string, files: string[]): unknown {
  if (!isRecord(descriptor)) return descriptor;
  const layers = Array.isArray(descriptor.layers) ? descriptor.layers : [];
  const refs: unknown[] = [];
  const usedPaths = new Set<string>(files);

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!isRecord(layer)) {
      refs.push(layer);
      continue;
    }

    const id = typeof layer.id === 'string' && layer.id.length > 0 ? layer.id : `layer-${i}`;
    const baseName = sanitizeName(id);
    const relPath = nextAvailableRelPath(`layers/${baseName}.json`, usedPaths);
    usedPaths.add(relPath);

    writeJson(exportDir, relPath, layer);
    files.push(relPath);
    refs.push({ $ref: relPath });
  }

  descriptor.layers = refs;
  return descriptor;
}

export function exportWallpaperData(projectRoot: string, payload: ExportRequestPayload): ExportResult {
  const wallpaperDir = resolveWallpaperDir(projectRoot, payload.wallpaperPath);
  const exportDir = join(wallpaperDir, 'exported');
  rmSync(exportDir, { recursive: true, force: true });
  ensureDir(exportDir);

  const warnings: string[] = [];
  const files: string[] = [];
  const exportDefaults = loadExportDefaults(projectRoot, warnings);
  let pkgName: string | null = null;

  const projectPath = join(wallpaperDir, 'project.json');
  let projectJson: ProjectJsonLite | null = null;
  try {
    projectJson = JSON.parse(readFileSync(projectPath, 'utf-8')) as ProjectJsonLite;
    writeJson(exportDir, 'project.json', projectJson);
    files.push('project.json');
  } catch (error) {
    warnings.push(`读取 project.json 失败: ${(error as Error).message}`);
  }

  const sceneFile = projectJson?.file || 'scene.json';
  pkgName = sceneFile.replace(/\.json$/i, '.pkg');
  const pkgPath = join(wallpaperDir, pkgName);
  try {
    const pkgBuffer = readFileSync(pkgPath);
    const pkgData = pkgBuffer.buffer.slice(pkgBuffer.byteOffset, pkgBuffer.byteOffset + pkgBuffer.byteLength) as ArrayBuffer;
    const pkg = parsePkg(pkgData);
    exportPkgResources(pkg, exportDir, files, warnings);
  } catch (error) {
    warnings.push(`读取场景包失败(${pkgName ?? 'unknown'}): ${(error as Error).message}`);
  }

  if (payload.descriptor !== undefined) {
    let descriptorData: unknown = payload.descriptor;
    descriptorData = simplifyUniforms(descriptorData);
    descriptorData = stripDescriptorDefaults(descriptorData, exportDefaults);
    descriptorData = extractDescriptorBinaryData(descriptorData, exportDir, files, warnings);
    descriptorData = extractShaders(descriptorData, exportDir, files);
    descriptorData = cleanupDescriptorData(descriptorData);
    descriptorData = roundNumericValues(descriptorData);
    descriptorData = extractLayers(descriptorData, exportDir, files);
    writeJson(exportDir, 'descriptor.json', descriptorData);
    files.push('descriptor.json');
  }

  const manifestFiles = [...files, 'manifest.json'];
  const manifest: ExportManifest = {
    generatedAt: new Date().toISOString(),
    wallpaperPath: payload.wallpaperPath,
    wallpaperTitle: projectJson?.title || 'Unknown',
    pkgName: projectJson ? pkgName : null,
    fileCount: manifestFiles.length,
    files: manifestFiles,
    warnings,
  };
  writeJson(exportDir, 'manifest.json', manifest);

  return {
    exportPath: exportDir,
    fileCount: manifestFiles.length,
    warnings,
  };
}
