import type { Skeleton } from '../rig';
import { ParameterManager } from './ParameterManager';
import type { PhysicsGroupDef } from './types';

interface BoneState {
  id: string;
  baseRotation: number;
  currentOffset: number;
  velocity: number;
}

interface GroupState {
  def: PhysicsGroupDef;
  bones: BoneState[];
}

export class PhysicsSystem {
  private _groups: GroupState[] = [];
  private _windTime = 0;

  addGroup(config: PhysicsGroupDef): void {
    this._groups.push({
      def: config,
      bones: config.boneChain.map((id) => ({
        id,
        baseRotation: 0,
        currentOffset: 0,
        velocity: 0,
      })),
    });
  }

  setGroups(groups: PhysicsGroupDef[]): void {
    this._groups = [];
    for (const group of groups) {
      this.addGroup(group);
    }
  }

  captureBindPose(skeleton: Skeleton): void {
    for (const group of this._groups) {
      for (const boneState of group.bones) {
        const bone = skeleton.getBone(boneState.id);
        if (!bone) continue;
        boneState.baseRotation = bone.localRotation;
      }
    }
  }

  update(deltaTime: number, params: ParameterManager, skeleton: Skeleton): void {
    if (this._groups.length === 0) return;
    this._windTime += deltaTime;

    for (const group of this._groups) {
      let input = 0;
      for (const paramId of group.def.inputParameterIds) {
        input += params.getValue(paramId);
      }
      if (group.def.inputParameterIds.length > 0) {
        input /= group.def.inputParameterIds.length;
      }
      const wind = (group.def.windInfluence ?? 0) * Math.sin(this._windTime * 1.2);
      const force = input * 0.01 + group.def.gravity + wind;

      for (let i = 0; i < group.bones.length; i++) {
        const boneState = group.bones[i];
        const bone = skeleton.getBone(boneState.id);
        if (!bone) continue;

        const chainAttenuation = 1 + i * 0.2;
        const targetOffset = force / chainAttenuation;
        const acceleration = (targetOffset - boneState.currentOffset) * group.def.stiffness;
        boneState.velocity += acceleration * deltaTime;
        boneState.velocity *= Math.max(0, 1 - group.def.damping * deltaTime);
        boneState.currentOffset += boneState.velocity * deltaTime;

        bone.localRotation = boneState.baseRotation + boneState.currentOffset;
      }
    }
  }
}
