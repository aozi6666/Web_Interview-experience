import * as THREE from 'three';
import type {
  IMesh,
  GeometryData,
  BoundingBox,
  VertexAttribute
} from '../interfaces/IMesh';
import { VertexAttributeType, DrawMode } from '../interfaces/IMesh';

/**
 * 生成唯一ID
 */
let meshIdCounter = 0;
function generateMeshId(): string {
  return `mesh_${++meshIdCounter}_${Date.now()}`;
}

/**
 * 转换顶点属性名称
 */
function toThreeAttributeName(type: VertexAttributeType, customName?: string): string {
  switch (type) {
    case VertexAttributeType.Position: return 'position';
    case VertexAttributeType.Normal: return 'normal';
    case VertexAttributeType.UV: return 'uv';
    case VertexAttributeType.UV2: return 'uv2';
    case VertexAttributeType.Color: return 'color';
    case VertexAttributeType.BoneIndices: return 'skinIndex';
    case VertexAttributeType.BoneWeights: return 'skinWeight';
    case VertexAttributeType.Custom: return customName || 'custom';
    default: return 'unknown';
  }
}

/**
 * Three.js网格实现
 */
export class ThreeMesh implements IMesh {
  readonly id: string;
  private _geometry: THREE.BufferGeometry;
  private _isDeformable: boolean;
  
  constructor(data: GeometryData) {
    this.id = generateMeshId();
    this._geometry = new THREE.BufferGeometry();
    this._isDeformable = data.dynamic || false;
    
    // 添加顶点属性
    for (const attr of data.attributes) {
      this.addAttribute(attr);
    }
    
    // 添加索引
    if (data.indices) {
      this._geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    }
  }
  
  private addAttribute(attr: VertexAttribute): void {
    const name = toThreeAttributeName(attr.type, attr.name);
    const bufferAttr = new THREE.BufferAttribute(
      attr.data, 
      attr.itemSize,
      attr.normalized
    );
    
    if (this._isDeformable) {
      bufferAttr.setUsage(THREE.DynamicDrawUsage);
    }
    
    this._geometry.setAttribute(name, bufferAttr);
  }
  
  get vertexCount(): number {
    const position = this._geometry.getAttribute('position');
    return position ? position.count : 0;
  }
  
  get indexCount(): number {
    const index = this._geometry.getIndex();
    return index ? index.count : 0;
  }
  
  get isDeformable(): boolean {
    return this._isDeformable;
  }
  
  updateAttribute(attributeType: VertexAttributeType, data: Float32Array, offset = 0): void {
    const name = toThreeAttributeName(attributeType);
    const attr = this._geometry.getAttribute(name) as THREE.BufferAttribute;
    
    if (attr) {
      if (offset === 0 && data.length === attr.array.length) {
        attr.array.set(data);
      } else {
        (attr.array as Float32Array).set(data, offset);
      }
      attr.needsUpdate = true;
    }
  }
  
  updatePositions(positions: Float32Array): void {
    this.updateAttribute(VertexAttributeType.Position, positions);
  }
  
  updateUVs(uvs: Float32Array): void {
    this.updateAttribute(VertexAttributeType.UV, uvs);
  }
  
  updateIndices(indices: Uint16Array | Uint32Array): void {
    this._geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  
  computeBoundingBox(): BoundingBox {
    this._geometry.computeBoundingBox();
    const box = this._geometry.boundingBox;
    
    if (box) {
      return {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
      };
    }
    
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }
  
  computeNormals(): void {
    this._geometry.computeVertexNormals();
  }
  
  dispose(): void {
    this._geometry.dispose();
  }
  
  getNativeMesh(): THREE.BufferGeometry {
    return this._geometry;
  }
}

/**
 * 创建可变形网格
 */
export function createDeformableMesh(
  vertices: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array,
  alphas?: Float32Array,
): ThreeMesh {
  const attributes: VertexAttribute[] = [
    { type: VertexAttributeType.Position, data: vertices, itemSize: 3 },
    { type: VertexAttributeType.UV, data: uvs, itemSize: 2 },
  ];
  if (alphas) {
    const vertexCount = Math.floor(vertices.length / 3);
    const itemSize = alphas.length === vertexCount * 4 ? 4 : 1;
    attributes.push({ type: VertexAttributeType.Color, data: alphas, itemSize });
  }
  return new ThreeMesh({
    attributes,
    indices,
    dynamic: true,
  });
}

/**
 * 创建平面几何体
 */
export function createPlaneGeometry(
  width: number,
  height: number,
  widthSegments = 1,
  heightSegments = 1
): ThreeMesh {
  const threeGeom = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
  
  // 从Three.js几何体提取数据
  const position = threeGeom.getAttribute('position');
  const uv = threeGeom.getAttribute('uv');
  const index = threeGeom.getIndex();
  
  const mesh = new ThreeMesh({
    attributes: [
      { 
        type: VertexAttributeType.Position, 
        data: new Float32Array(position.array), 
        itemSize: 3 
      },
      { 
        type: VertexAttributeType.UV, 
        data: new Float32Array(uv.array), 
        itemSize: 2 
      },
    ],
    indices: index ? new Uint16Array(index.array) : undefined,
    dynamic: false,
  });
  
  threeGeom.dispose();
  return mesh;
}
