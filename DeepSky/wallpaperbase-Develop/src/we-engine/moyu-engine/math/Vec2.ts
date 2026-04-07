export interface Vec2Like {
  x: number;
  y: number;
}

export class Vec2 {
  x: number;
  y: number;

  constructor(x?: number | string | Partial<Vec2Like>, y?: number) {
    if (typeof x === 'string') {
      const parts = x.split(/\s+/).map(Number);
      this.x = Number(parts[0] ?? 0);
      this.y = Number(parts[1] ?? 0);
      return;
    }
    if (x && typeof x === 'object') {
      this.x = Number(x.x ?? 0);
      this.y = Number(x.y ?? 0);
      return;
    }
    this.x = Number(x ?? 0);
    this.y = Number(y ?? x ?? 0);
  }

  add(v: Vec2Like): Vec2 { return new Vec2(this.x + Number(v.x ?? 0), this.y + Number(v.y ?? 0)); }
  subtract(v: Vec2Like): Vec2 { return new Vec2(this.x - Number(v.x ?? 0), this.y - Number(v.y ?? 0)); }
  multiply(s: number): Vec2 { return new Vec2(this.x * s, this.y * s); }
  divide(s: number): Vec2 { return new Vec2(s === 0 ? this.x : this.x / s, s === 0 ? this.y : this.y / s); }
  length(): number { return Math.hypot(this.x, this.y); }
  copy(): Vec2 { return new Vec2(this.x, this.y); }
}
