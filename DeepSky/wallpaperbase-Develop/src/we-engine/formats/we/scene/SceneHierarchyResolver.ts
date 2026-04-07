import { extractFile, extractJsonFile, parsePkg } from '../PkgLoader';
import type { ProjectJson, SceneObject } from '../LoaderTypes';
import { getScriptFieldValue, parseScaleVector3, parseVector2, resolveUserProperty } from '../LoaderUtils';

type PkgData = ReturnType<typeof parsePkg>;

interface AttachmentInfo {
  boneIndex: number;
  localOffsetX: number;
  localOffsetY: number;
  restPosX: number;
  restPosY: number;
}

function isVerboseLoaderLogEnabled(): boolean {
  return (globalThis as { __WE_VERBOSE_LOGS?: boolean }).__WE_VERBOSE_LOGS === true;
}

function logLoaderVerbose(...args: unknown[]): void {
  if (isVerboseLoaderLogEnabled()) {
    console.log(...args);
  }
}

function parseParentOrigin(originData: unknown): [number, number] | null {
  const resolved = getScriptFieldValue(originData);
  return parseVector2(resolved as [number, number] | string | undefined);
}

function resolveParallaxDepth(
  rawValue: unknown,
  projectJson: ProjectJson | null,
): [number, number] | null {
  const unwrapped = resolveUserProperty(getScriptFieldValue(rawValue), projectJson);
  return parseVector2(unwrapped as [number, number] | string | undefined);
}

function extractBoneWorldTransforms(buffer: ArrayBuffer): [number, number][] | null {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let mdlsOff = -1;
  for (let i = 0; i < data.length - 4; i++) {
    if (data[i] === 0x4d && data[i + 1] === 0x44 &&
        data[i + 2] === 0x4c && data[i + 3] === 0x53) {
      mdlsOff = i;
      break;
    }
  }
  if (mdlsOff < 0) return null;
  let p = mdlsOff;
  while (p < data.length && data[p] !== 0) p++;
  p++;
  if (p + 8 > data.length) return null;
  const sectionByteLen = view.getUint32(p, true); p += 4;
  const numBones = view.getUint32(p, true); p += 4;
  if (numBones === 0 || numBones > 200) return null;
  const bonesStart = p;
  const sectionEnd = Math.min(data.length, mdlsOff + 10 + sectionByteLen + 100);

  const eblPositions: number[] = [];
  for (let j = bonesStart; j < sectionEnd - 68; j++) {
    if (view.getUint32(j, true) !== 64) continue;
    const firstFloat = view.getFloat32(j + 4, true);
    if (Math.abs(firstFloat) < 0.9 || Math.abs(firstFloat) > 1.1) continue;
    const hStart = j - 9;
    if (hStart < bonesStart) {
      if (j === bonesStart + 9) eblPositions.push(j);
      continue;
    }
    const tmp = data[hStart];
    if (tmp <= 1) eblPositions.push(j);
  }
  if (eblPositions.length < numBones) return null;
  const positions = eblPositions.slice(0, numBones);

  interface BoneInfo { parentIdx: number; tx: number; ty: number; }
  const bones: BoneInfo[] = [];
  for (const eblOff of positions) {
    const headerOff = eblOff - 9;
    const parentIdx = view.getInt32(headerOff + 5, true);
    const matOff = eblOff + 4;
    const tx = view.getFloat32(matOff + 48, true);
    const ty = view.getFloat32(matOff + 52, true);
    bones.push({ parentIdx, tx, ty });
  }

  const worldCache = new Map<number, [number, number]>();
  function getWorld(idx: number): [number, number] {
    if (worldCache.has(idx)) return worldCache.get(idx)!;
    const bone = bones[idx];
    if (!bone || bone.parentIdx < 0 || bone.parentIdx >= bones.length) {
      const w: [number, number] = [bone ? bone.tx : 0, bone ? bone.ty : 0];
      worldCache.set(idx, w);
      return w;
    }
    const pw = getWorld(bone.parentIdx);
    const w: [number, number] = [pw[0] + bone.tx, pw[1] + bone.ty];
    worldCache.set(idx, w);
    return w;
  }
  const result: [number, number][] = [];
  for (let i = 0; i < bones.length; i++) {
    result.push(getWorld(i));
  }
  return result;
}

function extractMdatAttachments(buffer: ArrayBuffer): Map<string, AttachmentInfo> | null {
  const mdlData = new Uint8Array(buffer);
  const mdlView = new DataView(buffer);
  const boneWorlds = extractBoneWorldTransforms(buffer);
  let mdatOff = -1;
  for (let i = 0; i < mdlData.length - 4; i++) {
    if (mdlData[i] === 0x4d && mdlData[i + 1] === 0x44 &&
        mdlData[i + 2] === 0x41 && mdlData[i + 3] === 0x54) {
      mdatOff = i;
      break;
    }
  }
  if (mdatOff < 0) return null;
  let p = mdatOff;
  while (p < mdlData.length && mdlData[p] !== 0) p++;
  p++;
  if (p + 6 > mdlData.length) return null;
  p += 4;
  const numAtt = mdlView.getUint16(p, true); p += 2;
  if (numAtt === 0 || numAtt > 100) return null;
  const result = new Map<string, AttachmentInfo>();
  for (let ai = 0; ai < numAtt; ai++) {
    if (p + 2 >= mdlData.length) break;
    const boneIdx = mdlData[p]; p += 2;
    let nameEnd = p;
    while (nameEnd < mdlData.length && mdlData[nameEnd] !== 0) nameEnd++;
    const attName = new TextDecoder().decode(mdlData.slice(p, nameEnd));
    p = nameEnd + 1;
    if (p + 64 > mdlData.length) break;
    const localTx = mdlView.getFloat32(p + 48, true);
    const localTy = mdlView.getFloat32(p + 52, true);
    p += 64;
    let meshTx = localTx;
    let meshTy = localTy;
    if (boneWorlds && boneIdx < boneWorlds.length) {
      meshTx += boneWorlds[boneIdx][0];
      meshTy += boneWorlds[boneIdx][1];
    }
    result.set(attName, {
      boneIndex: boneIdx,
      localOffsetX: localTx,
      localOffsetY: localTy,
      restPosX: meshTx,
      restPosY: meshTy,
    });
  }
  return result.size > 0 ? result : null;
}

export function resolveSceneHierarchy(
  rawObjects: Array<Record<string, unknown>>,
  projectJson: ProjectJson | null,
  pkg: PkgData,
): { sortedObjects: Array<Record<string, unknown>>; dependencyLayerIds: Set<number> } {
  const parentMap = new Map<number, Record<string, unknown>>();
  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    if (so.id !== undefined) {
      parentMap.set(so.id as number, so);
    }
  }

  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    const rawOrigin = so.origin;
    if (rawOrigin && typeof rawOrigin === 'object' && rawOrigin !== null
        && 'animation' in (rawOrigin as Record<string, unknown>)) {
      so._hasAnimatedOrigin = true;
    }
  }

  const parentAttachmentMap = new Map<number, Map<string, AttachmentInfo>>();
  const parentIds = new Set<number>();
  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    if (so.parent !== undefined && parentMap.has(so.parent as number)) {
      parentIds.add(so.parent as number);
    }
  }
  for (const pid of parentIds) {
    const parentObj = parentMap.get(pid)!;
    const imagePath = parentObj.image as string | undefined;
    if (!imagePath || !imagePath.endsWith('.json')) continue;
    const modelData = extractJsonFile<Record<string, unknown>>(pkg, imagePath);
    if (!modelData) continue;
    const puppetPath = modelData.puppet as string | undefined;
    if (!puppetPath) continue;
    const mdlRaw = extractFile(pkg, puppetPath);
    if (!mdlRaw) continue;
    const mdlBuffer = mdlRaw.buffer.slice(mdlRaw.byteOffset, mdlRaw.byteOffset + mdlRaw.byteLength) as ArrayBuffer;
    const attachments = extractMdatAttachments(mdlBuffer);
    if (attachments && attachments.size > 0) {
      parentAttachmentMap.set(pid, attachments);
      logLoaderVerbose(
        `[AttachLoad] ✓ id=${pid} "${parentObj.name}" puppet="${puppetPath}" →`,
        Array.from(attachments.entries()).map(([n, info]) => `"${n}"=(${info.restPosX.toFixed(2)},${info.restPosY.toFixed(2)})`).join(', '),
      );
    } else {
      logLoaderVerbose(`[AttachLoad] ✗ id=${pid} "${parentObj.name}" puppet="${puppetPath}" → 无MDAT/附着点`);
    }
  }

  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    const parentId = so.parent as number | undefined;
    if (parentId === undefined || !parentMap.has(parentId)) continue;
    const parent = parentMap.get(parentId)!;
    if (so.parallaxDepth === undefined) {
      const inheritedParallaxDepth = resolveParallaxDepth(parent.parallaxDepth, projectJson);
      if (inheritedParallaxDepth) {
        so._weInheritedParallaxDepth = [inheritedParallaxDepth[0], inheritedParallaxDepth[1]];
      }
    }
    const parentIsHidden = resolveUserProperty(parent.visible as SceneObject['visible'], projectJson) === false;
    if (parentIsHidden) {
      // 父层隐藏只应影响可见性继承，不应中断层级关系/变换解析。
      so.visible = false;
    }
    const parentOrigin = parseParentOrigin(parent.origin);
    const parentScaleVec = parseScaleVector3(getScriptFieldValue(parent.scale));
    const parentScale = {
      x: parentScaleVec?.[0] ?? 1,
      y: parentScaleVec?.[1] ?? 1,
    };
    let parentAngleZ = 0;
    const rawAngles = parent.angles as string | number | number[] | undefined;
    if (typeof rawAngles === 'string') {
      const angleParts = rawAngles.split(/\s+/).map(Number);
      parentAngleZ = (angleParts[2] || 0) * Math.PI / 180;
    } else if (Array.isArray(rawAngles)) {
      parentAngleZ = ((rawAngles as number[])[2] || 0) * Math.PI / 180;
    } else if (typeof rawAngles === 'number') {
      parentAngleZ = rawAngles * Math.PI / 180;
    }
    if (!parentOrigin) continue;
    let childParts: number[] | null = null;
    const rawOrigin = so.origin;
    if (typeof rawOrigin === 'string') {
      childParts = rawOrigin.split(/\s+/).map(Number);
    } else if (Array.isArray(rawOrigin)) {
      childParts = (rawOrigin as number[]).map(Number);
    } else if (rawOrigin && typeof rawOrigin === 'object' && 'value' in (rawOrigin as Record<string, unknown>)) {
      const val = (rawOrigin as Record<string, unknown>).value;
      if (typeof val === 'string') childParts = val.split(/\s+/).map(Number);
    }
    let attachOffset = { x: 0, y: 0 };
    let attachmentInfo: AttachmentInfo | null = null;
    const rawAttachment = so.attachment;
    const childAttachment = rawAttachment != null ? String(rawAttachment) : undefined;
    if (childAttachment && parentAttachmentMap.has(parentId)) {
      const attachments = parentAttachmentMap.get(parentId)!;
      if (attachments.has(childAttachment)) {
        attachmentInfo = attachments.get(childAttachment)!;
        attachOffset = { x: attachmentInfo.restPosX, y: attachmentInfo.restPosY };
      }
    }
    if (childParts && childParts.length >= 2) {
      let localOffset = {
        x: (attachOffset.x + childParts[0]) * parentScale.x,
        y: (attachOffset.y + childParts[1]) * parentScale.y,
      };
      if (parentAngleZ !== 0) {
        const cos = Math.cos(parentAngleZ);
        const sin = Math.sin(parentAngleZ);
        localOffset = {
          x: localOffset.x * cos - localOffset.y * sin,
          y: localOffset.x * sin + localOffset.y * cos,
        };
      }
      const absPos = {
        x: parentOrigin[0] + localOffset.x,
        y: parentOrigin[1] + localOffset.y,
      };
      const absZ = childParts[2] || 0;
      so._weRelativeOrigin = [childParts[0], childParts[1]];
      so._weParentId = parentId;
      so._weAttachment = childAttachment || undefined;
      so._weParentScale = [parentScale.x, parentScale.y];
      if (attachmentInfo) {
        so._weAttachmentBoneIndex = attachmentInfo.boneIndex;
        so._weAttachmentLocalOffset = [attachmentInfo.localOffsetX, attachmentInfo.localOffsetY];
        so._weAttachmentRestPos = [attachmentInfo.restPosX, attachmentInfo.restPosY];
      }
      logLoaderVerbose(
        `[Position] "${so.name}" parent="${parent.name}" parentOrigin=(${parentOrigin[0].toFixed(1)},${parentOrigin[1].toFixed(1)}) `
        + `childOff=(${childParts[0].toFixed(1)},${childParts[1].toFixed(1)}) attach="${childAttachment || '(none)'}" `
        + `attachOff=(${attachOffset.x.toFixed(2)},${attachOffset.y.toFixed(2)}) scaleXY=(${parentScale.x.toFixed(3)},${parentScale.y.toFixed(3)}) `
        + `angleZ=${(parentAngleZ * 180 / Math.PI).toFixed(1)}° → absPos=(${absPos.x.toFixed(1)},${absPos.y.toFixed(1)})`,
      );
      if (rawOrigin && typeof rawOrigin === 'object' && !Array.isArray(rawOrigin) && typeof (rawOrigin as Record<string, unknown>).script === 'string') {
        (rawOrigin as Record<string, unknown>).value = `${absPos.x} ${absPos.y} ${absZ}`;
      } else {
        so.origin = `${absPos.x} ${absPos.y} ${absZ}`;
      }
    } else if (!rawOrigin) {
      let offset = {
        x: attachOffset.x * parentScale.x,
        y: attachOffset.y * parentScale.y,
      };
      if (parentAngleZ !== 0) {
        const cos = Math.cos(parentAngleZ);
        const sin = Math.sin(parentAngleZ);
        offset = {
          x: offset.x * cos - offset.y * sin,
          y: offset.x * sin + offset.y * cos,
        };
      }
      so._weRelativeOrigin = [0, 0];
      so._weParentId = parentId;
      so._weAttachment = childAttachment || undefined;
      so._weParentScale = [parentScale.x, parentScale.y];
      if (attachmentInfo) {
        so._weAttachmentBoneIndex = attachmentInfo.boneIndex;
        so._weAttachmentLocalOffset = [attachmentInfo.localOffsetX, attachmentInfo.localOffsetY];
        so._weAttachmentRestPos = [attachmentInfo.restPosX, attachmentInfo.restPosY];
      }
      if (rawOrigin && typeof rawOrigin === 'object' && !Array.isArray(rawOrigin) && typeof (rawOrigin as Record<string, unknown>).script === 'string') {
        (rawOrigin as Record<string, unknown>).value = `${parentOrigin[0] + offset.x} ${parentOrigin[1] + offset.y} 0`;
      } else {
        so.origin = `${parentOrigin[0] + offset.x} ${parentOrigin[1] + offset.y} 0`;
      }
    }

    if (parentScale.x !== 1 || parentScale.y !== 1) {
      const childScaleRaw = so.scale;
      const childScaleParts = parseScaleVector3(getScriptFieldValue(childScaleRaw)) ?? [1, 1, 1];
      const sx = childScaleParts[0] * parentScale.x;
      const sy = childScaleParts[1] * parentScale.y;
      const sz = childScaleParts[2];
      const scaledValue = `${sx} ${sy} ${sz}`;
      if (
        childScaleRaw
        && typeof childScaleRaw === 'object'
        && !Array.isArray(childScaleRaw)
        && typeof (childScaleRaw as Record<string, unknown>).script === 'string'
      ) {
        (childScaleRaw as Record<string, unknown>).value = scaledValue;
      } else {
        so.scale = scaledValue;
      }
    }
  }

  const composelayerOrigins = new Map<number, [number, number]>();
  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    const image = so.image as string | undefined;
    if (image && image.includes('composelayer') && so.id !== undefined) {
      const origin = parseParentOrigin(so.origin);
      if (origin) composelayerOrigins.set(so.id as number, origin);
    }
  }
  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    let currentId = so.parent as number | undefined;
    while (currentId !== undefined) {
      if (composelayerOrigins.has(currentId)) {
        so._composelayerOrigin = composelayerOrigins.get(currentId);
        break;
      }
      const parentObj = parentMap.get(currentId);
      if (!parentObj) break;
      currentId = parentObj.parent as number | undefined;
    }
    const parentId = so.parent as number | undefined;
    if (parentId !== undefined && parentMap.has(parentId)) {
      const parentResolved = parseParentOrigin(parentMap.get(parentId)!.origin);
      if (parentResolved) {
        so._parentResolvedOrigin = parentResolved;
      }
    }
  }

  for (const obj of rawObjects) {
    const so = obj as Record<string, unknown>;
    const parentId = so.parent as number | undefined;
    if (parentId === undefined) continue;
    const parent = parentMap.get(parentId);
    if (!parent) continue;
    const parentOrigin = parent.origin as Record<string, unknown> | undefined;
    const parentAnim = parentOrigin?.animation;
    if (parentAnim && typeof parentAnim === 'object') {
      so._parentOriginAnimation = parentAnim;
    }
  }

  const dependencyLayerIds = new Set<number>();
  for (const obj of rawObjects) {
    const deps = (obj as Record<string, unknown>).dependencies as number[] | undefined;
    if (deps && Array.isArray(deps)) {
      for (const depId of deps) {
        dependencyLayerIds.add(depId);
      }
    }
  }
  if (dependencyLayerIds.size > 0) {
    logLoaderVerbose(`[FBO] 依赖层 ID: ${Array.from(dependencyLayerIds).join(', ')}`);
  }

  return {
    sortedObjects: rawObjects,
    dependencyLayerIds,
  };
}
