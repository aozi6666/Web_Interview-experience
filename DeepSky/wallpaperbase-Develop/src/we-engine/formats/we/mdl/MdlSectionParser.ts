import type { MdlAnimation, MdlBoneData } from './MdlLoader';
import { cleanAnimationData, parseMdlaSection } from './MdlAnimationParser';

type ReadNullTermString = (data: Uint8Array, offset: number) => [string, number];
type MatchTag = (data: Uint8Array, pos: number, tag: string) => boolean;
type ParseBoneNamePayload = (rawName: string) => { displayName: string; constraint: unknown | undefined };

export interface MdlSectionsResult {
  attachments: Map<string, [number, number]> | undefined;
  bones: MdlBoneData[] | undefined;
  animations: MdlAnimation[] | undefined;
}

interface MdlSectionHooks {
  readNullTermString: ReadNullTermString;
  matchTag: MatchTag;
  parseBoneNamePayload: ParseBoneNamePayload;
}

function parseMdatSection(
  data: Uint8Array,
  view: DataView,
  startPos: number,
  numBones: number,
  boneWorldPos: [number, number][],
  readNullTermString: ReadNullTermString,
): { attachments: Map<string, [number, number]> | undefined; endPos: number } {
  let pos = startPos;
  const [, posAfterHeader] = readNullTermString(data, pos);
  pos = posAfterHeader;
  if (pos + 8 > data.length) return { attachments: undefined, endPos: pos };
  const mdatByteLen = view.getUint32(pos, true); pos += 4;
  const mdatEndAbsolute = (mdatByteLen > startPos && mdatByteLen <= data.length) ? mdatByteLen : null;
  const mdatEndRelative = (posAfterHeader + mdatByteLen <= data.length) ? (posAfterHeader + mdatByteLen) : null;
  const mdatEnd = mdatEndAbsolute ?? mdatEndRelative ?? data.length;
  const numAttachments = view.getUint16(pos, true); pos += 2;
  if (numAttachments > 500) {
    return { attachments: undefined, endPos: pos };
  }
  const attachments = new Map<string, [number, number]>();
  for (let ai = 0; ai < numAttachments; ai++) {
    if (pos + 2 >= mdatEnd) break;
    const boneIdx = data[pos]; pos += 2;
    let name: string;
    [name, pos] = readNullTermString(data, pos);
    if (pos + 64 > data.length) break;
    const localOffset = {
      x: view.getFloat32(pos + 12 * 4, true),
      y: view.getFloat32(pos + 13 * 4, true),
    };
    pos += 64;
    if (boneIdx < numBones && boneWorldPos[boneIdx]) {
      attachments.set(name, [
        boneWorldPos[boneIdx][0] + localOffset.x,
        boneWorldPos[boneIdx][1] + localOffset.y,
      ]);
    }
  }
  pos = mdatEnd;
  return {
    attachments: attachments.size > 0 ? attachments : undefined,
    endPos: pos,
  };
}

export function parseSections(
  data: Uint8Array,
  view: DataView,
  startPos: number,
  hooks: MdlSectionHooks,
): MdlSectionsResult | null {
  let pos = startPos;
  if (pos + 4 >= data.length) return null;
  if (!hooks.matchTag(data, pos, 'MDLS')) {
    console.warn(`MDL: 期望 MDLS 标记，实际: "${String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3])}"`);
    return null;
  }
  const [, posAfterMdlsHeader] = hooks.readNullTermString(data, pos);
  pos = posAfterMdlsHeader;
  if (pos + 8 > data.length) return null;
  const mdlsByteLen = view.getUint32(pos, true); pos += 4;
  const numBones = view.getUint32(pos, true); pos += 4;
  const mdlsNextByAbsolute = (mdlsByteLen > startPos && mdlsByteLen <= data.length) ? mdlsByteLen : null;
  const mdlsNextByRelative = (posAfterMdlsHeader + mdlsByteLen <= data.length) ? (posAfterMdlsHeader + mdlsByteLen) : null;
  if (numBones > 500) {
    console.warn(`MDL: 骨骼数量异常: ${numBones}`);
    return null;
  }
  const bones: MdlBoneData[] = [];
  for (let bi = 0; bi < numBones; bi++) {
    if (pos + 9 > data.length) {
      console.warn(`MDL: 文件过短，无法读取骨骼 ${bi}`);
      return null;
    }
    pos += 1;
    pos += 4;
    const parentIdx = view.getInt32(pos, true); pos += 4;
    if (pos + 4 > data.length) return null;
    const entryByteLen = view.getUint32(pos, true); pos += 4;
    const localMatrix = new Float32Array(16);
    let tx = 0; let ty = 0;
    if (pos + entryByteLen <= data.length) {
      const floatCount = Math.min(entryByteLen / 4, 16);
      for (let m = 0; m < floatCount; m++) {
        localMatrix[m] = view.getFloat32(pos + m * 4, true);
      }
      if (floatCount >= 14) {
        tx = localMatrix[12];
        ty = localMatrix[13];
      }
    }
    pos += entryByteLen;
    if (pos >= data.length) return null;
    let boneName: string;
    [boneName, pos] = hooks.readNullTermString(data, pos);
    const parsedName = hooks.parseBoneNamePayload(boneName);
    bones.push({
      name: parsedName.displayName,
      parentIndex: parentIdx,
      local: { x: tx, y: ty },
      localMatrix,
      displayName: parsedName.displayName,
      rawName: boneName,
      constraint: parsedName.constraint as MdlBoneData['constraint'],
    });
  }
  const boneWorldPos: [number, number][] = new Array(numBones);
  for (let bi = 0; bi < numBones; bi++) {
    const b = bones[bi];
    const pi = b.parentIndex;
    if (pi >= 0 && pi < numBones && boneWorldPos[pi]) {
      boneWorldPos[bi] = [boneWorldPos[pi][0] + b.local.x, boneWorldPos[pi][1] + b.local.y];
    } else {
      boneWorldPos[bi] = [b.local.x, b.local.y];
    }
  }
  for (let bi = 0; bi < numBones; bi++) {
    if (pos + 9 > data.length) break;
    pos += 9;
  }
  if (mdlsNextByAbsolute !== null && mdlsNextByAbsolute >= pos) {
    pos = mdlsNextByAbsolute;
  } else if (mdlsNextByRelative !== null && mdlsNextByRelative >= pos) {
    pos = mdlsNextByRelative;
  }
  let attachments: Map<string, [number, number]> | undefined;
  let animations: MdlAnimation[] | undefined;
  if (pos + 4 < data.length && hooks.matchTag(data, pos, 'MDAT')) {
    const result = parseMdatSection(data, view, pos, numBones, boneWorldPos, hooks.readNullTermString);
    attachments = result.attachments;
    pos = result.endPos;
  }
  if (pos + 4 < data.length && hooks.matchTag(data, pos, 'MDLA')) {
    animations = parseMdlaSection(data, view, pos, hooks.readNullTermString);
  }
  if (animations && bones) {
    cleanAnimationData(animations, bones);
  }
  if (numBones > 0) {
    console.log(`MDL: 解析到 ${numBones} 个骨骼, ${attachments?.size ?? 0} 个附着点, ${animations?.length ?? 0} 个动画`);
  }
  return { attachments, bones, animations };
}
