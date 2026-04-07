import { DeformMesh } from '../deform';
import { Skeleton } from '../rig';
import type { PartDef } from './types';
import { ParameterManager } from './ParameterManager';

export interface DeformTarget {
  part: PartDef;
  mesh: DeformMesh;
  skeleton?: Skeleton | null;
}

export class DeformerSystem {
  update(targets: DeformTarget[], paramManager: ParameterManager): void {
    for (const target of targets) {
      this.updateSingle(target, paramManager);
    }
  }

  private updateSingle(target: DeformTarget, paramManager: ParameterManager): void {
    const { part, mesh, skeleton } = target;
    const bindVertices = mesh.bindVertices;
    const baseVertices = new Float32Array(bindVertices);
    const vertexCount = mesh.vertexCount;

    for (const binding of part.deformers) {
      if (binding.keyforms.length === 0) continue;
      const paramValue = paramManager.getValue(binding.parameterId);
      const [left, right, t] = this.getKeyformPair(binding.keyforms, paramValue);

      const leftDelta = left.vertexDeltas;
      const rightDelta = right.vertexDeltas;
      if (leftDelta.length < vertexCount * 2 || rightDelta.length < vertexCount * 2) {
        continue;
      }

      for (let v = 0; v < vertexCount; v++) {
        const vertexOffset = v * 3;
        const deltaOffset = v * 2;
        const dx = this.lerp(leftDelta[deltaOffset], rightDelta[deltaOffset], t);
        const dy = this.lerp(leftDelta[deltaOffset + 1], rightDelta[deltaOffset + 1], t);
        baseVertices[vertexOffset] += dx;
        baseVertices[vertexOffset + 1] += dy;
      }
    }

    if (skeleton) {
      skeleton.updateBoneMatrices();
      mesh.applySkeletonDeformWithBase(skeleton, baseVertices);
      return;
    }

    mesh.setVertices(baseVertices);
  }

  private getKeyformPair(
    keyforms: Array<{ paramValue: number; vertexDeltas: Float32Array }>,
    value: number,
  ): [typeof keyforms[number], typeof keyforms[number], number] {
    if (keyforms.length === 1) {
      return [keyforms[0], keyforms[0], 0];
    }
    const sorted = [...keyforms].sort((a, b) => a.paramValue - b.paramValue);
    if (value <= sorted[0].paramValue) {
      return [sorted[0], sorted[0], 0];
    }
    const last = sorted[sorted.length - 1];
    if (value >= last.paramValue) {
      return [last, last, 0];
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i];
      const right = sorted[i + 1];
      if (value >= left.paramValue && value <= right.paramValue) {
        const range = right.paramValue - left.paramValue;
        const t = range === 0 ? 0 : (value - left.paramValue) / range;
        return [left, right, t];
      }
    }

    return [sorted[0], sorted[0], 0];
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
