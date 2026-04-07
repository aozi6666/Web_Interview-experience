import { Bone, BoneConfig, BoneTransform } from './Bone';
import type { BoneScalarSample } from './Bone';

/**
 * 骨骼系统配置
 */
export interface SkeletonConfig {
  /** 骨骼列表 */
  bones: BoneConfig[];
}

/**
 * 骨骼系统
 * 
 * 管理骨骼层级结构，提供骨骼查找、姿态更新等功能。
 */
export class Skeleton {
  /** 根骨骼 */
  private _root: Bone | null = null;
  
  /** 所有骨骼的映射表 */
  private _bones: Map<string, Bone> = new Map();
  
  /** 骨骼数组（按顺序） */
  private _boneArray: Bone[] = [];
  
  /** 骨骼矩阵数组（用于着色器） */
  private _boneMatrices: Float32Array;
  
  constructor(config?: SkeletonConfig) {
    this._boneMatrices = new Float32Array(0);
    
    if (config) {
      this.buildFromConfig(config);
    }
  }
  
  /**
   * 获取根骨骼
   */
  get root(): Bone | null {
    return this._root;
  }
  
  /**
   * 获取骨骼数量
   */
  get boneCount(): number {
    return this._bones.size;
  }
  
  /**
   * 获取所有骨骼
   */
  get bones(): Bone[] {
    return this._boneArray;
  }
  
  /**
   * 从配置构建骨骼层级
   */
  buildFromConfig(config: SkeletonConfig): void {
    this._bones.clear();
    this._boneArray = [];
    this._root = null;
    
    // 第一遍：创建所有骨骼
    for (const boneConfig of config.bones) {
      const bone = new Bone(boneConfig);
      this._bones.set(bone.id, bone);
      this._boneArray.push(bone);
    }
    
    // 第二遍：建立父子关系
    for (const boneConfig of config.bones) {
      const bone = this._bones.get(boneConfig.id);
      if (!bone) continue;
      
      if (boneConfig.parentId) {
        const parent = this._bones.get(boneConfig.parentId);
        if (parent) {
          parent.addChild(bone);
        }
      } else {
        // 没有父骨骼，是根骨骼
        if (!this._root) {
          this._root = bone;
        }
      }
    }
    
    // 初始化骨骼矩阵数组
    this._boneMatrices = new Float32Array(this._bones.size * 16);
    
    // 计算初始绑定姿态的逆矩阵
    this.computeInverseBindMatrices();
  }
  
  /**
   * 通过ID获取骨骼
   */
  getBone(id: string): Bone | undefined {
    return this._bones.get(id);
  }
  
  /**
   * 通过名称获取骨骼
   */
  getBoneByName(name: string): Bone | undefined {
    for (const bone of this._bones.values()) {
      if (bone.name === name) {
        return bone;
      }
    }
    return undefined;
  }
  
  /**
   * 通过索引获取骨骼
   */
  getBoneByIndex(index: number): Bone | undefined {
    return this._boneArray[index];
  }
  
  /**
   * 获取骨骼的索引
   */
  getBoneIndex(bone: Bone): number {
    return this._boneArray.indexOf(bone);
  }
  
  /**
   * 添加骨骼
   */
  addBone(bone: Bone, parent?: Bone): void {
    this._bones.set(bone.id, bone);
    this._boneArray.push(bone);
    
    if (parent) {
      parent.addChild(bone);
    } else if (!this._root) {
      this._root = bone;
    }
    
    // 重新分配矩阵数组
    this._boneMatrices = new Float32Array(this._bones.size * 16);
  }
  
  /**
   * 计算所有骨骼的逆绑定矩阵
   */
  computeInverseBindMatrices(): void {
    if (this._root) {
      this._root.traverse((bone) => {
        bone.computeInverseBindMatrix();
      });
    }
  }
  
  /**
   * 更新骨骼矩阵数组
   * 返回用于着色器的矩阵数组
   */
  updateBoneMatrices(): Float32Array {
    let offset = 0;
    
    for (const bone of this._boneArray) {
      const matrix = bone.getBoneMatrix();
      this._boneMatrices.set(matrix, offset);
      offset += 16;
    }
    
    return this._boneMatrices;
  }
  
  /**
   * 获取骨骼矩阵数组
   */
  getBoneMatrices(): Float32Array {
    return this._boneMatrices;
  }
  
  /**
   * 重置到绑定姿态
   */
  resetToBindPose(): void {
    // 这里需要存储原始绑定姿态
    // 简单实现：将所有骨骼的变换重置为单位变换
    for (const bone of this._boneArray) {
      bone.setLocalTransform({
        pos: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      });
    }
  }
  
  /**
   * 应用姿态
   * @param pose 姿态数据，键为骨骼ID，值为变换
   */
  applyPose(pose: Map<string, BoneScalarSample>): void {
    for (const [boneId, transform] of pose) {
      const bone = this._bones.get(boneId);
      if (bone) {
        bone.setLocalTransform(transform);
      }
    }
  }
  
  /**
   * 获取当前姿态
   */
  getCurrentPose(): Map<string, BoneTransform> {
    const pose = new Map<string, BoneTransform>();
    
    for (const bone of this._boneArray) {
      pose.set(bone.id, { ...bone.getLocalTransform() });
    }
    
    return pose;
  }
  
  /**
   * 遍历所有骨骼
   */
  traverse(callback: (bone: Bone, index: number) => void): void {
    this._boneArray.forEach((bone, index) => callback(bone, index));
  }
  
  /**
   * 克隆骨骼系统
   */
  clone(): Skeleton {
    const cloned = new Skeleton();
    
    // 创建骨骼配置
    const configs: BoneConfig[] = this._boneArray.map((bone) => ({
      id: bone.id,
      name: bone.name,
      parentId: bone.parent?.id || null,
      localTransform: { ...bone.getLocalTransform() },
      length: bone.length,
    }));
    
    cloned.buildFromConfig({ bones: configs });
    
    return cloned;
  }
}
