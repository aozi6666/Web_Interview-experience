import type { Vec3Like } from '../../math';

/**
 * 顶点属性类型
 */
export enum VertexAttributeType {
  Position = 'position',
  Normal = 'normal',
  UV = 'uv',
  UV2 = 'uv2',
  Color = 'color',
  BoneIndices = 'boneIndices',
  BoneWeights = 'boneWeights',
  Custom = 'custom',
}

/**
 * 顶点属性数据
 */
export interface VertexAttribute {
  type: VertexAttributeType;
  data: Float32Array;
  itemSize: number; // 每个顶点的分量数，如 position 为 3，uv 为 2
  normalized?: boolean;
  name?: string; // 用于自定义属性
}

/**
 * 几何体数据
 */
export interface GeometryData {
  /** 顶点属性数组 */
  attributes: VertexAttribute[];
  
  /** 索引数据（可选，如果没有则使用顺序绘制） */
  indices?: Uint16Array | Uint32Array;
  
  /** 绘制模式 */
  drawMode?: DrawMode;
  
  /** 是否支持动态更新 */
  dynamic?: boolean;
}

/**
 * 绘制模式
 */
export enum DrawMode {
  Triangles = 'triangles',
  TriangleStrip = 'triangle_strip',
  TriangleFan = 'triangle_fan',
  Lines = 'lines',
  LineStrip = 'line_strip',
  LineLoop = 'line_loop',
  Points = 'points',
}

/**
 * 包围盒
 */
export interface BoundingBox {
  min: Vec3Like;
  max: Vec3Like;
}

/**
 * 网格接口 - 抽象几何体/网格资源
 * 该接口封装了底层渲染API的顶点缓冲区和几何体对象
 */
export interface IMesh {
  /** 网格唯一标识 */
  readonly id: string;
  
  /** 顶点数量 */
  readonly vertexCount: number;
  
  /** 索引数量（如果有） */
  readonly indexCount: number;
  
  /** 是否为可变形网格 */
  readonly isDeformable: boolean;
  
  /**
   * 更新顶点属性数据
   * @param attributeType 属性类型
   * @param data 新数据
   * @param offset 偏移量（可选）
   */
  updateAttribute(attributeType: VertexAttributeType, data: Float32Array, offset?: number): void;
  
  /**
   * 更新顶点位置（常用于变形网格）
   * @param positions 新的顶点位置数组
   */
  updatePositions(positions: Float32Array): void;
  
  /**
   * 更新 UV 坐标
   * @param uvs 新的 UV 坐标数组
   */
  updateUVs?(uvs: Float32Array): void;
  
  /**
   * 更新索引数据
   * @param indices 新的索引数据
   */
  updateIndices(indices: Uint16Array | Uint32Array): void;
  
  /**
   * 计算包围盒
   */
  computeBoundingBox(): BoundingBox;
  
  /**
   * 计算法线（如果需要）
   */
  computeNormals(): void;
  
  /**
   * 释放网格资源
   */
  dispose(): void;
  
  /**
   * 获取底层原生网格对象
   */
  getNativeMesh(): unknown;
}
