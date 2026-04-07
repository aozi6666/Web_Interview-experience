import { logLoaderVerbose } from '../LoaderUtils';

const console = { ...globalThis.console, log: logLoaderVerbose };

/**
 * Wallpaper Engine MDL (Puppet Warp) 文件解析器
 *
 * MDL 是 WE 的 puppet warp 网格文件格式（二进制）。
 * 文件由严格顺序排列的段落组成，不需要扫描。
 *
 * ═══════════════════════════════════════════════════════════════
 *  整体布局（v0021+ / v0023）
 * ═══════════════════════════════════════════════════════════════
 *
 *  ┌─── MDLV Header ───────────────────────────────────────────┐
 *  │ CHAR[]   magic         "MDLVxxxx\0" (9 bytes)             │
 *  │ UINT32   headerFlag    通常 0x01800009                    │
 *  │ UINT32   meshCount     通常 1                             │
 *  │ UINT32   unknown1      通常 1                             │
 *  │ CHAR[]   materialPath  null-terminated                    │
 *  │ UINT32[7] metadata     全零 (v0021+) / 无 (v0016)        │
 *  │ UINT32   vertexFormat  步幅描述符 (v0021+) / 同headerFlag │
 *  │ UINT32   vertexByteLength                                 │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── Vertex Data ───────────────────────────────────────────┐
 *  │ VERTEX[vertexCount]   (stride × vertexCount bytes)        │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── Index Data ────────────────────────────────────────────┐
 *  │ UINT32   indicesByteLength                                │
 *  │ UINT16[] indices                                          │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── Post-Index Data (v0021+ only) ────────────────────────┐
 *  │ UINT8 morphTargetCount (0=无, 1+=有morph)                 │
 *  │ [per target: UINT32 unk + UINT32 byteLen + data]          │
 *  │ Bone Partition: UINT8(0x01) + UINT32 len + entries + u32  │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── MDLS Section (骨骼) ───────────────────────────────────┐
 *  │ CHAR[]   "MDLSxxxx\0"                                     │
 *  │ UINT32   byteLength                                       │
 *  │ UINT32   numBones                                         │
 *  │ BONEENTRY[numBones]                                       │
 *  │ BONE2ENTRY[numBones]  (每个 9 bytes)                      │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── MDAT Section (附着点, optional) ──────────────────────┐
 *  │ CHAR[]   "MDATxxxx\0"                                     │
 *  │ ...                                                       │
 *  └───────────────────────────────────────────────────────────┘
 *  ┌─── MDLA Section (动画, optional) ────────────────────────┐
 *  │ CHAR[]   "MDLAxxxx\0"                                     │
 *  │ ...                                                       │
 *  └───────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════
 *  v0016 布局差异
 * ═══════════════════════════════════════════════════════════════
 *  - materialPath 后只有 2 个 DWORD (padding + vertexFormat)
 *  - 无 morph targets / bone partition
 *  - MDLS 紧跟索引数据
 *  - stride = 52
 *  - MDLS 版本为 "MDLS0002"
 */

import {
  DEFAULT_BONE_CONSTRAINT,
  parseConstraintFromUnknown,
  type BoneConstraintConfig,
} from 'moyu-engine/avatar/puppet/rig/BoneConstraint';
import type { MdlAnimBoneFrame, MdlAnimation, MdlBoneData } from 'moyu-engine/avatar/puppet/types';
import { parseSections as parseSectionsImpl } from './MdlSectionParser';
import { parseMdlMesh } from './MdlMeshParser';

// ═══════════════════════════════════════════════════════════════
//  导出接口 (保持不变)
// ═══════════════════════════════════════════════════════════════

export type { MdlAnimBoneFrame, MdlAnimation, MdlBoneData };

export interface PuppetMeshData {
  /** 顶点位置 [x0, y0, z0, x1, y1, z1, ...] - 以图像中心为原点 */
  vertices: Float32Array;
  /** UV 坐标 [u0, v0, u1, v1, ...] */
  uvs: Float32Array;
  /** 三角形索引 */
  indices: Uint16Array;
  /** 顶点数 */
  vertexCount: number;
  /** 三角形数 */
  triangleCount: number;
  /** 附着点映射: 附着点名称 → 骨骼世界坐标 (图像中心坐标系) */
  attachments?: Map<string, [number, number]>;
  /** 每顶点骨骼索引 (主骨骼, length = vertexCount) */
  boneIndices?: Uint8Array;
  /** 每顶点混合权重 (对应 boneIndices, length = vertexCount) */
  boneWeights?: Float32Array;
  /** 每顶点 4 路骨骼索引 (length = vertexCount * 4) */
  boneIndices4?: Uint16Array;
  /** 每顶点 4 路混合权重 (length = vertexCount * 4) */
  boneWeights4?: Float32Array;
  /** 骨骼数据 (来自 MDLS 段) */
  bones?: MdlBoneData[];
  /** 动画数据 (来自 MDLA 段) */
  animations?: MdlAnimation[];
  /** 变形目标（morph targets） */
  morphTargets?: Array<{
    name: string;
    vertices: Float32Array;
  }>;
}

// ═══════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 读取 null-terminated 字符串（UTF-8）
 * @returns [解析的字符串, 新的偏移位置（null后一字节）]
 */
function readNullTermString(data: Uint8Array, offset: number): [string, number] {
  let end = offset;
  while (end < data.length && data[end] !== 0) end++;
  const bytes = data.slice(offset, end);
  const str = new TextDecoder('utf-8').decode(bytes);
  return [str, end + 1]; // +1 跳过 null terminator
}

/**
 * 检查从 pos 开始的 4 字节是否匹配给定标记
 */
function matchTag(data: Uint8Array, pos: number, tag: string): boolean {
  if (pos + 4 > data.length) return false;
  return data[pos] === tag.charCodeAt(0) &&
         data[pos + 1] === tag.charCodeAt(1) &&
         data[pos + 2] === tag.charCodeAt(2) &&
         data[pos + 3] === tag.charCodeAt(3);
}

function parseBoneNamePayload(rawName: string): { displayName: string; constraint: BoneConstraintConfig | undefined } {
  const trimmed = rawName.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return { displayName: rawName, constraint: undefined };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const displayName =
      typeof parsed.name === 'string' ? parsed.name :
      typeof parsed.boneName === 'string' ? parsed.boneName :
      typeof parsed.displayName === 'string' ? parsed.displayName :
      rawName;
    return {
      displayName,
      constraint: parseConstraintFromUnknown(parsed) ?? { ...DEFAULT_BONE_CONSTRAINT },
    };
  } catch {
    return { displayName: rawName, constraint: undefined };
  }
}

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 解析 MDL puppet mesh 文件
 *
 * @param buffer MDL 文件的 ArrayBuffer
 * @returns 解析后的 puppet mesh 数据，或 null（如果格式不支持）
 */
export function parseMdl(buffer: ArrayBuffer): PuppetMeshData | null {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // ==================== 1. 解析 MDLV Header ====================

  if (data.length < 16) return null;

  // 读取 magic + version (null-terminated string, 9 bytes: "MDLVxxxx\0")
  const [headerStr, posAfterMagic] = readNullTermString(data, 0);
  if (!headerStr.startsWith('MDLV')) {
    console.warn('MDL: 不是有效的 MDL 文件，魔数:', headerStr);
    return null;
  }

  const version = headerStr.substring(4); // "0016", "0021", "0023", etc.
  const versionNum = parseInt(version, 10) || 0;
  console.log('MDL: 版本', version);

  const meshResult = parseMdlMesh(data, view, posAfterMagic, versionNum, {
    readNullTermString,
    matchTag,
  });
  if (!meshResult) return null;
  const sectionResult = parseSectionsImpl(data, view, meshResult.pos, {
    readNullTermString,
    matchTag,
    parseBoneNamePayload,
  });

  return {
    vertices: meshResult.vertices,
    uvs: meshResult.uvs,
    indices: meshResult.indices,
    vertexCount: meshResult.vertexCount,
    triangleCount: meshResult.triangleCount,
    attachments: sectionResult?.attachments,
    boneIndices: meshResult.hasBlendData ? meshResult.boneIndices : undefined,
    boneWeights: meshResult.hasBlendData ? meshResult.boneWeights : undefined,
    boneIndices4: meshResult.hasBlendData ? meshResult.boneIndices4 : undefined,
    boneWeights4: meshResult.hasBlendData ? meshResult.boneWeights4 : undefined,
    bones: sectionResult?.bones,
    animations: sectionResult?.animations,
    morphTargets: meshResult.morphTargets,
  };
}

