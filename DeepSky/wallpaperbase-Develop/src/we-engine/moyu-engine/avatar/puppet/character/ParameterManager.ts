import type { ParameterDef } from './types';

type ParameterListener = (id: string, value: number) => void;

interface ParameterState {
  def: ParameterDef;
  value: number;
}

export class ParameterManager {
  private _params = new Map<string, ParameterState>();
  private _listeners = new Set<ParameterListener>();

  registerParameter(def: ParameterDef): void {
    this._params.set(def.id, {
      def,
      value: this.clamp(def.default, def.min, def.max),
    });
  }

  registerParameters(defs: ParameterDef[]): void {
    for (const def of defs) {
      this.registerParameter(def);
    }
  }

  hasParameter(id: string): boolean {
    return this._params.has(id);
  }

  getValue(id: string): number {
    return this._params.get(id)?.value ?? 0;
  }

  setValue(id: string, value: number): void {
    const state = this._params.get(id);
    if (!state) return;
    const next = this.clamp(value, state.def.min, state.def.max);
    if (Math.abs(next - state.value) < 1e-6) return;
    state.value = next;
    for (const listener of this._listeners) {
      listener(id, next);
    }
  }

  getSnapshot(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, state] of this._params) {
      out.set(id, state.value);
    }
    return out;
  }

  applySnapshot(snapshot: Map<string, number>): void {
    for (const [id, value] of snapshot) {
      this.setValue(id, value);
    }
  }

  resetToDefaults(): void {
    for (const [id, state] of this._params) {
      this.setValue(id, state.def.default);
    }
  }

  getParameterDefs(): ParameterDef[] {
    return Array.from(this._params.values()).map((item) => item.def);
  }

  onParameterChanged(callback: ParameterListener): () => void {
    this._listeners.add(callback);
    return () => {
      this._listeners.delete(callback);
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
