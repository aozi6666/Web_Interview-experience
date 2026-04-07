import type { BoneScalarSample } from '../rig/Bone';
import type { Skeleton } from '../rig/Skeleton';

type BoneAnimScalarProperty = keyof BoneScalarSample;

/**
 * 关键帧数据
 */
export interface Keyframe {
  /** 时间（秒） */
  time: number;
  /** 值 */
  value: number;
  /** 入切线（用于曲线插值） */
  inTangent?: number;
  /** 出切线 */
  outTangent?: number;
}

/**
 * 动画轨道 - 单个属性的动画
 */
export interface AnimationTrack {
  /** 目标骨骼ID */
  boneId: string;
  /** 属性名称 */
  property: BoneAnimScalarProperty;
  /** 关键帧列表 */
  keyframes: Keyframe[];
}

/**
 * 动画片段配置
 */
export interface AnimationClipConfig {
  /** 动画名称 */
  name: string;
  /** 动画时长（秒） */
  duration: number;
  /** 动画轨道列表 */
  tracks: AnimationTrack[];
  /** 是否循环 */
  loop?: boolean;
}

/**
 * 插值类型
 */
export enum InterpolationType {
  Linear = 'linear',
  Step = 'step',
  CatmullRom = 'catmull_rom',
  Bezier = 'bezier',
}

/**
 * 动画片段
 * 
 * 包含一组动画轨道，每个轨道控制一个骨骼的一个属性。
 */
export class AnimationClip {
  /** 动画名称 */
  readonly name: string;
  
  /** 动画时长（秒） */
  readonly duration: number;
  
  /** 是否循环 */
  loop: boolean;
  
  /** 动画轨道 */
  private _tracks: AnimationTrack[];
  
  /** 按骨骼ID索引的轨道 */
  private _tracksByBone: Map<string, AnimationTrack[]>;

  /** 采样结果缓存（每帧复用，减少 Map/对象分配） */
  private _sampleResult: Map<string, BoneScalarSample> = new Map();
  private _sampleTransformPool: Map<string, BoneScalarSample> = new Map();
  
  constructor(config: AnimationClipConfig) {
    this.name = config.name;
    this.duration = config.duration;
    this.loop = config.loop ?? true;
    this._tracks = config.tracks;
    
    // 建立骨骼到轨道的索引
    this._tracksByBone = new Map();
    for (const track of this._tracks) {
      const tracks = this._tracksByBone.get(track.boneId) || [];
      tracks.push(track);
      this._tracksByBone.set(track.boneId, tracks);
    }
  }
  
  /**
   * 获取所有轨道
   */
  get tracks(): AnimationTrack[] {
    return this._tracks;
  }
  
  /**
   * 获取指定骨骼的轨道
   */
  getTracksForBone(boneId: string): AnimationTrack[] {
    return this._tracksByBone.get(boneId) || [];
  }
  
  /**
   * 在指定时间采样动画
   * @param time 时间（秒）
   * @returns 骨骼变换映射
   */
  sample(time: number): Map<string, BoneScalarSample> {
    const result = this._sampleResult;
    result.clear();
    
    // 处理循环
    let t = time;
    if (this.loop && this.duration > 0) {
      t = t % this.duration;
    } else {
      t = Math.max(0, Math.min(t, this.duration));
    }
    
    // 采样每个轨道
    for (const track of this._tracks) {
      const value = this.sampleTrack(track, t);
      
      let boneTransform = result.get(track.boneId);
      if (!boneTransform) {
        boneTransform = this._sampleTransformPool.get(track.boneId);
        if (!boneTransform) {
          boneTransform = {};
          this._sampleTransformPool.set(track.boneId, boneTransform);
        } else {
          boneTransform.x = undefined;
          boneTransform.y = undefined;
          boneTransform.rotation = undefined;
          boneTransform.scaleX = undefined;
          boneTransform.scaleY = undefined;
        }
        result.set(track.boneId, boneTransform);
      }
      
      boneTransform[track.property] = value;
    }
    
    return result;
  }
  
  /**
   * 采样单个轨道
   */
  private sampleTrack(track: AnimationTrack, time: number): number {
    const keyframes = track.keyframes;
    
    if (keyframes.length === 0) {
      return 0;
    }
    
    if (keyframes.length === 1) {
      return keyframes[0].value;
    }
    
    // 找到时间所在的关键帧区间
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];
    
    if (time <= k0.time) {
      return k0.value;
    }
    
    if (time >= k1.time) {
      return k1.value;
    }
    
    // 二分查找关键帧区间 [k0, k1]
    let lo = 0;
    let hi = keyframes.length - 2;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const left = keyframes[mid];
      const right = keyframes[mid + 1];
      if (time < left.time) {
        hi = mid - 1;
      } else if (time >= right.time) {
        lo = mid + 1;
      } else {
        k0 = left;
        k1 = right;
        break;
      }
    }
    
    // 计算插值因子
    const t = (time - k0.time) / (k1.time - k0.time);
    
    // 线性插值（可以扩展为其他插值方式）
    return this.lerp(k0.value, k1.value, t);
  }
  
  /**
   * 线性插值
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

/**
 * 动画播放状态
 */
export enum AnimationState {
  Stopped = 'stopped',
  Playing = 'playing',
  Paused = 'paused',
}

/**
 * 动画混合层
 */
interface AnimationLayer {
  clip: AnimationClip;
  weight: number;
  time: number;
  speed: number;
  state: AnimationState;
}

/**
 * 动画控制器
 * 
 * 管理动画播放、混合、过渡等。
 */
export class AnimationController {
  /** 关联的骨骼系统 */
  private _skeleton: Skeleton;
  
  /** 动画片段库 */
  private _clips: Map<string, AnimationClip> = new Map();
  
  /** 当前播放的动画层 */
  private _layers: AnimationLayer[] = [];
  
  /** 默认混合层 */
  private _defaultLayer: AnimationLayer | null = null;
  
  constructor(skeleton: Skeleton) {
    this._skeleton = skeleton;
  }
  
  /**
   * 添加动画片段
   */
  addClip(clip: AnimationClip): void {
    this._clips.set(clip.name, clip);
  }
  
  /**
   * 获取动画片段
   */
  getClip(name: string): AnimationClip | undefined {
    return this._clips.get(name);
  }
  
  /**
   * 播放动画
   */
  play(clipName: string, fadeTime = 0.2, speed = 1.0): void {
    const clip = this._clips.get(clipName);
    if (!clip) {
      console.warn(`AnimationController: 动画片段不存在 ${clipName}`);
      return;
    }
    
    // 简单实现：直接替换当前动画
    this._defaultLayer = {
      clip,
      weight: 1.0,
      time: 0,
      speed,
      state: AnimationState.Playing,
    };
  }
  
  /**
   * 停止动画
   */
  stop(): void {
    if (this._defaultLayer) {
      this._defaultLayer.state = AnimationState.Stopped;
      this._defaultLayer.time = 0;
    }
  }
  
  /**
   * 暂停动画
   */
  pause(): void {
    if (this._defaultLayer) {
      this._defaultLayer.state = AnimationState.Paused;
    }
  }
  
  /**
   * 继续播放
   */
  resume(): void {
    if (this._defaultLayer && this._defaultLayer.state === AnimationState.Paused) {
      this._defaultLayer.state = AnimationState.Playing;
    }
  }
  
  /**
   * 设置播放速度
   */
  setSpeed(speed: number): void {
    if (this._defaultLayer) {
      this._defaultLayer.speed = speed;
    }
  }
  
  /**
   * 设置当前时间
   */
  setTime(time: number): void {
    if (this._defaultLayer) {
      this._defaultLayer.time = time;
    }
  }
  
  /**
   * 获取当前播放状态
   */
  getState(): AnimationState {
    return this._defaultLayer?.state ?? AnimationState.Stopped;
  }
  
  /**
   * 获取当前播放时间
   */
  getCurrentTime(): number {
    return this._defaultLayer?.time ?? 0;
  }
  
  /**
   * 更新动画
   * @param deltaTime 时间增量（秒）
   */
  update(deltaTime: number): void {
    if (!this._defaultLayer || this._defaultLayer.state !== AnimationState.Playing) {
      return;
    }
    
    const layer = this._defaultLayer;
    
    // 更新时间
    layer.time += deltaTime * layer.speed;
    
    // 处理循环
    if (layer.clip.loop) {
      if (layer.time >= layer.clip.duration) {
        layer.time = layer.time % layer.clip.duration;
      }
    } else {
      if (layer.time >= layer.clip.duration) {
        layer.time = layer.clip.duration;
        layer.state = AnimationState.Stopped;
      }
    }
    
    // 采样动画并应用到骨骼
    const pose = layer.clip.sample(layer.time);
    this._skeleton.applyPose(pose);
    
    // 更新骨骼矩阵
    this._skeleton.updateBoneMatrices();
  }
}
