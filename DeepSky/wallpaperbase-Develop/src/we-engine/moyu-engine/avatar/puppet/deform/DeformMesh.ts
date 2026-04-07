import { Skeleton } from '../rig/Skeleton';
import { SkinWeights } from '../rig/SkinWeights';
import type { Vec3Like } from '../../../math';

/**
 * 变形网格配置
 */
export interface DeformMeshConfig {
  /** 原始顶点位置 */
  vertices: Float32Array;
  /** UV坐标 */
  uvs: Float32Array;
  /** 三角形索引 */
  indices: Uint16Array;
  /** 蒙皮权重 */
  skinWeights?: SkinWeights;
}

/**
 * 变形网格
 * 
 * 支持骨骼蒙皮变形的网格。
 * 在CPU端计算顶点变形，适用于需要精确控制的场景。
 */
export class DeformMesh {
  /** 原始顶点位置（绑定姿态） */
  private _bindVertices: Float32Array;
  
  /** 变形后的顶点位置 */
  private _deformedVertices: Float32Array;
  
  /** UV坐标 */
  private _uvs: Float32Array;
  
  /** 三角形索引 */
  private _indices: Uint16Array;
  
  /** 蒙皮权重 */
  private _skinWeights: SkinWeights | null;
  
  /** 顶点数量 */
  private _vertexCount: number;
  
  /** 是否需要更新 */
  private _dirty: boolean = true;
  
  constructor(config: DeformMeshConfig) {
    this._bindVertices = new Float32Array(config.vertices);
    this._deformedVertices = new Float32Array(config.vertices);
    this._uvs = config.uvs;
    this._indices = config.indices;
    this._skinWeights = config.skinWeights || null;
    this._vertexCount = config.vertices.length / 3;
  }
  
  /**
   * 获取顶点数量
   */
  get vertexCount(): number {
    return this._vertexCount;
  }
  
  /**
   * 获取三角形数量
   */
  get triangleCount(): number {
    return this._indices.length / 3;
  }
  
  /**
   * 获取原始顶点
   */
  get bindVertices(): Float32Array {
    return this._bindVertices;
  }
  
  /**
   * 获取变形后的顶点
   */
  get deformedVertices(): Float32Array {
    return this._deformedVertices;
  }
  
  /**
   * 获取UV坐标
   */
  get uvs(): Float32Array {
    return this._uvs;
  }
  
  /**
   * 获取索引
   */
  get indices(): Uint16Array {
    return this._indices;
  }
  
  /**
   * 获取蒙皮权重
   */
  get skinWeights(): SkinWeights | null {
    return this._skinWeights;
  }
  
  /**
   * 设置蒙皮权重
   */
  setSkinWeights(weights: SkinWeights): void {
    this._skinWeights = weights;
    this._dirty = true;
  }
  
  /**
   * 标记需要更新
   */
  markDirty(): void {
    this._dirty = true;
  }
  
  /**
   * 是否需要更新
   */
  get isDirty(): boolean {
    return this._dirty;
  }
  
  /**
   * 使用骨骼变形顶点
   * @param skeleton 骨骼系统
   */
  applySkeletonDeform(skeleton: Skeleton): void {
    this.applySkeletonDeformWithBase(skeleton, this._bindVertices);
  }

  /**
   * 使用指定基础顶点进行骨骼变形
   */
  applySkeletonDeformWithBase(skeleton: Skeleton, baseVertices: Float32Array): void {
    if (baseVertices.length !== this._deformedVertices.length) {
      console.warn('DeformMesh: 基础顶点数量不匹配');
      return;
    }

    if (!this._skinWeights) {
      // 没有蒙皮权重，直接复制基础顶点
      this._deformedVertices.set(baseVertices);
      this._dirty = false;
      return;
    }
    
    const boneMatrices = skeleton.getBoneMatrices();
    const boneIndices = this._skinWeights.boneIndices;
    const boneWeights = this._skinWeights.boneWeights;
    
    for (let v = 0; v < this._vertexCount; v++) {
      const vIndex = v * 3;
      const wIndex = v * 4;
      
      // 基础顶点位置
      const ox = baseVertices[vIndex];
      const oy = baseVertices[vIndex + 1];
      const oz = baseVertices[vIndex + 2];
      
      // 累积变形结果
      let dx = 0, dy = 0, dz = 0;
      
      for (let i = 0; i < 4; i++) {
        const weight = boneWeights[wIndex + i];
        if (weight <= 0) continue;
        
        const boneIndex = boneIndices[wIndex + i];
        const matrixOffset = boneIndex * 16;
        
        // 应用骨骼矩阵变换
        const m = boneMatrices;
        const nx = m[matrixOffset] * ox + m[matrixOffset + 4] * oy + m[matrixOffset + 8] * oz + m[matrixOffset + 12];
        const ny = m[matrixOffset + 1] * ox + m[matrixOffset + 5] * oy + m[matrixOffset + 9] * oz + m[matrixOffset + 13];
        const nz = m[matrixOffset + 2] * ox + m[matrixOffset + 6] * oy + m[matrixOffset + 10] * oz + m[matrixOffset + 14];
        
        dx += nx * weight;
        dy += ny * weight;
        dz += nz * weight;
      }
      
      this._deformedVertices[vIndex] = dx;
      this._deformedVertices[vIndex + 1] = dy;
      this._deformedVertices[vIndex + 2] = dz;
    }
    
    this._dirty = false;
  }
  
  /**
   * 直接设置顶点位置（不使用骨骼）
   */
  setVertices(vertices: Float32Array): void {
    if (vertices.length !== this._deformedVertices.length) {
      console.warn('DeformMesh: 顶点数量不匹配');
      return;
    }
    this._deformedVertices.set(vertices);
    this._dirty = false;
  }
  
  /**
   * 设置单个顶点位置
   */
  setVertex(index: number, x: number, y: number, z = 0): void {
    const vIndex = index * 3;
    this._deformedVertices[vIndex] = x;
    this._deformedVertices[vIndex + 1] = y;
    this._deformedVertices[vIndex + 2] = z;
  }
  
  /**
   * 获取顶点位置
   */
  getVertex(index: number): Vec3Like {
    const vIndex = index * 3;
    return {
      x: this._deformedVertices[vIndex],
      y: this._deformedVertices[vIndex + 1],
      z: this._deformedVertices[vIndex + 2],
    };
  }
  
  /**
   * 重置到绑定姿态
   */
  resetToBindPose(): void {
    this._deformedVertices.set(this._bindVertices);
    this._dirty = false;
  }
  
  /**
   * 克隆变形网格
   */
  clone(): DeformMesh {
    return new DeformMesh({
      vertices: new Float32Array(this._bindVertices),
      uvs: new Float32Array(this._uvs),
      indices: new Uint16Array(this._indices),
      skinWeights: this._skinWeights?.clone(),
    });
  }
}
