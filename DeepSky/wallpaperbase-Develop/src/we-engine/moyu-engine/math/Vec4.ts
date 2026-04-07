import type { Vec2Like } from './Vec2';
import type { Vec3Like, Vec4Like } from './Vec3';

export class Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x?: number | string | Partial<Vec2Like> | Partial<Vec3Like> | Partial<Vec4Like>, y?: number, z?: number, w?: number) {
    if (typeof x === 'string') {
      const parts = x.split(/\s+/).map(Number);
      this.x = Number(parts[0] ?? 0);
      this.y = Number(parts[1] ?? 0);
      this.z = Number(parts[2] ?? 0);
      this.w = Number(parts[3] ?? 0);
      return;
    }
    if (x && typeof x === 'object') {
      this.x = Number(x.x ?? 0);
      this.y = Number(x.y ?? 0);
      this.z = Number((x as Vec3Like).z ?? z ?? 0);
      this.w = Number((x as Vec4Like).w ?? w ?? 0);
      return;
    }
    this.x = Number(x ?? 0);
    this.y = Number(y ?? x ?? 0);
    this.z = Number(z ?? 0);
    this.w = Number(w ?? 0);
  }
}
