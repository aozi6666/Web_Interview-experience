export interface MorphTargetData {
  name: string;
  vertices: Float32Array;
}

export class MorphTargetSystem {
  private readonly _targets: MorphTargetData[];
  private readonly _weights: Float32Array;
  private readonly _nameToIndex = new Map<string, number>();

  constructor(targets: MorphTargetData[]) {
    this._targets = targets;
    this._weights = new Float32Array(targets.length);
    targets.forEach((t, i) => this._nameToIndex.set(t.name, i));
  }

  get count(): number {
    return this._targets.length;
  }

  getIndexByName(name: string): number {
    return this._nameToIndex.get(name) ?? -1;
  }

  getWeight(indexOrName: number | string): number {
    const i = typeof indexOrName === 'number' ? indexOrName : this.getIndexByName(indexOrName);
    if (i < 0 || i >= this._weights.length) return 0;
    return this._weights[i];
  }

  setWeight(indexOrName: number | string, weight: number): void {
    const i = typeof indexOrName === 'number' ? indexOrName : this.getIndexByName(indexOrName);
    if (i < 0 || i >= this._weights.length) return;
    this._weights[i] = Math.max(0, weight);
  }

  apply(restVertices: Float32Array, outVertices: Float32Array): void {
    outVertices.set(restVertices);
    for (let ti = 0; ti < this._targets.length; ti++) {
      const w = this._weights[ti];
      if (w <= 1e-6) continue;
      const target = this._targets[ti].vertices;
      const n = Math.min(target.length, outVertices.length, restVertices.length);
      for (let i = 0; i < n; i++) {
        outVertices[i] += (target[i] - restVertices[i]) * w;
      }
    }
  }
}
