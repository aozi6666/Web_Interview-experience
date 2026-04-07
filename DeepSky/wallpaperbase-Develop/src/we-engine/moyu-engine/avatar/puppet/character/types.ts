import type { SkeletonConfig } from '../rig';
import type { BlendMode } from '../../../rendering/interfaces/IMaterial';

export interface CharacterMeta {
  name: string;
  version: string;
  width: number;
  height: number;
}

export interface ParameterDef {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  group?: string;
}

export interface DrawOrderDef {
  slotId: string;
  zIndex: number;
}

export interface MeshDef {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  boneIndices?: Uint8Array;
  boneWeights?: Float32Array;
}

export interface KeyformDef {
  paramValue: number;
  vertexDeltas: Float32Array;
  opacity?: number;
}

export interface DeformerBinding {
  parameterId: string;
  keyforms: KeyformDef[];
}

export interface PartDef {
  id: string;
  slot: string;
  texture: string;
  mesh: MeshDef;
  deformers: DeformerBinding[];
  zIndex: number;
  visible?: boolean;
  blendMode?: BlendMode;
}

export type CharacterTrackTarget = 'bone' | 'parameter';

export interface CharacterTrack {
  targetType: CharacterTrackTarget;
  targetId: string;
  property: string;
  keyframes: Array<{ time: number; value: number }>;
}

export interface CharacterAnimationDef {
  name: string;
  duration: number;
  loop?: boolean;
  tracks: CharacterTrack[];
}

export interface PhysicsGroupDef {
  id: string;
  boneChain: string[];
  gravity: number;
  stiffness: number;
  damping: number;
  windInfluence?: number;
  inputParameterIds: string[];
}

export interface CharacterDef {
  meta: CharacterMeta;
  skeleton: SkeletonConfig;
  parameters: ParameterDef[];
  parts: PartDef[];
  drawOrder: DrawOrderDef[];
  animations: CharacterAnimationDef[];
  physics?: PhysicsGroupDef[];
}

export interface ActivePartData {
  slotId: string;
  part: PartDef;
}

export interface CharacterBuildResult {
  slotOrder: DrawOrderDef[];
  parameters: ParameterDef[];
  parts: PartDef[];
  animations: CharacterAnimationDef[];
  physics: PhysicsGroupDef[];
}
