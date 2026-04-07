import type { MdlAnimBoneFrame, MdlAnimation, MdlBoneData } from '../types';
import { AnimationLayerController } from './AnimationLayerController';
import { BlendRuleSystem } from './BlendRuleSystem';
import { BonePhysics } from '../rig/BonePhysics';
import { IKSolver } from '../rig/IKSolver';
import { MorphTargetSystem, type MorphTargetData } from './MorphTargetSystem';
import type { Vec2Like, Vec3Like } from '../../../math';

export interface PuppetAnimationConfig {
  bones: MdlBoneData[];
  animations: MdlAnimation[];
  boneIndices: Uint8Array;
  boneWeights: Float32Array;
  boneIndices4?: Uint16Array;
  boneWeights4?: Float32Array;
  animationLayers?: Array<{
    animation?: number;
    rate?: number;
    blend?: number;
    visible?: boolean;
    name?: string;
    startOffset?: number;
  }>;
  morphTargets?: MorphTargetData[];
  coverScale: number;
}

export interface PuppetAnimatorConfig {
  animation: PuppetAnimationConfig;
  restVertices: Float32Array;
}

interface ManualBoneTransform {
  pos: Vec2Like;
  rotation: number;
  scale: Vec2Like;
}

export class PuppetAnimator {
  private readonly _anim: PuppetAnimationConfig;
  private readonly _restVerts: Float32Array;
  private readonly _vertsBuffer: Float32Array;
  private readonly _morphBuffer: Float32Array;
  private _lastFrameKey = '';
  private _dirtyFromScript = true;

  private readonly _layers: AnimationLayerController[] = [];
  private readonly _physics = new BonePhysics();
  private readonly _blendRules = new BlendRuleSystem();
  private readonly _ikSolver = new IKSolver();
  private readonly _nameToBoneIndex = new Map<string, number>();
  private readonly _manualWorld = new Map<number, ManualBoneTransform>();
  private readonly _manualLocal = new Map<number, ManualBoneTransform>();
  private readonly _morphSystem: MorphTargetSystem | null;

  private _boneWorldX = new Float32Array(0);
  private _boneWorldY = new Float32Array(0);
  private _boneWorldRot = new Float32Array(0);
  private _boneScaleX = new Float32Array(0);
  private _boneScaleY = new Float32Array(0);

  constructor(config: PuppetAnimatorConfig) {
    this._anim = config.animation;
    this._restVerts = new Float32Array(config.restVertices);
    this._vertsBuffer = new Float32Array(config.restVertices);
    this._morphBuffer = new Float32Array(config.restVertices);
    this._morphSystem = config.animation.morphTargets && config.animation.morphTargets.length > 0
      ? new MorphTargetSystem(config.animation.morphTargets)
      : null;

    this._anim.bones.forEach((b, i) => this._nameToBoneIndex.set(b.name, i));
    this._initLayers();
  }

  private _initLayers(): void {
    this._layers.length = 0;
    const sourceLayers = this._anim.animationLayers ?? [];
    const resolveAnimation = (ref: number): MdlAnimation | null => {
      if (ref >= 0 && ref < this._anim.animations.length) return this._anim.animations[ref];
      return this._anim.animations.find((a) => a.id === ref) ?? null;
    };
    const isSingle = (a: MdlAnimation) => (a.extra || '').toLowerCase().includes('single');
    for (let i = 0; i < sourceLayers.length; i++) {
      const l = sourceLayers[i];
      const animRef = l.animation ?? 0;
      const a = resolveAnimation(animRef);
      if (!a) continue;
      if (isSingle(a)) continue;
      const rawRate = Number(l.rate ?? 1);
      const rawBlend = Number(l.blend ?? 1);
      const ctrl = new AnimationLayerController({
        name: l.name || `layer_${i}`,
        animation: a,
        rate: Number.isFinite(rawRate) ? rawRate : 1,
        blend: Number.isFinite(rawBlend) ? rawBlend : 1,
        visible: l.visible ?? true,
      });
      if (l.startOffset != null && l.startOffset > 0 && ctrl.duration > 0) {
        ctrl.setFrame(l.startOffset * ctrl.frameCount);
      }
      this._layers.push(ctrl);
    }
    if (this._layers.length === 0) {
      const fallback = this._anim.animations.find((a) => !isSingle(a))
        ?? this._anim.animations[0];
      if (!fallback) return;
      this._layers.push(new AnimationLayerController({
        name: fallback.name || 'layer_0',
        animation: fallback,
        rate: 1,
        blend: 1,
        visible: true,
      }));
    }
  }

  update(deltaTime: number): Float32Array | null {
    for (const layer of this._layers) layer.update(deltaTime);
    const frameKey = this._buildFrameKey();
    if (!this._dirtyFromScript && frameKey === this._lastFrameKey) return null;
    this._lastFrameKey = frameKey;
    this._dirtyFromScript = false;
    return this._applyAnimation(deltaTime);
  }

  private _buildFrameKey(): string {
    const parts: string[] = [];
    for (const l of this._layers) {
      if (!l.visible) continue;
      parts.push(`${l.name}:${l.time.toFixed(4)}:${l.blend.toFixed(3)}:${l.state}`);
    }
    if (parts.length === 0) parts.push('idle');
    if (this._manualWorld.size > 0 || this._manualLocal.size > 0) parts.push('manual');
    return parts.join('|');
  }

  private _wrapAngle(a: number): number {
    let x = a;
    while (x > Math.PI) x -= Math.PI * 2;
    while (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  private _lerpAngleShortest(a0: number, a1: number, t: number): number {
    const delta = this._wrapAngle(a1 - a0);
    return a0 + delta * t;
  }

  private _sampleBoneSparse(
    layerAnim: MdlAnimation,
    rawFramePos: number,
    frameCount: number,
    boneIndex: number,
    isNonLoop: boolean,
  ): MdlAnimBoneFrame | null {
    const frameBones = layerAnim.frames;
    const isUsableActiveAt = (idx: number): boolean => {
      const cur = frameBones[idx]?.[boneIndex];
      if (!cur?.active || !Number.isFinite(cur.rotation)) return false;
      // MDLA 稀疏帧在部分资源中会把未覆盖旋转残留为 1.0。
      // 若该帧夹在“前一帧 inactive、后一帧 active 且明显非 1.0”的过渡处，
      // 则该 1.0 更可能是污染值，避免把它当作真实关键帧参与插值。
      if (Math.abs(cur.rotation - 1.0) < 0.01) {
        const prevIdx = isNonLoop ? idx - 1 : (idx - 1 + frameCount) % frameCount;
        const nextIdx = isNonLoop ? idx + 1 : (idx + 1) % frameCount;
        const prev = prevIdx >= 0 && prevIdx < frameCount ? frameBones[prevIdx]?.[boneIndex] : null;
        const next = nextIdx >= 0 && nextIdx < frameCount ? frameBones[nextIdx]?.[boneIndex] : null;
        if (prev && !prev.active && next?.active && Number.isFinite(next.rotation) && Math.abs(next.rotation - 1.0) > 0.05) {
          return false;
        }
      }
      return true;
    };
    const tRaw = isNonLoop
      ? Math.max(0, Math.min(rawFramePos, frameCount - 1))
      : ((rawFramePos % frameCount) + frameCount) % frameCount;
    const i0 = Math.floor(tRaw);
    const i1 = isNonLoop ? Math.min(i0 + 1, frameCount - 1) : (i0 + 1) % frameCount;
    const fracLocal = tRaw - i0;

    const a0 = frameBones[i0]?.[boneIndex];
    const a1 = frameBones[i1]?.[boneIndex];
    const ok0 = isUsableActiveAt(i0);
    const ok1 = isUsableActiveAt(i1);
    if (ok0 && ok1 && a0 && a1) {
      return {
        pos: {
          x: a0.pos.x + (a1.pos.x - a0.pos.x) * fracLocal,
          y: a0.pos.y + (a1.pos.y - a0.pos.y) * fracLocal,
        },
        rotation: this._lerpAngleShortest(a0.rotation, a1.rotation, fracLocal),
        scale: {
          x: a0.scale.x + (a1.scale.x - a0.scale.x) * fracLocal,
          y: a0.scale.y + (a1.scale.y - a0.scale.y) * fracLocal,
        },
        active: true,
      };
    }
    if (isNonLoop) {
      if (ok0 && a0) return a0;
      for (let step = 1; step <= i0; step++) {
        const idx = i0 - step;
        if (idx < 0) break;
        const b = frameBones[idx]?.[boneIndex];
        if (isUsableActiveAt(idx) && b) return b;
      }
      for (let idx = i1; idx < frameCount; idx++) {
        const b = frameBones[idx]?.[boneIndex];
        if (isUsableActiveAt(idx) && b) return b;
      }
      return null;
    }

    // loop: 双向搜索最近有效帧并在环形时间线上插值，避免边界处突变
    let p0Idx = -1;
    for (let step = 0; step < frameCount; step++) {
      const idx = (i0 - step + frameCount) % frameCount;
      if (isUsableActiveAt(idx)) {
        p0Idx = idx;
        break;
      }
    }
    let p1Idx = -1;
    for (let step = 0; step < frameCount; step++) {
      const idx = (i1 + step) % frameCount;
      if (isUsableActiveAt(idx)) {
        p1Idx = idx;
        break;
      }
    }

    const p0 = p0Idx >= 0 ? frameBones[p0Idx]?.[boneIndex] : null;
    const p1 = p1Idx >= 0 ? frameBones[p1Idx]?.[boneIndex] : null;
    if (p0 && p1) {
      if (p0Idx === p1Idx) return p0;
      const p0Pos = p0Idx <= i0 ? p0Idx : p0Idx - frameCount;
      let p1Pos = p1Idx >= i1 ? p1Idx : p1Idx + frameCount;
      if (p1Pos <= p0Pos) p1Pos += frameCount;
      let tPos = tRaw;
      if (tPos < p0Pos) tPos += frameCount;
      const span = p1Pos - p0Pos;
      const frac = span > 1e-6 ? Math.max(0, Math.min(1, (tPos - p0Pos) / span)) : 0;
      return {
        pos: {
          x: p0.pos.x + (p1.pos.x - p0.pos.x) * frac,
          y: p0.pos.y + (p1.pos.y - p0.pos.y) * frac,
        },
        rotation: this._lerpAngleShortest(p0.rotation, p1.rotation, frac),
        scale: {
          x: p0.scale.x + (p1.scale.x - p0.scale.x) * frac,
          y: p0.scale.y + (p1.scale.y - p0.scale.y) * frac,
        },
        active: true,
      };
    }
    if (p0) return p0;
    if (p1) return p1;
    return null;
  }

  private _selectActiveLayers(): AnimationLayerController[] {
    const active = this._layers.filter((l) => l.visible);
    if (active.length > 0) return active;
    if (this._layers.length > 0) return [this._layers[0]];
    return [];
  }

  private _applyAnimation(deltaTime: number): Float32Array | null {
    const activeLayers = this._selectActiveLayers();
    if (activeLayers.length === 0) return null;

    const numBones = activeLayers[0].animation.numBones;
    if (numBones <= 0) return null;
    this._physics.ensureCount(numBones);
    if (this._boneWorldX.length !== numBones) {
      this._boneWorldX = new Float32Array(numBones);
      this._boneWorldY = new Float32Array(numBones);
      this._boneWorldRot = new Float32Array(numBones);
      this._boneScaleX = new Float32Array(numBones);
      this._boneScaleY = new Float32Array(numBones);
    }

    const scale = this._anim.coverScale;
    const boneDelta = new Float32Array(numBones * 5);
    // 每根骨骼只由第一个动画层处理：多层共享同骨架的 rest pose 数据相同，
    // 多层累加会导致 delta 被放大 N 倍，经父链传播后造成头身分离。
    const boneDone = new Uint8Array(numBones);
    for (let bi = 0; bi < numBones; bi++) {
      boneDelta[bi * 5 + 3] = 1;
      boneDelta[bi * 5 + 4] = 1;
    }

    for (const layer of activeLayers) {
      const layerAnim = layer.animation;
      const frameCount = layerAnim.numFrames;
      if (frameCount <= 0 || layerAnim.fps <= 1e-6) continue;
      const duration = frameCount / layerAnim.fps;
      const extra = (layerAnim.extra || '').toLowerCase();
      const isSingle = extra.includes('single');
      const isMirror = extra.includes('mirror');
      const isNonLoop = isSingle || isMirror;
      const tAbs = layer.time;
      let rawFramePos = 0;
      if (isSingle) {
        rawFramePos = (Math.max(0, Math.min(duration, tAbs)) / duration) * frameCount;
      } else if (isMirror) {
        const cycleDuration = duration * 2;
        const tCycle = ((tAbs % cycleDuration) + cycleDuration) % cycleDuration;
        const tForward = tCycle <= duration ? tCycle : (cycleDuration - tCycle);
        rawFramePos = (tForward / duration) * frameCount;
      } else {
        const t = ((tAbs % duration) + duration) % duration;
        rawFramePos = (t / duration) * frameCount;
      }
      const restPose = layerAnim.restPose;
      if (!restPose || restPose.length === 0) continue;
      const layerBones = Math.min(layerAnim.numBones, numBones);
      for (let bi = 0; bi < layerBones; bi++) {
        if (boneDone[bi]) continue;
        const rest = restPose[bi];
        if (!rest) continue;
        const sampled = this._sampleBoneSparse(layerAnim, rawFramePos, frameCount, bi, isNonLoop);
        if (!sampled) continue;
        boneDone[bi] = 1;
        const unreliable = rest.restInactive || rest.restRotationCorrected;
        const blendFactor = unreliable ? 1 : layer.blend;
        const dx = (sampled.pos.x - rest.pos.x) * scale * blendFactor;
        const dy = (sampled.pos.y - rest.pos.y) * scale * blendFactor;
        const dr = this._wrapAngle(sampled.rotation - rest.rotation) * blendFactor;
        boneDelta[bi * 5 + 0] += dx;
        boneDelta[bi * 5 + 1] += dy;
        boneDelta[bi * 5 + 2] += dr;
        const absScale = {
          x: Number.isFinite(sampled.scale.x) ? sampled.scale.x : 1,
          y: Number.isFinite(sampled.scale.y) ? sampled.scale.y : 1,
        };
        boneDelta[bi * 5 + 3] *= 1 + (absScale.x - 1) * blendFactor;
        boneDelta[bi * 5 + 4] *= 1 + (absScale.y - 1) * blendFactor;
      }
    }

    const restPose = activeLayers[0].animation.restPose;
    if (!restPose || restPose.length === 0) return null;
    const boneRestWorldX = new Float32Array(numBones);
    const boneRestWorldY = new Float32Array(numBones);
    for (let bi = 0; bi < numBones; bi++) {
      const bone = this._anim.bones[bi];
      const rest = restPose[bi];
      const localX = (bone?.local.x ?? rest?.pos.x ?? 0) * scale;
      const localY = (bone?.local.y ?? rest?.pos.y ?? 0) * scale;
      const parentIdx = bone?.parentIndex ?? -1;
      if (parentIdx >= 0 && parentIdx < bi) {
        boneRestWorldX[bi] = boneRestWorldX[parentIdx] + localX;
        boneRestWorldY[bi] = boneRestWorldY[parentIdx] + localY;
      } else {
        boneRestWorldX[bi] = localX;
        boneRestWorldY[bi] = localY;
      }
    }
    for (let bi = 0; bi < numBones; bi++) {
      const bone = this._anim.bones[bi];
      const parentIdx = bone?.parentIndex ?? -1;
      if (parentIdx < 0 || parentIdx >= numBones || parentIdx === bi) continue;
      const pdx = boneDelta[parentIdx * 5 + 0];
      const pdy = boneDelta[parentIdx * 5 + 1];
      const pRot = boneDelta[parentIdx * 5 + 2];
      const relX = boneRestWorldX[bi] - boneRestWorldX[parentIdx];
      const relY = boneRestWorldY[bi] - boneRestWorldY[parentIdx];
      const cosR = Math.cos(pRot);
      const sinR = Math.sin(pRot);
      boneDelta[bi * 5 + 0] += pdx + (relX * cosR - relY * sinR - relX);
      boneDelta[bi * 5 + 1] += pdy + (relX * sinR + relY * cosR - relY);
      boneDelta[bi * 5 + 2] += pRot;
    }

    for (let bi = 0; bi < numBones; bi++) {
      this._boneWorldX[bi] = boneRestWorldX[bi] + boneDelta[bi * 5 + 0];
      this._boneWorldY[bi] = boneRestWorldY[bi] + boneDelta[bi * 5 + 1];
      this._boneWorldRot[bi] = boneDelta[bi * 5 + 2];
      this._boneScaleX[bi] = boneDelta[bi * 5 + 3];
      this._boneScaleY[bi] = boneDelta[bi * 5 + 4];
    }

    // local overrides
    for (const [bi, t] of this._manualLocal) {
      if (bi < 0 || bi >= numBones) continue;
      const parent = this._anim.bones[bi]?.parentIndex ?? -1;
      if (parent >= 0 && parent < numBones) {
        this._boneWorldX[bi] = this._boneWorldX[parent] + t.pos.x;
        this._boneWorldY[bi] = this._boneWorldY[parent] + t.pos.y;
      } else {
        this._boneWorldX[bi] = t.pos.x;
        this._boneWorldY[bi] = t.pos.y;
      }
      this._boneWorldRot[bi] = t.rotation;
      this._boneScaleX[bi] = t.scale.x;
      this._boneScaleY[bi] = t.scale.y;
    }
    // world overrides
    for (const [bi, t] of this._manualWorld) {
      if (bi < 0 || bi >= numBones) continue;
      this._boneWorldX[bi] = t.pos.x;
      this._boneWorldY[bi] = t.pos.y;
      this._boneWorldRot[bi] = t.rotation;
      this._boneScaleX[bi] = t.scale.x;
      this._boneScaleY[bi] = t.scale.y;
    }

    // physics
    for (let bi = 0; bi < numBones; bi++) {
      const c = this._anim.bones[bi]?.constraint;
      const p = this._physics.step(bi, {
        x: this._boneWorldX[bi],
        y: this._boneWorldY[bi],
        rotation: this._boneWorldRot[bi],
        defaultPos: { x: boneRestWorldX[bi], y: boneRestWorldY[bi] },
        defaultRotation: 0,
        constraint: c,
      }, deltaTime);
      this._boneWorldX[bi] = p.x;
      this._boneWorldY[bi] = p.y;
      this._boneWorldRot[bi] = p.rotation;
    }

    // blend rules
    for (let bi = 0; bi < numBones; bi++) {
      const bone = this._anim.bones[bi];
      const c = bone?.constraint;
      if (!bone || !c || !c.blendRules || c.blendRules.length === 0) continue;
      const p = this._blendRules.apply(
        bone.name,
        { x: this._boneWorldX[bi], y: this._boneWorldY[bi] },
        this._nameToBoneIndex,
        this._boneWorldX,
        this._boneWorldY,
        c.blendRules,
      );
      this._boneWorldX[bi] = p.x;
      this._boneWorldY[bi] = p.y;
    }

    // IK: 基于约束标记，尝试将 parent->bone->child 当作 two-bone chain
    for (let bi = 0; bi < numBones; bi++) {
      const bone = this._anim.bones[bi];
      const c = bone?.constraint;
      if (!bone || !c || !c.ikEnabled) continue;
      const mid = bi;
      const root = bone.parentIndex;
      if (root < 0 || root >= numBones) continue;
      const end = this._anim.bones.findIndex((b) => b.parentIndex === mid);
      if (end < 0) continue;
      this._ikSolver.solveTwoBone(
        {
          root,
          mid,
          end,
          target: { x: this._boneWorldX[end], y: this._boneWorldY[end] },
          pole: {
            x: this._boneWorldX[mid] + Math.cos((c.ikAngleAlignment * Math.PI) / 180),
            y: this._boneWorldY[mid] + Math.sin((c.ikAngleAlignment * Math.PI) / 180),
          },
        },
        this._boneWorldX,
        this._boneWorldY,
        this._boneWorldRot,
      );
    }

    // morph base
    const baseVerts = this._morphSystem ? this._morphBuffer : this._restVerts;
    if (this._morphSystem) this._morphSystem.apply(this._restVerts, this._morphBuffer);
    const newVerts = this._vertsBuffer;
    const vertCount = newVerts.length / 3;
    const boneIdx = this._anim.boneIndices;
    const boneWgt = this._anim.boneWeights;
    const boneIdx4 = this._anim.boneIndices4;
    const boneWgt4 = this._anim.boneWeights4;
    const useFourInfluences =
      !!boneIdx4 &&
      !!boneWgt4 &&
      boneIdx4.length >= vertCount * 4 &&
      boneWgt4.length >= vertCount * 4;

    for (let vi = 0; vi < vertCount; vi++) {
      const vx = baseVerts[vi * 3];
      const vy = baseVerts[vi * 3 + 1];
      const vz = baseVerts[vi * 3 + 2];
      if (useFourInfluences) {
        let accumX = 0;
        let accumY = 0;
        let accumZ = 0;
        let weightSum = 0;
        const base = vi * 4;
        for (let k = 0; k < 4; k++) {
          const weight = boneWgt4![base + k];
          if (weight <= 0.001) continue;
          const bi = boneIdx4![base + k];
          if (bi >= numBones) continue;
          const offX = vx - boneRestWorldX[bi];
          const offY = vy - boneRestWorldY[bi];
          const scaledOffX = offX * this._boneScaleX[bi];
          const scaledOffY = offY * this._boneScaleY[bi];
          const cosR = Math.cos(this._boneWorldRot[bi]);
          const sinR = Math.sin(this._boneWorldRot[bi]);
          const rotatedX = scaledOffX * cosR - scaledOffY * sinR;
          const rotatedY = scaledOffX * sinR + scaledOffY * cosR;
          const finalX = this._boneWorldX[bi] + rotatedX;
          const finalY = this._boneWorldY[bi] + rotatedY;
          accumX += finalX * weight;
          accumY += finalY * weight;
          accumZ += vz * weight;
          weightSum += weight;
        }
        if (weightSum <= 0.001) {
          newVerts[vi * 3] = vx;
          newVerts[vi * 3 + 1] = vy;
          newVerts[vi * 3 + 2] = vz;
        } else {
          newVerts[vi * 3] = accumX / weightSum;
          newVerts[vi * 3 + 1] = accumY / weightSum;
          newVerts[vi * 3 + 2] = accumZ / weightSum;
        }
        continue;
      }
      const bi = boneIdx[vi];
      const weight = boneWgt[vi];
      if (bi >= numBones || weight <= 0.001) {
        newVerts[vi * 3] = vx;
        newVerts[vi * 3 + 1] = vy;
        newVerts[vi * 3 + 2] = vz;
        continue;
      }
      const offX = vx - boneRestWorldX[bi];
      const offY = vy - boneRestWorldY[bi];
      const scaledOffX = offX * this._boneScaleX[bi];
      const scaledOffY = offY * this._boneScaleY[bi];
      const cosR = Math.cos(this._boneWorldRot[bi]);
      const sinR = Math.sin(this._boneWorldRot[bi]);
      const rotatedX = scaledOffX * cosR - scaledOffY * sinR;
      const rotatedY = scaledOffX * sinR + scaledOffY * cosR;
      const finalX = this._boneWorldX[bi] + rotatedX;
      const finalY = this._boneWorldY[bi] + rotatedY;
      newVerts[vi * 3] = vx + (finalX - vx) * weight;
      newVerts[vi * 3 + 1] = vy + (finalY - vy) * weight;
      newVerts[vi * 3 + 2] = vz;
    }

    return newVerts;
  }

  // SceneScript API helpers
  getBoneCount(): number { return this._anim.bones.length; }
  getBoneIndex(name: string): number { return this._nameToBoneIndex.get(name) ?? -1; }
  getBoneParentIndex(bone: number | string): number {
    const i = typeof bone === 'number' ? bone : this.getBoneIndex(bone);
    if (i < 0 || i >= this._anim.bones.length) return -1;
    return this._anim.bones[i].parentIndex;
  }

  private _resolveBoneRef(bone: number | string): number {
    if (typeof bone === 'number') return bone;
    return this.getBoneIndex(bone);
  }

  private _makeMat4(x: number, y: number, rot: number, sx = 1, sy = 1): number[] {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [
      c * sx, s * sx, 0, 0,
      -s * sy, c * sy, 0, 0,
      0, 0, 1, 0,
      x, y, 0, 1,
    ];
  }

  private _decomposeMat4(m: ArrayLike<number>): ManualBoneTransform {
    const x = Number(m[12] ?? 0);
    const y = Number(m[13] ?? 0);
    const a = Number(m[0] ?? 1);
    const b = Number(m[1] ?? 0);
    const c = Number(m[4] ?? 0);
    const d = Number(m[5] ?? 1);
    const decomposedScale = {
      x: Math.hypot(a, b) || 1,
      y: Math.hypot(c, d) || 1,
    };
    const rotation = Math.atan2(b, a);
    return {
      pos: { x, y },
      rotation,
      scale: { x: decomposedScale.x, y: decomposedScale.y },
    };
  }

  getBoneTransform(bone: number | string): number[] {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._boneWorldX.length) return this._makeMat4(0, 0, 0, 1, 1);
    return this._makeMat4(this._boneWorldX[i], this._boneWorldY[i], this._boneWorldRot[i], this._boneScaleX[i], this._boneScaleY[i]);
  }

  setBoneTransform(bone: number | string, transform: ArrayLike<number>): void {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return;
    this._manualWorld.set(i, this._decomposeMat4(transform));
    this._dirtyFromScript = true;
  }

  getLocalBoneTransform(bone: number | string): number[] {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return this._makeMat4(0, 0, 0, 1, 1);
    const parent = this._anim.bones[i].parentIndex;
    if (parent >= 0 && parent < this._boneWorldX.length) {
      return this._makeMat4(
        this._boneWorldX[i] - this._boneWorldX[parent],
        this._boneWorldY[i] - this._boneWorldY[parent],
        this._boneWorldRot[i] - this._boneWorldRot[parent],
        this._boneScaleX[i],
        this._boneScaleY[i],
      );
    }
    return this._makeMat4(this._boneWorldX[i], this._boneWorldY[i], this._boneWorldRot[i], this._boneScaleX[i], this._boneScaleY[i]);
  }

  setLocalBoneTransform(bone: number | string, transform: ArrayLike<number>): void {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return;
    this._manualLocal.set(i, this._decomposeMat4(transform));
    this._dirtyFromScript = true;
  }

  getLocalBoneAngles(bone: number | string): Vec3Like {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._boneWorldRot.length) return { x: 0, y: 0, z: 0 };
    return { x: 0, y: 0, z: this._boneWorldRot[i] };
  }

  setLocalBoneAngles(bone: number | string, angles: Partial<Vec3Like>): void {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return;
    const prev = this._manualLocal.get(i) ?? this._createDefaultManualTransform();
    prev.rotation = Number(angles.z ?? prev.rotation);
    this._manualLocal.set(i, prev);
    this._dirtyFromScript = true;
  }

  getLocalBoneOrigin(bone: number | string): Vec3Like {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return { x: 0, y: 0, z: 0 };
    const parent = this._anim.bones[i].parentIndex;
    if (parent >= 0 && parent < this._boneWorldX.length) {
      return { x: this._boneWorldX[i] - this._boneWorldX[parent], y: this._boneWorldY[i] - this._boneWorldY[parent], z: 0 };
    }
    return { x: this._boneWorldX[i] ?? 0, y: this._boneWorldY[i] ?? 0, z: 0 };
  }

  setLocalBoneOrigin(bone: number | string, origin: Partial<Vec3Like>): void {
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return;
    const prev = this._manualLocal.get(i) ?? this._createDefaultManualTransform();
    prev.pos.x = Number(origin.x ?? prev.pos.x);
    prev.pos.y = Number(origin.y ?? prev.pos.y);
    this._manualLocal.set(i, prev);
    this._dirtyFromScript = true;
  }

  private _createDefaultManualTransform(): ManualBoneTransform {
    return {
      pos: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
    };
  }

  applyBonePhysicsImpulse(bone: number | string | undefined, directional: Partial<Vec2Like>, angular: Partial<Vec3Like>): void {
    const vx = Number(directional.x ?? 0);
    const vy = Number(directional.y ?? 0);
    const va = Number(angular.z ?? 0);
    if (bone === undefined || bone === null) {
      for (let i = 0; i < this._anim.bones.length; i++) {
        this._physics.applyImpulse(i, { x: vx, y: vy }, va);
      }
      return;
    }
    const i = this._resolveBoneRef(bone);
    if (i < 0 || i >= this._anim.bones.length) return;
    this._physics.applyImpulse(i, { x: vx, y: vy }, va);
  }

  resetBonePhysicsSimulation(bone?: number | string): void {
    if (bone === undefined || bone === null) this._physics.reset();
    else this._physics.reset(this._resolveBoneRef(bone));
  }

  getBlendShapeIndex(name: string): number {
    if (!this._morphSystem) return -1;
    return this._morphSystem.getIndexByName(name);
  }

  getBlendShapeWeight(blendShape: number | string): number {
    if (!this._morphSystem) return 0;
    return this._morphSystem.getWeight(blendShape);
  }

  setBlendShapeWeight(blendShape: number | string, weight: number): void {
    if (!this._morphSystem) return;
    this._morphSystem.setWeight(blendShape, weight);
    this._dirtyFromScript = true;
  }

  // AnimationLayer runtime API
  getAnimationLayerCount(): number { return this._layers.length; }
  getAnimationLayer(ref: string | number): AnimationLayerController | null {
    if (typeof ref === 'number') return this._layers[ref] ?? null;
    return this._layers.find((l) => l.name === ref) ?? null;
  }
  createAnimationLayer(ref: string | { animation?: number; name?: string; rate?: number; blend?: number; visible?: boolean }): AnimationLayerController | null {
    let anim: MdlAnimation | null = null;
    let name = '';
    let rate = 1;
    let blend = 1;
    let visible = true;
    if (typeof ref === 'string') {
      anim = this._anim.animations.find((a) => a.name === ref) ?? null;
      name = ref;
    } else {
      const animRef = ref.animation ?? 0;
      anim = this._anim.animations.find((a, i) => i === animRef || a.id === animRef) ?? null;
      name = ref.name ?? anim?.name ?? `layer_${this._layers.length}`;
      rate = ref.rate ?? 1;
      blend = ref.blend ?? 1;
      visible = ref.visible ?? true;
    }
    if (!anim) return null;
    const layer = new AnimationLayerController({ name, animation: anim, rate, blend, visible });
    this._layers.push(layer);
    this._dirtyFromScript = true;
    return layer;
  }

  playSingleAnimation(ref: string | { animation?: number; name?: string; rate?: number; blend?: number; visible?: boolean }): AnimationLayerController | null {
    const l = this.createAnimationLayer(ref);
    if (!l) return null;
    l.playSingle = true;
    l.play();
    l.addEndedCallback(() => this.destroyAnimationLayer(l));
    return l;
  }

  destroyAnimationLayer(ref: string | number | AnimationLayerController): boolean {
    const idx = typeof ref === 'string'
      ? this._layers.findIndex((l) => l.name === ref)
      : typeof ref === 'number'
        ? ref
        : this._layers.indexOf(ref);
    if (idx < 0 || idx >= this._layers.length) return false;
    this._layers.splice(idx, 1);
    this._dirtyFromScript = true;
    return true;
  }
}
