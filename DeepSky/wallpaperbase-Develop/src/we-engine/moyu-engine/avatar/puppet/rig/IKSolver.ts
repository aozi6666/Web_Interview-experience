import type { Vec2Like } from '../../../math';

export interface IKChainConfig {
  root: number;
  mid: number;
  end: number;
  target?: Vec2Like;
  pole?: Vec2Like;
}

export class IKSolver {
  solveTwoBone(
    cfg: IKChainConfig,
    worldX: Float32Array,
    worldY: Float32Array,
    worldRot: Float32Array,
  ): void {
    const { root, mid, end } = cfg;
    const target = { x: cfg.target?.x ?? 0, y: cfg.target?.y ?? 0 };
    if (root < 0 || mid < 0 || end < 0) return;
    if (root >= worldX.length || mid >= worldX.length || end >= worldX.length) return;

    const rx = worldX[root];
    const ry = worldY[root];
    const mx = worldX[mid];
    const my = worldY[mid];
    const ex = worldX[end];
    const ey = worldY[end];

    const a = Math.max(1e-4, Math.hypot(mx - rx, my - ry));
    const b = Math.max(1e-4, Math.hypot(ex - mx, ey - my));
    let c = Math.hypot(target.x - rx, target.y - ry);
    c = Math.max(1e-4, Math.min(a + b - 1e-4, c));

    const base = Math.atan2(target.y - ry, target.x - rx);
    const cosAngle0 = (a * a + c * c - b * b) / (2 * a * c);
    const angle0 = Math.acos(Math.max(-1, Math.min(1, cosAngle0)));

    const pole = { x: cfg.pole?.x ?? (rx + 1), y: cfg.pole?.y ?? ry };
    const cross = (target.x - rx) * (pole.y - ry) - (target.y - ry) * (pole.x - rx);
    const bendSign = cross >= 0 ? 1 : -1;

    const rootRot = base + bendSign * angle0;
    const cosAngle1 = (a * a + b * b - c * c) / (2 * a * b);
    const elbow = Math.acos(Math.max(-1, Math.min(1, cosAngle1)));
    const midRot = rootRot + bendSign * (Math.PI - elbow);

    worldRot[root] = rootRot;
    worldRot[mid] = midRot;
    worldX[end] = target.x;
    worldY[end] = target.y;
  }
}
