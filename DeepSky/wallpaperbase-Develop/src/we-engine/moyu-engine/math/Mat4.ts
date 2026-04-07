export class Mat4 {
  m: number[];

  constructor() {
    this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  translation(value?: { x?: number; y?: number; z?: number }): { x: number; y: number; z: number } | this {
    if (value === undefined) {
      return { x: this.m[12], y: this.m[13], z: this.m[14] };
    }
    this.m[12] = Number(value.x ?? this.m[12]);
    this.m[13] = Number(value.y ?? this.m[13]);
    this.m[14] = Number(value.z ?? this.m[14]);
    return this;
  }
}
