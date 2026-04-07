import type { MdlAnimation, MdlAnimBoneFrame, MdlBoneData } from './MdlLoader';

type ReadNullTermString = (data: Uint8Array, offset: number) => [string, number];

function decomposeRestRotationFromLocalMatrix(bone: MdlBoneData | undefined): number {
  if (!bone?.localMatrix || bone.localMatrix.length < 2) return 0;
  const rotation = Math.atan2(bone.localMatrix[1], bone.localMatrix[0]);
  return Number.isFinite(rotation) ? rotation : 0;
}

function findNextAnimHeader(
  data: Uint8Array,
  view: DataView,
  searchStart: number,
  candidatePos: number,
  end: number,
): number | null {
  const lo = Math.max(searchStart, candidatePos - 64);
  const hi = end - 24;
  for (let p = lo; p <= hi; p++) {
    if (p + 24 > end) break;
    const flags = view.getUint32(p + 4, true);
    if (flags !== 0) continue;
    const id = view.getUint32(p, true);
    if (id === 0 || id > 100000) continue;
    let q = p + 8;
    let nameEnd = q;
    while (nameEnd < Math.min(q + 256, end) && data[nameEnd] !== 0) nameEnd++;
    if (nameEnd === q || nameEnd >= end) continue;
    q = nameEnd + 1;
    let extraEnd = q;
    while (extraEnd < Math.min(q + 256, end) && data[extraEnd] !== 0) extraEnd++;
    if (extraEnd >= end) continue;
    q = extraEnd + 1;
    if (q + 16 > end) continue;
    const fps = view.getFloat32(q, true);
    const frames = view.getUint32(q + 4, true);
    if (fps > 0 && fps <= 120 && frames > 0 && frames < 10000) return p;
  }
  return null;
}

export function parseMdlaSection(
  data: Uint8Array,
  view: DataView,
  startPos: number,
  readNullTermString: ReadNullTermString,
): MdlAnimation[] | undefined {
  let pos = startPos;
  const [mdlaHeader, posAfterHeader] = readNullTermString(data, pos);
  pos = posAfterHeader;
  const mdlaVersion = parseInt(mdlaHeader.replace(/\D/g, ''), 10) || 0;
  if (pos + 8 > data.length) return undefined;
  const byteLen = view.getUint32(pos, true); pos += 4;
  const animCount = view.getUint32(pos, true); pos += 4;
  const mdlaEndAbsolute = (byteLen > startPos && byteLen <= data.length) ? byteLen : null;
  const mdlaEndRelative = (posAfterHeader + byteLen <= data.length) ? (posAfterHeader + byteLen) : null;
  const mdlaEnd = mdlaEndAbsolute ?? mdlaEndRelative ?? data.length;
  if (animCount === 0 || animCount > 100) {
    if (animCount > 100) console.warn(`MDL MDLA: 动画数量异常: ${animCount}`);
    return undefined;
  }

  const animations: MdlAnimation[] = [];
  for (let ai = 0; ai < animCount; ai++) {
    if (pos + 8 > data.length) break;
    const animId = view.getUint32(pos, true); pos += 4;
    pos += 4; // flags
    if (pos >= data.length) break;
    let animName: string;
    [animName, pos] = readNullTermString(data, pos);
    if (pos >= data.length) break;
    let extra: string;
    [extra, pos] = readNullTermString(data, pos);
    if (pos + 20 > data.length) break;
    const fps = view.getFloat32(pos, true); pos += 4;
    const numFrames = view.getUint32(pos, true); pos += 4;
    pos += 4; // unk0
    const numBones = view.getUint32(pos, true); pos += 4;
    if (numFrames > 10000 || numBones > 500 || fps <= 0 || fps > 120) {
      console.warn(`MDL MDLA: 动画 ${ai} 参数异常: frames=${numFrames}, bones=${numBones}, fps=${fps}`);
      break;
    }
    if (pos + 8 > data.length) break;
    pos += 4; // unk1
    const totalKF = view.getUint32(pos, true); pos += 4;
    const totalFrames = numFrames + 1;
    const expectedPairsByNumBones = numBones * totalFrames;
    const actualAnimBonesRaw = totalKF / totalFrames;
    const actualAnimBones = Math.round(actualAnimBonesRaw);
    if (!Number.isFinite(actualAnimBonesRaw) || actualAnimBones <= 0 || actualAnimBones > 500) {
      console.warn(`MDL MDLA: 动画 ${ai} 实际骨骼数异常: totalKF=${totalKF}, totalFrames=${totalFrames}, bones=${actualAnimBonesRaw}`);
      break;
    }
    const loopBones = Math.min(numBones, actualAnimBones);
    const usableKfDataBytes = loopBones * totalFrames * 9 * 4;
    if (pos + usableKfDataBytes > data.length) {
      console.warn(`MDL MDLA: 动画 ${ai} 关键帧数据超出文件范围 (需要 ${usableKfDataBytes}, 剩余 ${Math.max(0, data.length - pos)})`);
      break;
    }
    if (pos + usableKfDataBytes > mdlaEnd) {
      console.warn(`MDL MDLA: 动画 ${ai} 超出声明段范围，回退按文件边界解析 (需要 ${usableKfDataBytes}, 剩余文件 ${Math.max(0, data.length - pos)})`);
    }
    const restPose: MdlAnimBoneFrame[] = [];
    const frames: MdlAnimBoneFrame[][] = [];
    for (let fi = 0; fi < totalFrames; fi++) {
      const frameBones: MdlAnimBoneFrame[] = [];
      for (let bi = 0; bi < loopBones; bi++) {
        const offset = pos + ((bi * totalFrames + fi) * 9) * 4;
        const shift = (bi * 2) % 9;
        const field = (i: number) => offset + (((shift + i) % 9) * 4);
        const uniformScale = view.getFloat32(field(6), true);
        const f4 = view.getFloat32(field(4), true);
        frameBones.push({
          pos: { x: view.getFloat32(field(0), true), y: view.getFloat32(field(1), true) },
          rotation: view.getFloat32(field(5), true),
          scale: { x: uniformScale, y: uniformScale },
          active: f4 < 0.5,
        });
      }
      if (fi === 0) restPose.push(...frameBones);
      else frames.push(frameBones);
    }
    pos += Math.min(usableKfDataBytes, data.length - pos);
    if (ai < animCount - 1) {
      const tailOverhead = mdlaVersion <= 3 ? 1 : mdlaVersion <= 5 ? 26 : 27;
      const expectedTail = numBones * 8 + tailOverhead;
      const candidatePos = pos + expectedTail;
      const found = findNextAnimHeader(data, view, pos, candidatePos, data.length);
      pos = found ?? (pos + Math.min(expectedTail, data.length - pos));
    }
    animations.push({ id: animId, name: animName, fps, numFrames, numBones: loopBones, frames, restPose, extra });
    if (totalKF !== expectedPairsByNumBones) {
      console.log(`MDL MDLA: 动画 ${ai} totalKF=${totalKF} 与 numBones*frames=${expectedPairsByNumBones} 不一致，实际骨骼=${actualAnimBones}，解析骨骼=${loopBones}`);
    }
    console.log(`MDL MDLA: 动画 "${animName}" id=${animId} fps=${fps} frames=${numFrames} bones=${loopBones}(raw=${actualAnimBones})${extra ? ' extra=' + extra : ''}`);
  }
  if (animations.length < animCount) {
    globalThis.console.warn(`MDL MDLA: 声明 ${animCount} 个动画，但仅成功解析 ${animations.length} 个`);
  }
  return animations.length > 0 ? animations : undefined;
}

export function cleanAnimationData(animations: MdlAnimation[], bones: MdlBoneData[]): void {
  for (const anim of animations) {
    for (let bi = 0; bi < anim.numBones; bi++) {
      const rest = anim.restPose[bi];
      if (!rest) continue;
      const bone = bones[bi];
      const defaultRestPos = { x: bone?.local.x ?? 0, y: bone?.local.y ?? 0 };
      const defaultScale = 1.0;
      if (!rest.active) {
        rest.pos.x = defaultRestPos.x;
        rest.pos.y = defaultRestPos.y;
        rest.scale.x = defaultScale;
        rest.scale.y = defaultScale;
        rest.restInactive = true;
      } else {
        if (!Number.isFinite(rest.pos.x)) rest.pos.x = defaultRestPos.x;
        if (!Number.isFinite(rest.pos.y)) rest.pos.y = defaultRestPos.y;
        if (!Number.isFinite(rest.scale.x)) rest.scale.x = defaultScale;
        if (!Number.isFinite(rest.scale.y)) rest.scale.y = defaultScale;
      }
      if (!Number.isFinite(rest.rotation) || Math.abs(rest.rotation - 1.0) < 0.01) {
        rest.rotation = decomposeRestRotationFromLocalMatrix(bone);
        rest.restRotationCorrected = true;
      }
      rest.active = true;
    }
  }
}
