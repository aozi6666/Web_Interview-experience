type ReadNullTermString = (data: Uint8Array, offset: number) => [string, number];
type MatchTag = (data: Uint8Array, pos: number, tag: string) => boolean;

const VERTEX_FORMAT_STRIDE: Record<number, number> = {
  0x01800009: 52,
  0x0180000f: 80,
  0x0181000e: 84,
};

export interface MdlMeshParseResult {
  pos: number;
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  triangleCount: number;
  hasBlendData: boolean;
  boneIndices: Uint8Array;
  boneWeights: Float32Array;
  boneIndices4: Uint16Array;
  boneWeights4: Float32Array;
  morphTargets?: Array<{ name: string; vertices: Float32Array }>;
}

function skipPostIndexData(
  data: Uint8Array,
  view: DataView,
  startPos: number,
  vertexCount: number,
  versionNum: number,
  matchTag: MatchTag,
): { pos: number; morphTargets?: Array<{ name: string; vertices: Float32Array }> } {
  let pos = startPos;
  const morphTargets: Array<{ name: string; vertices: Float32Array }> = [];
  if (versionNum < 21) return { pos };
  if (matchTag(data, pos, 'MDLS')) return { pos };
  if (pos >= data.length) return { pos };
  const morphTargetCount = data[pos]; pos += 1;
  if (morphTargetCount > 0) {
    for (let mi = 0; mi < morphTargetCount; mi++) {
      if (pos + 8 > data.length) return { pos, morphTargets: morphTargets.length > 0 ? morphTargets : undefined };
      pos += 4; // morphUnk
      const morphByteLength = view.getUint32(pos, true); pos += 4;
      const morphStart = pos;
      const available = Math.max(0, Math.min(morphByteLength, data.length - morphStart));
      const expected = vertexCount * 12;
      if (available >= expected) {
        const morphVertices = new Float32Array(vertexCount * 3);
        for (let vi = 0; vi < vertexCount; vi++) {
          const off = morphStart + vi * 12;
          morphVertices[vi * 3] = view.getFloat32(off, true);
          morphVertices[vi * 3 + 1] = view.getFloat32(off + 4, true);
          morphVertices[vi * 3 + 2] = view.getFloat32(off + 8, true);
        }
        morphTargets.push({ name: `morph_${mi}`, vertices: morphVertices });
      }
      pos += morphByteLength;
    }
  }
  if (matchTag(data, pos, 'MDLS')) return { pos, morphTargets: morphTargets.length > 0 ? morphTargets : undefined };
  if (pos + 5 > data.length) return { pos, morphTargets: morphTargets.length > 0 ? morphTargets : undefined };
  const bpFlag = data[pos]; pos += 1;
  if (bpFlag !== 0x01) {
    console.warn(`MDL: 期望 bone partition flag=0x01, 实际=0x${bpFlag.toString(16)}`);
    return { pos: pos - 1, morphTargets: morphTargets.length > 0 ? morphTargets : undefined };
  }
  const partitionByteLength = view.getUint32(pos, true); pos += 4;
  pos += partitionByteLength;
  if (versionNum >= 23 && pos + 4 <= data.length) {
    pos += 4;
  }
  if (!matchTag(data, pos, 'MDLS') && pos + 4 < data.length) {
    const savedPos = pos;
    for (let scan = pos; scan < Math.min(pos + 256, data.length - 4); scan++) {
      if (matchTag(data, scan, 'MDLS')) {
        pos = scan;
        break;
      }
    }
    if (pos === savedPos) {
      // no-op
    }
  }
  return { pos, morphTargets: morphTargets.length > 0 ? morphTargets : undefined };
}

export function parseMdlMesh(
  data: Uint8Array,
  view: DataView,
  posAfterMagic: number,
  versionNum: number,
  hooks: {
    readNullTermString: ReadNullTermString;
    matchTag: MatchTag;
  },
): MdlMeshParseResult | null {
  let pos = posAfterMagic;
  if (pos + 12 > data.length) {
    console.warn('MDL: 文件过短，无法读取头部');
    return null;
  }
  const headerFlag = view.getUint32(pos, true); pos += 4;
  void headerFlag;
  pos += 4; // meshCount
  pos += 4; // unknown1
  const [, posAfterMat] = hooks.readNullTermString(data, pos);
  pos = posAfterMat;

  let vertexFormat: number;
  let vertexByteLength: number;
  if (versionNum >= 19) {
    if (pos + 36 > data.length) {
      console.warn('MDL: 文件过短，无法读取 v0019+ header 字段');
      return null;
    }
    pos += 28;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  } else {
    if (pos + 12 > data.length) {
      console.warn('MDL: 文件过短，无法读取 v0016 header 字段');
      return null;
    }
    pos += 4;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  }

  let stride = VERTEX_FORMAT_STRIDE[vertexFormat];
  if (!stride) {
    for (const tryStride of [80, 84, 52]) {
      if (vertexByteLength % tryStride === 0) {
        const vc = vertexByteLength / tryStride;
        if (vc >= 3 && vc < 1000000) {
          stride = tryStride;
          break;
        }
      }
    }
    if (!stride) {
      console.warn(`MDL: 未知 vertexFormat=0x${vertexFormat.toString(16)}，无法确定步幅`);
      return null;
    }
    console.warn(`MDL: 未知 vertexFormat=0x${vertexFormat.toString(16)}，从 vertexByteLength=${vertexByteLength} 推断步幅=${stride}`);
  }

  const vertexCount = vertexByteLength / stride;
  if (!Number.isInteger(vertexCount) || vertexCount < 3 || vertexCount > 1000000) {
    console.warn(`MDL: 无效的顶点数: ${vertexCount} (vertexByteLength=${vertexByteLength}, stride=${stride})`);
    return null;
  }
  const vertexDataStart = pos;
  if (vertexDataStart + vertexByteLength > data.length) {
    console.warn('MDL: 文件过短，无法读取顶点数据');
    return null;
  }

  const vertices = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const boneIndices = new Uint8Array(vertexCount);
  const boneWeights = new Float32Array(vertexCount);
  const boneIndices4 = new Uint16Array(vertexCount * 4);
  const boneWeights4 = new Float32Array(vertexCount * 4);
  const uvOffset = stride - 8;
  const hasBlendData = stride >= 52;

  for (let i = 0; i < vertexCount; i++) {
    const off = vertexDataStart + i * stride;
    vertices[i * 3] = view.getFloat32(off, true);
    vertices[i * 3 + 1] = view.getFloat32(off + 4, true);
    vertices[i * 3 + 2] = view.getFloat32(off + 8, true);
    uvs[i * 2] = view.getFloat32(off + uvOffset, true);
    uvs[i * 2 + 1] = 1 - view.getFloat32(off + uvOffset + 4, true);
    if (hasBlendData) {
      if (stride >= 80) {
        for (let k = 0; k < 4; k++) {
          boneIndices4[i * 4 + k] = view.getUint32(off + 40 + k * 4, true) & 0xffff;
          const w = view.getFloat32(off + 56 + k * 4, true);
          boneWeights4[i * 4 + k] = Number.isFinite(w) && w >= 0 && w <= 1 ? w : 0;
        }
      } else {
        for (let k = 0; k < 4; k++) {
          boneIndices4[i * 4 + k] = view.getUint32(off + 12 + k * 4, true) & 0xffff;
          const w = view.getFloat32(off + 28 + k * 4, true);
          boneWeights4[i * 4 + k] = Number.isFinite(w) && w >= 0 && w <= 1 ? w : 0;
        }
      }
      boneIndices[i] = boneIndices4[i * 4] & 0xff;
      boneWeights[i] = boneWeights4[i * 4];
      if (!Number.isFinite(boneWeights[i]) || boneWeights[i] < 0 || boneWeights[i] > 1) {
        boneWeights[i] = 1.0;
      }
    } else {
      boneIndices[i] = 0;
      boneWeights[i] = 1.0;
      boneIndices4[i * 4] = 0;
      boneWeights4[i * 4] = 1.0;
      boneIndices4[i * 4 + 1] = 0;
      boneWeights4[i * 4 + 1] = 0;
      boneIndices4[i * 4 + 2] = 0;
      boneWeights4[i * 4 + 2] = 0;
      boneIndices4[i * 4 + 3] = 0;
      boneWeights4[i * 4 + 3] = 0;
    }
  }

  pos = vertexDataStart + vertexByteLength;
  if (pos + 4 > data.length) {
    console.warn('MDL: 文件过短，无法读取索引字节长度');
    return null;
  }
  const indicesByteLength = view.getUint32(pos, true); pos += 4;
  const rawIndexCount = Math.floor(indicesByteLength / 2);
  const indexDataStart = pos;
  if (pos + indicesByteLength > data.length) {
    console.warn('MDL: 文件过短，无法读取索引数据');
    return null;
  }
  const validIndices: number[] = [];
  for (let i = 0; i + 2 < rawIndexCount; i += 3) {
    const off = indexDataStart + i * 2;
    const i0 = view.getUint16(off, true);
    const i1 = view.getUint16(off + 2, true);
    const i2 = view.getUint16(off + 4, true);
    if (i0 < vertexCount && i1 < vertexCount && i2 < vertexCount &&
        i0 !== i1 && i1 !== i2 && i0 !== i2) {
      validIndices.push(i0, i1, i2);
    }
  }
  const indices = new Uint16Array(validIndices);
  const triangleCount = indices.length / 3;
  console.log(`MDL: 顶点=${vertexCount}, 有效三角形=${triangleCount}/${Math.floor(rawIndexCount / 3)}, 步幅=${stride}`);
  pos = indexDataStart + indicesByteLength;

  let morphTargets: Array<{ name: string; vertices: Float32Array }> | undefined;
  if (versionNum >= 21) {
    const postIndexResult = skipPostIndexData(data, view, pos, vertexCount, versionNum, hooks.matchTag);
    pos = postIndexResult.pos;
    morphTargets = postIndexResult.morphTargets;
  }

  return {
    pos,
    vertices,
    uvs,
    indices,
    vertexCount,
    triangleCount,
    hasBlendData,
    boneIndices,
    boneWeights,
    boneIndices4,
    boneWeights4,
    morphTargets,
  };
}
