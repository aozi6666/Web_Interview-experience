/**
 * 单个顶点的蒙皮权重
 */
export interface VertexWeight {
  /** 骨骼索引数组（最多4个） */
  boneIndices: number[];
  /** 对应的权重数组 */
  weights: number[];
}

/**
 * 蒙皮权重数据
 * 
 * 管理顶点到骨骼的绑定权重。
 * 每个顶点最多受4根骨骼影响。
 */
export class SkinWeights {
  /** 顶点数量 */
  private _vertexCount: number;
  
  /** 骨骼索引数据（每顶点4个） */
  private _boneIndices: Uint8Array;
  
  /** 骨骼权重数据（每顶点4个） */
  private _boneWeights: Float32Array;
  
  constructor(vertexCount: number) {
    this._vertexCount = vertexCount;
    this._boneIndices = new Uint8Array(vertexCount * 4);
    this._boneWeights = new Float32Array(vertexCount * 4);
  }
  
  /**
   * 获取顶点数量
   */
  get vertexCount(): number {
    return this._vertexCount;
  }
  
  /**
   * 获取骨骼索引数组
   */
  get boneIndices(): Uint8Array {
    return this._boneIndices;
  }
  
  /**
   * 获取骨骼权重数组
   */
  get boneWeights(): Float32Array {
    return this._boneWeights;
  }
  
  /**
   * 设置顶点的蒙皮权重
   * @param vertexIndex 顶点索引
   * @param weights 权重数据
   */
  setVertexWeights(vertexIndex: number, weights: VertexWeight): void {
    if (vertexIndex < 0 || vertexIndex >= this._vertexCount) {
      console.warn(`SkinWeights: 顶点索引越界 ${vertexIndex}`);
      return;
    }
    
    const baseIndex = vertexIndex * 4;
    
    // 填充骨骼索引和权重（最多4个）
    for (let i = 0; i < 4; i++) {
      if (i < weights.boneIndices.length) {
        this._boneIndices[baseIndex + i] = weights.boneIndices[i];
        this._boneWeights[baseIndex + i] = weights.weights[i];
      } else {
        this._boneIndices[baseIndex + i] = 0;
        this._boneWeights[baseIndex + i] = 0;
      }
    }
    
    // 归一化权重
    this.normalizeWeights(vertexIndex);
  }
  
  /**
   * 获取顶点的蒙皮权重
   */
  getVertexWeights(vertexIndex: number): VertexWeight {
    const baseIndex = vertexIndex * 4;
    
    const boneIndices: number[] = [];
    const weights: number[] = [];
    
    for (let i = 0; i < 4; i++) {
      const weight = this._boneWeights[baseIndex + i];
      if (weight > 0) {
        boneIndices.push(this._boneIndices[baseIndex + i]);
        weights.push(weight);
      }
    }
    
    return { boneIndices, weights };
  }
  
  /**
   * 归一化顶点权重
   */
  private normalizeWeights(vertexIndex: number): void {
    const baseIndex = vertexIndex * 4;
    
    // 计算权重总和
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += this._boneWeights[baseIndex + i];
    }
    
    // 归一化
    if (sum > 0.0001) {
      for (let i = 0; i < 4; i++) {
        this._boneWeights[baseIndex + i] /= sum;
      }
    }
  }
  
  /**
   * 从数组批量设置权重数据
   */
  setFromArrays(boneIndices: number[], boneWeights: number[]): void {
    const count = Math.min(boneIndices.length, boneWeights.length, this._vertexCount * 4);
    
    for (let i = 0; i < count; i++) {
      this._boneIndices[i] = boneIndices[i];
      this._boneWeights[i] = boneWeights[i];
    }
    
    // 归一化所有顶点
    for (let v = 0; v < this._vertexCount; v++) {
      this.normalizeWeights(v);
    }
  }
  
  /**
   * 克隆权重数据
   */
  clone(): SkinWeights {
    const cloned = new SkinWeights(this._vertexCount);
    cloned._boneIndices.set(this._boneIndices);
    cloned._boneWeights.set(this._boneWeights);
    return cloned;
  }
}

/**
 * 从Wallpaper Engine格式创建蒙皮权重
 */
export function createSkinWeightsFromWE(
  vertexCount: number,
  boneIndices: number[],
  boneWeights: number[]
): SkinWeights {
  const skinWeights = new SkinWeights(vertexCount);
  skinWeights.setFromArrays(boneIndices, boneWeights);
  return skinWeights;
}
