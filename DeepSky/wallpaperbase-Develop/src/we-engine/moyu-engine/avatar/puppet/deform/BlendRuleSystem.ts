import type { BlendRuleConfig } from '../rig/BoneConstraint';

export class BlendRuleSystem {
  apply(
    boneName: string,
    bonePos: { x: number; y: number },
    nameToIndex: Map<string, number>,
    worldX: Float32Array,
    worldY: Float32Array,
    rules?: BlendRuleConfig[],
  ): { x: number; y: number } {
    if (!rules || rules.length === 0) return bonePos;
    let x = bonePos.x;
    let y = bonePos.y;
    for (const rule of rules) {
      const idx = nameToIndex.get(rule.targetBone);
      if (idx === undefined || idx < 0 || idx >= worldX.length) continue;
      const w = Math.max(0, Math.min(1, rule.weight));
      x = x * (1 - w) + worldX[idx] * w;
      y = y * (1 - w) + worldY[idx] * w;
    }
    return { x, y };
  }
}
