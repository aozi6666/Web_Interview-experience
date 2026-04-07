import type { Vec2Like } from './Vec2';

export interface Vec3Like extends Vec2Like {
  z: number;
}

export interface Vec4Like extends Vec3Like {
  w: number;
}

export class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x?: number | string | Partial<Vec2Like> | Partial<Vec3Like> | Partial<Vec4Like>, y?: number, z?: number) {
    if (typeof x === 'string') {
      const parts = x.split(/\s+/).map(Number);
      this.x = Number(parts[0] ?? 0);
      this.y = Number(parts[1] ?? 0);
      this.z = Number(parts[2] ?? 0);
      return;
    }
    if (x && typeof x === 'object') {
      this.x = Number(x.x ?? 0);
      this.y = Number(x.y ?? 0);
      this.z = Number((x as Vec3Like).z ?? z ?? 0);
      return;
    }
    this.x = Number(x ?? 0);
    this.y = Number(y ?? x ?? 0);
    this.z = Number(z ?? ((typeof y === 'number') ? 0 : (x ?? 0)));
  }

  add(v: Vec2Like | Vec3Like): Vec3 { return new Vec3(this.x + Number(v.x ?? 0), this.y + Number(v.y ?? 0), this.z + Number((v as Vec3Like).z ?? 0)); }
  subtract(v: Vec2Like | Vec3Like): Vec3 { return new Vec3(this.x - Number(v.x ?? 0), this.y - Number(v.y ?? 0), this.z - Number((v as Vec3Like).z ?? 0)); }
  multiply(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s); }
  divide(s: number): Vec3 { return new Vec3(s === 0 ? this.x : this.x / s, s === 0 ? this.y : this.y / s, s === 0 ? this.z : this.z / s); }
  length(): number { return Math.hypot(this.x, this.y, this.z); }
  copy(): Vec3 { return new Vec3(this.x, this.y, this.z); }
}
