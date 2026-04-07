import type { Vec2Like } from '../../../math';

/**
 * 骨骼节点变换数据
 */
export interface BoneTransform {
  /** 位置 */
  pos: Vec2Like;
  /** 旋转角度（弧度） */
  rotation: number;
  /** 缩放 */
  scale: Vec2Like;
}

export type BoneScalarSample = {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * 骨骼配置
 */
export interface BoneConfig {
  /** 骨骼ID */
  id: string;
  /** 骨骼名称 */
  name: string;
  /** 父骨骼ID（根骨骼为null） */
  parentId: string | null;
  /** 本地变换 */
  localTransform: BoneTransform;
  /** 骨骼长度 */
  length?: number;
}

/**
 * 骨骼节点
 * 
 * 表示骨骼层级中的一个节点。
 * 支持本地变换和世界变换的计算。
 */
export class Bone {
  /** 骨骼ID */
  readonly id: string;
  
  /** 骨骼名称 */
  name: string;
  
  /** 父骨骼 */
  parent: Bone | null = null;
  
  /** 子骨骼列表 */
  children: Bone[] = [];
  
  /** 骨骼长度 */
  length: number;
  
  /** 本地变换（相对于父骨骼） */
  private _localTransform: BoneTransform;
  
  /** 世界变换（相对于根） */
  private _worldTransform: BoneTransform;
  
  /** 绑定姿态的逆变换矩阵 (用于蒙皮计算) */
  private _inverseBindMatrix: Float32Array;
  
  /** 最终骨骼矩阵 (用于蒙皮计算) */
  private _boneMatrix: Float32Array;
  
  /** 世界变换是否需要更新 */
  private _worldDirty: boolean = true;

  /** 复用矩阵缓冲区，避免每帧分配 */
  private _worldMatrixBuf: Float32Array = new Float32Array(16);
  private _mulResultBuf: Float32Array = new Float32Array(16);
  
  constructor(config: BoneConfig) {
    this.id = config.id;
    this.name = config.name;
    this.length = config.length ?? 0;
    
    this._localTransform = {
      pos: { x: config.localTransform.pos.x, y: config.localTransform.pos.y },
      rotation: config.localTransform.rotation,
      scale: { x: config.localTransform.scale.x, y: config.localTransform.scale.y },
    };
    this._worldTransform = {
      pos: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
    };
    
    // 初始化为单位矩阵
    this._inverseBindMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    
    this._boneMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }
  
  // ==================== 本地变换 ====================
  
  get localX(): number {
    return this._localTransform.pos.x;
  }
  
  set localX(value: number) {
    this._localTransform.pos.x = value;
    this.markWorldDirty();
  }
  
  get localY(): number {
    return this._localTransform.pos.y;
  }
  
  set localY(value: number) {
    this._localTransform.pos.y = value;
    this.markWorldDirty();
  }
  
  get localRotation(): number {
    return this._localTransform.rotation;
  }
  
  set localRotation(value: number) {
    this._localTransform.rotation = value;
    this.markWorldDirty();
  }
  
  get localScaleX(): number {
    return this._localTransform.scale.x;
  }
  
  set localScaleX(value: number) {
    this._localTransform.scale.x = value;
    this.markWorldDirty();
  }
  
  get localScaleY(): number {
    return this._localTransform.scale.y;
  }
  
  set localScaleY(value: number) {
    this._localTransform.scale.y = value;
    this.markWorldDirty();
  }
  
  /**
   * 获取本地变换
   */
  getLocalTransform(): Readonly<BoneTransform> {
    return this._localTransform;
  }
  
  /**
   * 设置本地变换
   */
  setLocalTransform(transform: Partial<BoneTransform> | BoneScalarSample): void {
    const vecTransform = transform as Partial<BoneTransform>;
    if (vecTransform.pos) {
      if (vecTransform.pos.x !== undefined) this._localTransform.pos.x = vecTransform.pos.x;
      if (vecTransform.pos.y !== undefined) this._localTransform.pos.y = vecTransform.pos.y;
    }
    const scalar = transform as BoneScalarSample;
    if (scalar.x !== undefined) this._localTransform.pos.x = scalar.x;
    if (scalar.y !== undefined) this._localTransform.pos.y = scalar.y;
    if (transform.rotation !== undefined) this._localTransform.rotation = transform.rotation;
    if (vecTransform.scale) {
      if (vecTransform.scale.x !== undefined) this._localTransform.scale.x = vecTransform.scale.x;
      if (vecTransform.scale.y !== undefined) this._localTransform.scale.y = vecTransform.scale.y;
    }
    if (scalar.scaleX !== undefined) this._localTransform.scale.x = scalar.scaleX;
    if (scalar.scaleY !== undefined) this._localTransform.scale.y = scalar.scaleY;
    this.markWorldDirty();
  }
  
  // ==================== 世界变换 ====================
  
  get worldX(): number {
    this.updateWorldTransform();
    return this._worldTransform.pos.x;
  }
  
  get worldY(): number {
    this.updateWorldTransform();
    return this._worldTransform.pos.y;
  }
  
  get worldRotation(): number {
    this.updateWorldTransform();
    return this._worldTransform.rotation;
  }
  
  get worldScaleX(): number {
    this.updateWorldTransform();
    return this._worldTransform.scale.x;
  }
  
  get worldScaleY(): number {
    this.updateWorldTransform();
    return this._worldTransform.scale.y;
  }
  
  /**
   * 获取世界变换
   */
  getWorldTransform(): Readonly<BoneTransform> {
    this.updateWorldTransform();
    return this._worldTransform;
  }
  
  // ==================== 骨骼矩阵 ====================
  
  /**
   * 获取逆绑定矩阵
   */
  getInverseBindMatrix(): Float32Array {
    return this._inverseBindMatrix;
  }
  
  /**
   * 获取骨骼矩阵（用于蒙皮）
   */
  getBoneMatrix(): Float32Array {
    this.updateWorldTransform();
    return this._boneMatrix;
  }
  
  /**
   * 计算并存储绑定姿态的逆矩阵
   * 应在设置好初始姿态后调用
   */
  computeInverseBindMatrix(): void {
    this.updateWorldTransform();
    
    // 计算世界矩阵
    const worldMatrix = this.computeWorldMatrix();
    
    // 计算逆矩阵
    this._inverseBindMatrix = this.invertMatrix(worldMatrix);
  }
  
  // ==================== 层级操作 ====================
  
  /**
   * 添加子骨骼
   */
  addChild(child: Bone): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    child.markWorldDirty();
  }
  
  /**
   * 移除子骨骼
   */
  removeChild(child: Bone): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }
  
  /**
   * 遍历所有子骨骼（包括自身）
   */
  traverse(callback: (bone: Bone) => void): void {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 标记世界变换需要更新
   */
  private markWorldDirty(): void {
    this._worldDirty = true;
    for (const child of this.children) {
      child.markWorldDirty();
    }
  }
  
  /**
   * 更新世界变换
   */
  private updateWorldTransform(): void {
    if (!this._worldDirty) return;
    
    if (this.parent) {
      const parentWorld = this.parent.getWorldTransform();
      
      // 计算世界位置（考虑父骨骼的旋转和缩放）
      const cos = Math.cos(parentWorld.rotation);
      const sin = Math.sin(parentWorld.rotation);
      
      const localPos = {
        x: this._localTransform.pos.x * parentWorld.scale.x,
        y: this._localTransform.pos.y * parentWorld.scale.y,
      };
      
      this._worldTransform.pos.x = parentWorld.pos.x + localPos.x * cos - localPos.y * sin;
      this._worldTransform.pos.y = parentWorld.pos.y + localPos.x * sin + localPos.y * cos;
      this._worldTransform.rotation = parentWorld.rotation + this._localTransform.rotation;
      this._worldTransform.scale.x = parentWorld.scale.x * this._localTransform.scale.x;
      this._worldTransform.scale.y = parentWorld.scale.y * this._localTransform.scale.y;
    } else {
      // 根骨骼，世界变换等于本地变换
      this._worldTransform.pos.x = this._localTransform.pos.x;
      this._worldTransform.pos.y = this._localTransform.pos.y;
      this._worldTransform.rotation = this._localTransform.rotation;
      this._worldTransform.scale.x = this._localTransform.scale.x;
      this._worldTransform.scale.y = this._localTransform.scale.y;
    }
    // 更新骨骼矩阵
    const worldMatrix = this.computeWorldMatrix();
    const multiplied = this.multiplyMatrices(worldMatrix, this._inverseBindMatrix);
    this._boneMatrix.set(multiplied);
    
    this._worldDirty = false;
  }
  
  /**
   * 计算世界变换矩阵
   */
  private computeWorldMatrix(): Float32Array {
    const cos = Math.cos(this._worldTransform.rotation);
    const sin = Math.sin(this._worldTransform.rotation);
    const sx = this._worldTransform.scale.x;
    const sy = this._worldTransform.scale.y;
    const tx = this._worldTransform.pos.x;
    const ty = this._worldTransform.pos.y;
    
    const out = this._worldMatrixBuf;
    out[0] = cos * sx; out[1] = sin * sx; out[2] = 0; out[3] = 0;
    out[4] = -sin * sy; out[5] = cos * sy; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = tx; out[13] = ty; out[14] = 0; out[15] = 1;
    return out;
  }
  
  /**
   * 矩阵相乘
   */
  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = this._mulResultBuf;
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[i * 4 + k] * b[k * 4 + j];
        }
        result[i * 4 + j] = sum;
      }
    }
    
    return result;
  }
  
  /**
   * 计算矩阵的逆
   * 简化版，假设是2D变换矩阵
   */
  private invertMatrix(m: Float32Array): Float32Array {
    const result = new Float32Array(16);
    
    // 对于2D变换矩阵的逆矩阵计算
    const a = m[0], b = m[1];
    const c = m[4], d = m[5];
    const tx = m[12], ty = m[13];
    
    const det = a * d - b * c;
    if (Math.abs(det) < 0.0001) {
      // 行列式接近0，返回单位矩阵
      result[0] = 1; result[5] = 1; result[10] = 1; result[15] = 1;
      return result;
    }
    
    const invDet = 1 / det;
    
    result[0] = d * invDet;
    result[1] = -b * invDet;
    result[4] = -c * invDet;
    result[5] = a * invDet;
    result[10] = 1;
    result[12] = (c * ty - d * tx) * invDet;
    result[13] = (b * tx - a * ty) * invDet;
    result[15] = 1;
    
    return result;
  }

}
