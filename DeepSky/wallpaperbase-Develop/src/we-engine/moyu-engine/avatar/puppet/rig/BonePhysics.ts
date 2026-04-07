import type { BoneConstraintConfig } from './BoneConstraint';

export interface BonePhysicsState {
  tx: number;
  ty: number;
  rot: number;
  vx: number;
  vy: number;
  vrot: number;
}

export interface BonePhysicsInput {
  x: number;
  y: number;
  rotation: number;
  defaultPos?: { x: number; y: number };
  defaultRotation: number;
  constraint?: BoneConstraintConfig;
}

export class BonePhysics {
  private _states: BonePhysicsState[] = [];

  ensureCount(count: number): void {
    while (this._states.length < count) {
      this._states.push({ tx: 0, ty: 0, rot: 0, vx: 0, vy: 0, vrot: 0 });
    }
  }

  reset(index?: number): void {
    if (typeof index === 'number') {
      const s = this._states[index];
      if (!s) return;
      s.tx = 0; s.ty = 0; s.rot = 0; s.vx = 0; s.vy = 0; s.vrot = 0;
      return;
    }
    for (const s of this._states) {
      s.tx = 0; s.ty = 0; s.rot = 0; s.vx = 0; s.vy = 0; s.vrot = 0;
    }
  }

  applyImpulse(index: number, directional: { x: number; y: number }, angular: number): void {
    const s = this._states[index];
    if (!s) return;
    s.vx += directional.x;
    s.vy += directional.y;
    s.vrot += angular;
  }

  step(index: number, input: BonePhysicsInput, deltaTime: number): { x: number; y: number; rotation: number } {
    const s = this._states[index];
    if (!s) {
      return { x: input.x, y: input.y, rotation: input.rotation };
    }
    const c = input.constraint;
    if (!c || c.simulation === 'none') {
      return { x: input.x, y: input.y, rotation: input.rotation };
    }
    const dt = Math.max(0, Math.min(0.05, deltaTime));
    if (dt <= 1e-6) return { x: input.x, y: input.y, rotation: input.rotation };

    const transStiffness = c.translationalStiffness > 0 ? c.translationalStiffness : (c.simulation === 'spring' ? 15 : 4);
    const transFriction = c.translationalFriction > 0 ? c.translationalFriction : 8;
    const transInertia = Math.max(0.01, c.translationalInertia || 1);
    const rotStiffness = c.rotationalStiffness > 0 ? c.rotationalStiffness : (c.simulation === 'spring' ? 20 : 6);
    const rotFriction = c.rotationalFriction > 0 ? c.rotationalFriction : 10;
    const rotInertia = Math.max(0.01, c.rotationalInertia || 1);

    if (c.physicsTranslation || c.simulation === 'rope') {
      const defaultPos = input.defaultPos ?? { x: 0, y: 0 };
      const dx = input.x - defaultPos.x + s.tx;
      const dy = input.y - defaultPos.y + s.ty;
      const ax = (-transStiffness * dx - transFriction * s.vx) / transInertia;
      const ayBase = (-transStiffness * dy - transFriction * s.vy) / transInertia;
      const g = c.gravityEnabled ? 0.3 : 0;
      const gRad = (c.gravityDirection * Math.PI) / 180;
      const ay = ayBase + Math.sin(gRad) * g;
      const ax2 = ax + Math.cos(gRad) * g;
      s.vx += ax2 * dt;
      s.vy += ay * dt;
      s.tx += s.vx * dt;
      s.ty += s.vy * dt;
      if (c.maxDistance > 0) {
        const len = Math.hypot(s.tx, s.ty);
        if (len > c.maxDistance) {
          const scale = c.maxDistance / len;
          s.tx *= scale;
          s.ty *= scale;
          s.vx *= 0.6;
          s.vy *= 0.6;
        }
      }
    }

    if (c.physicsRotation || c.simulation === 'rigid' || c.simulation === 'spring') {
      const dr = input.rotation - input.defaultRotation + s.rot;
      const ar = (-rotStiffness * dr - rotFriction * s.vrot) / rotInertia;
      s.vrot += ar * dt;
      s.rot += s.vrot * dt;
      if (c.limitRotation) {
        const minR = (c.minAngle * Math.PI) / 180;
        const maxR = (c.maxAngle * Math.PI) / 180;
        if (s.rot < minR) { s.rot = minR; s.vrot *= 0.4; }
        if (s.rot > maxR) { s.rot = maxR; s.vrot *= 0.4; }
      }
    }

    return {
      x: input.x + s.tx,
      y: input.y + s.ty,
      rotation: input.rotation + s.rot,
    };
  }
}
