import type { BoneConstraintConfig } from './rig/BoneConstraint';
import type { Vec2Like } from '../../math';

/** 单个骨骼的配置（从 MDLS 段解析） */
export interface MdlBoneData {
  /** 骨骼名称 */
  name: string;
  /** 父骨骼索引 (-1 = 根骨骼) */
  parentIndex: number;
  /** 本地位移 (4x4 矩阵中的 translation, 图像中心坐标系) */
  local: Vec2Like;
  /** 骨骼完整 4x4 变换矩阵（列主序） */
  localMatrix: Float32Array;
  /** 解析后的可视骨骼名称 */
  displayName?: string;
  /** 骨骼约束（来自名称里的 JSON 配置） */
  constraint?: BoneConstraintConfig;
  /** 原始骨骼名称字段 */
  rawName?: string;
}

/** 单个动画帧中，单个骨骼的变换 */
export interface MdlAnimBoneFrame {
  pos: Vec2Like;
  rotation: number;
  scale: Vec2Like;
  /** 该骨骼帧是否包含有效数据。 */
  active: boolean;
  /** rest pose 在原始数据中为 inactive（该动画不控制此骨骼） */
  restInactive?: boolean;
  /** rest pose 的 rotation 原始值为污染值(≈1.0)，已被修正；该动画对此骨骼的数据不可靠 */
  restRotationCorrected?: boolean;
}

/** 一个完整动画 (来自 MDLA 段) */
export interface MdlAnimation {
  /** 动画 ID (在 scene.json animationlayers.animation 中引用) */
  id: number;
  /** 动画名称 */
  name: string;
  /** FPS */
  fps: number;
  /** 帧数 (不包含初始 rest pose) */
  numFrames: number;
  /** 骨骼数量 */
  numBones: number;
  /** 每帧每骨骼变换: frames[frameIndex][boneIndex] */
  frames: MdlAnimBoneFrame[][];
  /** 初始姿态 (frame 0) */
  restPose: MdlAnimBoneFrame[];
  /** 额外属性 (如 "mirror") */
  extra: string;
}
