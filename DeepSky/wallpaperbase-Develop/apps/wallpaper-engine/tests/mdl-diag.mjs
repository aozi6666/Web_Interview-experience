/**
 * MDL 诊断脚本 - 直接解析 PKG 中的 MDL 文件，输出 MDLA 关键帧的 raw 数据
 * 用于验证 field shift 逻辑是否正确
 * 
 * 运行: node tests/mdl-diag.mjs
 */
import { readFileSync } from 'fs';

const PKG_PATH = 'resources/wallpapers/3527811827/scene.pkg';
const MDL_FILES = ['models/qiansha_puppet.mdl', 'models/houtui_puppet.mdl', 'models/yizhi_puppet.mdl'];

// ═══ PKG 解析 ═══
function parsePkg(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  const magicLength = view.getUint32(0, true);
  const magicBytes = new Uint8Array(buffer, 4, magicLength);
  const version = decoder.decode(magicBytes);
  const entries = [];
  let pos = 4 + magicLength;
  const entryCount = view.getUint32(pos, true);
  pos += 4;
  for (let i = 0; i < entryCount; i++) {
    const nameLength = view.getUint32(pos, true); pos += 4;
    const nameBytes = new Uint8Array(buffer, pos, nameLength);
    const name = decoder.decode(nameBytes); pos += nameLength;
    const offset = view.getUint32(pos, true); pos += 4;
    const size = view.getUint32(pos, true); pos += 4;
    entries.push({ name, offset, size });
  }
  const dataStart = pos;
  for (const entry of entries) entry.offset += dataStart;
  return { version, entries, data: buffer };
}

function extractFile(pkg, fileName) {
  const entry = pkg.entries.find(e => e.name === fileName);
  if (!entry) return null;
  return new Uint8Array(pkg.data, entry.offset, entry.size);
}

// ═══ 工具 ═══
function readNullTermString(data, offset) {
  let end = offset;
  while (end < data.length && data[end] !== 0) end++;
  const str = new TextDecoder('utf-8').decode(data.slice(offset, end));
  return [str, end + 1];
}

function matchTag(data, pos, tag) {
  if (pos + 4 > data.length) return false;
  return data[pos] === tag.charCodeAt(0) && data[pos + 1] === tag.charCodeAt(1) &&
         data[pos + 2] === tag.charCodeAt(2) && data[pos + 3] === tag.charCodeAt(3);
}

const VERTEX_FORMAT_STRIDE = {
  0x01800009: 52,
  0x0180000f: 80,
  0x0181000e: 84,
};

// ═══ MDL 诊断解析 ═══
function diagnoseMdl(buffer, fileName) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  MDL 诊断: ${fileName}`);
  console.log(`${'═'.repeat(70)}`);

  const [headerStr, posAfterMagic] = readNullTermString(data, 0);
  if (!headerStr.startsWith('MDLV')) { console.log('不是 MDL 文件'); return; }
  const version = headerStr.substring(4);
  const versionNum = parseInt(version, 10) || 0;
  let pos = posAfterMagic;

  const headerFlag = view.getUint32(pos, true); pos += 4;
  pos += 4; pos += 4;
  const [materialPath, posAfterMat] = readNullTermString(data, pos);
  pos = posAfterMat;

  let vertexFormat, vertexByteLength;
  if (versionNum >= 19) {
    pos += 28;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  } else {
    pos += 4;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  }

  let stride = VERTEX_FORMAT_STRIDE[vertexFormat];
  if (!stride) {
    for (const tryStride of [80, 84, 52]) {
      if (vertexByteLength % tryStride === 0) { stride = tryStride; break; }
    }
  }
  if (!stride) { console.log('无法确定 stride'); return; }

  const vertexCount = vertexByteLength / stride;
  console.log(`  版本: ${version} (${versionNum})`);
  console.log(`  vertexFormat: 0x${vertexFormat.toString(16)}`);
  console.log(`  stride: ${stride}`);
  console.log(`  vertexCount: ${vertexCount}`);

  // 跳过顶点数据
  pos += vertexByteLength;
  
  // 跳过索引数据
  const indicesByteLength = view.getUint32(pos, true); pos += 4;
  pos += indicesByteLength;

  // 跳过 post-index data (v0021+)
  if (versionNum >= 21 && !matchTag(data, pos, 'MDLS')) {
    // 简化的跳过逻辑：扫描到 MDLS
    for (let scan = pos; scan < Math.min(pos + 2000, data.length - 4); scan++) {
      if (matchTag(data, scan, 'MDLS')) { pos = scan; break; }
    }
  }

  // MDLS
  if (!matchTag(data, pos, 'MDLS')) { console.log('未找到 MDLS 段'); return; }
  const [mdlsHeader, posAfterMdlsHeader] = readNullTermString(data, pos);
  pos = posAfterMdlsHeader;
  const mdlsByteLen = view.getUint32(pos, true); pos += 4;
  const numBones = view.getUint32(pos, true); pos += 4;
  console.log(`  MDLS: ${mdlsHeader}, bones=${numBones}`);

  // 读取骨骼
  const bones = [];
  for (let bi = 0; bi < numBones; bi++) {
    pos += 1; pos += 4;
    const parentIdx = view.getInt32(pos, true); pos += 4;
    const entryByteLen = view.getUint32(pos, true); pos += 4;
    const localMatrix = new Float32Array(16);
    let tx = 0, ty = 0;
    if (pos + entryByteLen <= data.length) {
      const floatCount = Math.min(entryByteLen / 4, 16);
      for (let m = 0; m < floatCount; m++) localMatrix[m] = view.getFloat32(pos + m * 4, true);
      if (floatCount >= 14) { tx = localMatrix[12]; ty = localMatrix[13]; }
    }
    pos += entryByteLen;
    let boneName; [boneName, pos] = readNullTermString(data, pos);
    bones.push({ name: boneName.substring(0, 30), parentIndex: parentIdx, localX: tx, localY: ty });
  }

  for (let bi = 0; bi < Math.min(numBones, 10); bi++) {
    const b = bones[bi];
    console.log(`  骨骼[${bi}]: "${b.name}" parent=${b.parentIndex} localX=${b.localX.toFixed(2)} localY=${b.localY.toFixed(2)}`);
  }

  // 跳过 BONE2
  for (let bi = 0; bi < numBones; bi++) {
    if (pos + 9 > data.length) break;
    pos += 9;
  }

  // 跳到 MDLA (通过 mdlsByteLen)
  const mdlsNextByAbsolute = (mdlsByteLen > posAfterMdlsHeader - 9 && mdlsByteLen <= data.length) ? mdlsByteLen : null;
  const mdlsNextByRelative = (posAfterMdlsHeader + mdlsByteLen <= data.length) ? (posAfterMdlsHeader + mdlsByteLen) : null;
  if (mdlsNextByAbsolute !== null && mdlsNextByAbsolute >= pos) pos = mdlsNextByAbsolute;
  else if (mdlsNextByRelative !== null && mdlsNextByRelative >= pos) pos = mdlsNextByRelative;

  // 跳过 MDAT
  if (pos + 4 < data.length && matchTag(data, pos, 'MDAT')) {
    for (let scan = pos + 4; scan < Math.min(pos + 5000, data.length - 4); scan++) {
      if (matchTag(data, scan, 'MDLA')) { pos = scan; break; }
    }
  }

  // MDLA
  if (!matchTag(data, pos, 'MDLA')) { console.log('未找到 MDLA 段'); return; }
  const [mdlaHeader, posAfterMdlaHeader] = readNullTermString(data, pos);
  pos = posAfterMdlaHeader;
  const byteLen = view.getUint32(pos, true); pos += 4;
  const animCount = view.getUint32(pos, true); pos += 4;
  console.log(`  MDLA: ${mdlaHeader}, animCount=${animCount}`);

  for (let ai = 0; ai < animCount; ai++) {
    const animId = view.getUint32(pos, true); pos += 4;
    const flags = view.getUint32(pos, true); pos += 4;
    let animName; [animName, pos] = readNullTermString(data, pos);
    let extra; [extra, pos] = readNullTermString(data, pos);
    const fps = view.getFloat32(pos, true); pos += 4;
    const numFrames = view.getUint32(pos, true); pos += 4;
    const unk0 = view.getUint32(pos, true); pos += 4;
    const animNumBones = view.getUint32(pos, true); pos += 4;
    const unk1 = view.getUint32(pos, true); pos += 4;
    const totalKF = view.getUint32(pos, true); pos += 4;
    const totalFrames = numFrames + 1;
    const actualAnimBones = Math.round(totalKF / totalFrames);
    const loopBones = Math.min(animNumBones, actualAnimBones);

    console.log(`\n  动画[${ai}]: "${animName}" id=${animId} fps=${fps} frames=${numFrames} bones=${animNumBones} totalKF=${totalKF} actualAnimBones=${actualAnimBones}`);

    // 对前几帧、前几个骨骼输出 raw 9-float
    const DIAG_FRAMES = [0, 1, 2];
    const DIAG_BONES = Math.min(loopBones, 16);

    for (const fi of DIAG_FRAMES) {
      if (fi >= totalFrames) continue;
      console.log(`\n  --- frame ${fi} (${fi === 0 ? 'REST' : 'anim'}) ---`);
      for (let bi = 0; bi < DIAG_BONES; bi++) {
        // bone-major offset
        const offsetBM = pos + ((bi * totalFrames + fi) * 9) * 4;
        // frame-major offset (alternative)
        const offsetFM = pos + ((fi * loopBones + bi) * 9) * 4;

        const rawBM = [];
        const rawFM = [];
        for (let r = 0; r < 9; r++) {
          rawBM.push(view.getFloat32(offsetBM + r * 4, true));
          if (offsetFM + r * 4 < data.length) {
            rawFM.push(view.getFloat32(offsetFM + r * 4, true));
          }
        }

        const shift = (bi * 2) % 9;
        const shiftedField = (i) => rawBM[((shift + i) % 9)];
        const noShiftField = (i) => rawBM[i % 9];

        const fmt = (v) => v === undefined ? '????' : v.toFixed(4);
        const fmtArr = (arr) => arr.map(v => fmt(v)).join(', ');

        console.log(`    bone[${bi}] "${(bones[bi]?.name || '?').substring(0, 20)}" shift=${shift}:`);
        console.log(`      raw(bone-major):  [${fmtArr(rawBM)}]`);
        console.log(`      raw(frame-major): [${fmtArr(rawFM)}]`);
        console.log(`      shifted:  posX=${fmt(shiftedField(0))} posY=${fmt(shiftedField(1))} rot=${fmt(shiftedField(5))} scX=${fmt(shiftedField(6))} f4=${fmt(shiftedField(4))}`);
        console.log(`      noShift:  posX=${fmt(noShiftField(0))} posY=${fmt(noShiftField(1))} rot=${fmt(noShiftField(5))} scX=${fmt(noShiftField(6))} f4=${fmt(noShiftField(4))}`);
        
        // 额外输出：frame-major 的 noShift 解析
        const fmNoShift = (i) => rawFM[i % 9];
        console.log(`      FM noSh:  posX=${fmt(fmNoShift(0))} posY=${fmt(fmNoShift(1))} rot=${fmt(fmNoShift(5))} scX=${fmt(fmNoShift(6))} f4=${fmt(fmNoShift(4))}`);
      }
    }

    // ═══ 统计分析：遍历所有帧，找出异常 rotation 的骨骼 ═══
    console.log(`\n  === 全帧统计 ===`);
    for (let bi = 0; bi < DIAG_BONES; bi++) {
      const shift = (bi * 2) % 9;
      let activeCount = 0, inactiveCount = 0;
      let rotNear1Count = 0, rotNear1ActiveCount = 0;
      let rotMin = Infinity, rotMax = -Infinity;
      let posXMin = Infinity, posXMax = -Infinity;
      let posYMin = Infinity, posYMax = -Infinity;
      const sampleRots = [];
      
      for (let fi = 0; fi < totalFrames; fi++) {
        const off = pos + ((bi * totalFrames + fi) * 9) * 4;
        const fld = (i) => view.getFloat32(off + (((shift + i) % 9) * 4), true);
        const f4Val = fld(4);
        const rotVal = fld(5);
        const posX = fld(0);
        const posY = fld(1);
        const active = f4Val < 0.5;
        if (active) activeCount++; else inactiveCount++;
        if (Math.abs(rotVal - 1.0) < 0.01) { rotNear1Count++; if (active) rotNear1ActiveCount++; }
        if (active) {
          rotMin = Math.min(rotMin, rotVal); rotMax = Math.max(rotMax, rotVal);
          posXMin = Math.min(posXMin, posX); posXMax = Math.max(posXMax, posX);
          posYMin = Math.min(posYMin, posY); posYMax = Math.max(posYMax, posY);
          if (fi <= 10 || (fi % 30 === 0)) sampleRots.push(`f${fi}:${rotVal.toFixed(4)}`);
        }
      }
      const bone = bones[bi];
      console.log(`    bone[${bi}] "${(bone?.name || '?').substring(0, 20)}" shift=${shift}: active=${activeCount}/${totalFrames} rot≈1(all)=${rotNear1Count} rot≈1(active)=${rotNear1ActiveCount}`);
      if (activeCount > 0) {
        console.log(`      posX=[${posXMin.toFixed(2)}, ${posXMax.toFixed(2)}] posY=[${posYMin.toFixed(2)}, ${posYMax.toFixed(2)}] rot=[${rotMin.toFixed(4)}, ${rotMax.toFixed(4)}]`);
        console.log(`      rot samples: ${sampleRots.slice(0, 15).join(' ')}`);
      }
    }

    // 推进游标
    const kfDataBytes = totalKF * 9 * 4;
    pos += Math.min(kfDataBytes, data.length - pos);
    const tailBytes = actualAnimBones * 8 + 27;
    if (ai < animCount - 1 && pos + tailBytes <= data.length) pos += tailBytes;
  }
}

// ═══ 主入口 ═══
console.log('加载 PKG 文件...');
const pkgBuffer = readFileSync(PKG_PATH);
const ab = pkgBuffer.buffer.slice(pkgBuffer.byteOffset, pkgBuffer.byteOffset + pkgBuffer.byteLength);
const pkg = parsePkg(ab);
console.log(`PKG: ${pkg.version}, ${pkg.entries.length} 个文件`);

// 列出 MDL 文件
const mdlEntries = pkg.entries.filter(e => e.name.endsWith('.mdl'));
console.log(`PKG 中的 MDL 文件: ${mdlEntries.map(e => e.name).join(', ')}`);

for (const mdlName of MDL_FILES) {
  const mdlData = extractFile(pkg, mdlName);
  if (!mdlData) {
    console.log(`\n未找到: ${mdlName}`);
    continue;
  }
  const mdlBuffer = mdlData.buffer.slice(mdlData.byteOffset, mdlData.byteOffset + mdlData.byteLength);
  diagnoseMdl(mdlBuffer, mdlName);
  diagnoseBlendData(mdlBuffer, mdlName);
  diagnoseBlendDataDetailed(mdlBuffer, mdlName);
}

function diagnoseBlendDataDetailed(buffer, fileName) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  详细混合数据诊断: ${fileName}`);
  console.log(`${'═'.repeat(70)}`);

  const [headerStr, posAfterMagic] = readNullTermString(data, 0);
  const version = headerStr.substring(4);
  const versionNum = parseInt(version, 10) || 0;
  let pos = posAfterMagic;
  pos += 4; pos += 4; pos += 4;
  const [materialPath, posAfterMat] = readNullTermString(data, pos);
  pos = posAfterMat;

  let vertexFormat, vertexByteLength;
  if (versionNum >= 19) {
    pos += 28;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  } else {
    pos += 4;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  }

  let stride = VERTEX_FORMAT_STRIDE[vertexFormat];
  if (!stride) {
    for (const tryStride of [80, 84, 52]) {
      if (vertexByteLength % tryStride === 0) { stride = tryStride; break; }
    }
  }
  if (!stride || stride < 80) return;

  const vertexCount = vertexByteLength / stride;
  const vertexDataStart = pos;

  // 按 Y 坐标分组分析
  const boneIndexHist = new Map();
  let outOfRangeBoneCount = 0;
  let weightSumIssues = 0;
  const vertsByY = [];
  
  for (let i = 0; i < vertexCount; i++) {
    const off = vertexDataStart + i * stride;
    const vx = view.getFloat32(off, true);
    const vy = view.getFloat32(off + 4, true);
    
    const indices = [];
    const weights = [];
    for (let k = 0; k < 4; k++) {
      indices.push(view.getUint32(off + 40 + k * 4, true));
      weights.push(view.getFloat32(off + 56 + k * 4, true));
    }
    
    let weightSum = 0;
    for (let k = 0; k < 4; k++) {
      if (weights[k] > 0.001) weightSum += weights[k];
      const bi = indices[k];
      boneIndexHist.set(bi, (boneIndexHist.get(bi) || 0) + 1);
      if (bi >= 10) outOfRangeBoneCount++;
    }
    if (Math.abs(weightSum - 1.0) > 0.05) weightSumIssues++;
    
    vertsByY.push({ vi: i, vx, vy, indices, weights, weightSum });
  }
  
  // 排序按 Y 从高到低
  vertsByY.sort((a, b) => b.vy - a.vy);
  
  console.log(`  bone index 分布:`, Object.fromEntries([...boneIndexHist.entries()].sort((a,b) => a[0] - b[0])));
  console.log(`  bone index >= 10 的引用数: ${outOfRangeBoneCount}`);
  console.log(`  权重和偏离 1.0 的顶点数: ${weightSumIssues}`);
  
  // 输出顶部（Y最高）和底部（Y最低）的顶点blend数据
  console.log(`\n  顶部 10 个顶点 (Y 最高):`)
  for (let i = 0; i < Math.min(10, vertsByY.length); i++) {
    const v = vertsByY[i];
    console.log(`    vi=${v.vi} pos=(${v.vx.toFixed(1)}, ${v.vy.toFixed(1)}) idx=[${v.indices}] wgt=[${v.weights.map(w => w.toFixed(3))}] sum=${v.weightSum.toFixed(3)}`);
  }
  console.log(`\n  底部 10 个顶点 (Y 最低):`)
  for (let i = vertsByY.length - 10; i < vertsByY.length; i++) {
    if (i < 0) continue;
    const v = vertsByY[i];
    console.log(`    vi=${v.vi} pos=(${v.vx.toFixed(1)}, ${v.vy.toFixed(1)}) idx=[${v.indices}] wgt=[${v.weights.map(w => w.toFixed(3))}] sum=${v.weightSum.toFixed(3)}`);
  }
  
  // 检查整个 stride 中 offset 40-43 和 56-71 的原始字节，验证 blend 数据偏移是否正确
  // 取第一个顶点的完整 stride dump
  console.log(`\n  第一个顶点完整 stride dump (${stride} bytes):`);
  const off0 = vertexDataStart;
  const strideDump = [];
  for (let b = 0; b < stride; b += 4) {
    const fval = view.getFloat32(off0 + b, true);
    const ival = view.getUint32(off0 + b, true);
    const bytes = [data[off0+b], data[off0+b+1], data[off0+b+2], data[off0+b+3]];
    strideDump.push(`@${b}: float=${fval.toFixed(4)} uint32=0x${ival.toString(16)} bytes=[${bytes}]`);
  }
  console.log(strideDump.join('\n    '));
  
  // 查找关节区域（Y 在 -200 到 -350 和 -450 到 -550 范围）的顶点
  const jointRegions = [
    { name: '膝盖区域', yMin: -350, yMax: -200 },
    { name: '脚踝区域', yMin: -550, yMax: -440 },
  ];
  for (const region of jointRegions) {
    const regionVerts = vertsByY.filter(v => v.vy >= region.yMin && v.vy <= region.yMax);
    console.log(`\n  ${region.name} (Y: ${region.yMin} ~ ${region.yMax}): ${regionVerts.length} 顶点`);
    
    // 按主骨骼分组统计
    const boneGroups = new Map();
    for (const v of regionVerts) {
      const key = `[${v.indices.join(',')}]`;
      if (!boneGroups.has(key)) boneGroups.set(key, []);
      boneGroups.get(key).push(v);
    }
    for (const [key, verts] of boneGroups) {
      const wgtRanges = [0,1,2,3].map(k => {
        const ws = verts.map(v => v.weights[k]).filter(w => w > 0.001);
        if (ws.length === 0) return 'n/a';
        return `${Math.min(...ws).toFixed(3)}~${Math.max(...ws).toFixed(3)}`;
      });
      console.log(`    idx=${key} count=${verts.length} wgt=[${wgtRanges.join(', ')}]`);
      // 如果该组只有少量顶点（可能异常），打印详情
      if (verts.length <= 5) {
        for (const v of verts) {
          console.log(`      vi=${v.vi} pos=(${v.vx.toFixed(1)}, ${v.vy.toFixed(1)}) wgt=[${v.weights.map(w => w.toFixed(3))}] sum=${v.weightSum.toFixed(3)}`);
        }
      }
    }
  }
  
  // 查找有 3 路或 4 路影响（三个以上有效权重）的顶点
  const multiInfluence = vertsByY.filter(v => {
    let count = 0;
    for (const w of v.weights) if (w > 0.001) count++;
    return count >= 3;
  });
  console.log(`\n  3+ 路影响的顶点数: ${multiInfluence.length}`);
  for (const v of multiInfluence.slice(0, 10)) {
    console.log(`    vi=${v.vi} pos=(${v.vx.toFixed(1)}, ${v.vy.toFixed(1)}) idx=[${v.indices}] wgt=[${v.weights.map(w => w.toFixed(3))}]`);
  }

  // 也 dump 一个底部顶点
  const bottomVert = vertsByY[vertsByY.length - 1];
  if (bottomVert) {
    console.log(`\n  底部顶点 vi=${bottomVert.vi} 完整 stride dump:`);
    const offB = vertexDataStart + bottomVert.vi * stride;
    const dump2 = [];
    for (let b = 0; b < stride; b += 4) {
      const fval = view.getFloat32(offB + b, true);
      const ival = view.getUint32(offB + b, true);
      const bytes = [data[offB+b], data[offB+b+1], data[offB+b+2], data[offB+b+3]];
      dump2.push(`@${b}: float=${fval.toFixed(4)} uint32=0x${ival.toString(16)} bytes=[${bytes}]`);
    }
    console.log(dump2.join('\n    '));
  }
}

function diagnoseBlendData(buffer, fileName) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  混合数据诊断: ${fileName}`);
  console.log(`${'═'.repeat(70)}`);

  const [headerStr, posAfterMagic] = readNullTermString(data, 0);
  const version = headerStr.substring(4);
  const versionNum = parseInt(version, 10) || 0;
  let pos = posAfterMagic;
  pos += 4; pos += 4; pos += 4;
  const [materialPath, posAfterMat] = readNullTermString(data, pos);
  pos = posAfterMat;

  let vertexFormat, vertexByteLength;
  if (versionNum >= 19) {
    pos += 28;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  } else {
    pos += 4;
    vertexFormat = view.getUint32(pos, true); pos += 4;
    vertexByteLength = view.getUint32(pos, true); pos += 4;
  }

  let stride = VERTEX_FORMAT_STRIDE[vertexFormat];
  if (!stride) {
    for (const tryStride of [80, 84, 52]) {
      if (vertexByteLength % tryStride === 0) { stride = tryStride; break; }
    }
  }
  if (!stride) return;

  const vertexCount = vertexByteLength / stride;
  const vertexDataStart = pos;

  let bone0SecondaryCount = 0;
  let bone0SecondaryHighWeightCount = 0;
  const affectedVerts = [];
  
  for (let i = 0; i < vertexCount; i++) {
    const off = vertexDataStart + i * stride;
    if (stride < 80) continue;
    
    const indicesU8 = [];
    const indicesU32 = [];
    const weights = [];
    for (let k = 0; k < 4; k++) {
      indicesU8.push(data[off + 40 + k]);
      indicesU32.push(view.getUint32(off + 40 + k * 4, true));
      weights.push(view.getFloat32(off + 56 + k * 4, true));
    }
    
    // 用 u32 索引检查
    for (let k = 1; k < 4; k++) {
      if (indicesU32[k] === 0 && weights[k] > 0.001) {
        bone0SecondaryCount++;
        if (weights[k] > 0.1) bone0SecondaryHighWeightCount++;
        if (affectedVerts.length < 10) {
          const vx = view.getFloat32(off, true);
          const vy = view.getFloat32(off + 4, true);
          affectedVerts.push({ vi: i, vx, vy, primary: indicesU32[0], indicesU8, indicesU32, weights: weights.map(w => w.toFixed(3)) });
        }
      }
    }
  }
  
  console.log(`  顶点数: ${vertexCount}`);
  console.log(`  bone0 作为次要骨骼的顶点数: ${bone0SecondaryCount} (权重>0.1: ${bone0SecondaryHighWeightCount})`);
  if (affectedVerts.length > 0) {
    console.log(`  受影响顶点示例:`);
    for (const v of affectedVerts) {
      console.log(`    vi=${v.vi} pos=(${v.vx.toFixed(2)}, ${v.vy.toFixed(2)}) primary=${v.primary} indices=[${v.indices}] weights=[${v.weights}]`);
    }
  }
}
