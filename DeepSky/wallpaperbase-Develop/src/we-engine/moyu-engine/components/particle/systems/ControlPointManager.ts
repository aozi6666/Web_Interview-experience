import type { ControlPointAnimationConfig, ControlPointConfig } from '../config/ParticleTypes';
import type { Vec2Like, Vec3Like } from '../../../math';

export type ControlPointPosition = Vec3Like;

export interface RuntimeControlPoint {
  position: ControlPointPosition;
  offset: ControlPointPosition;
  linkMouse: boolean;
  worldSpace: boolean;
}

export class ControlPointManager {
  private readonly _coverScale: number;
  private readonly _emitCenterProvider: () => Vec2Like;
  private readonly _mouseStateProvider: () => { mouse: Vec2Like; width: number; height: number };
  private readonly _posTransformProvider: () => {
    hasPosTransform: boolean;
    scale: Vec2Like;
    cos: number;
    sin: number;
  };
  private _sourceControlPoints: ControlPointConfig[] = [];
  private _runtimeControlPoints: RuntimeControlPoint[] = [];
  private _mouseLinkedControlPoints: RuntimeControlPoint[] = [];
  private _nonMouseLinkedControlPoints: RuntimeControlPoint[] = [];
  private _controlPointAnimations: ControlPointAnimationConfig[] = [];

  constructor(options: {
    coverScale: number;
    sourceControlPoints: ControlPointConfig[];
    controlPointAnimations: ControlPointAnimationConfig[];
    emitCenterProvider: () => Vec2Like;
    mouseStateProvider: () => { mouse: Vec2Like; width: number; height: number };
    posTransformProvider: () => {
      hasPosTransform: boolean;
      scale: Vec2Like;
      cos: number;
      sin: number;
    };
  }) {
    this._coverScale = options.coverScale;
    this._emitCenterProvider = options.emitCenterProvider;
    this._mouseStateProvider = options.mouseStateProvider;
    this._posTransformProvider = options.posTransformProvider;
    this.setControlPoints(options.sourceControlPoints);
    this._controlPointAnimations = [...options.controlPointAnimations];
  }

  setControlPoints(sourceControlPoints: ControlPointConfig[]): void {
    this._sourceControlPoints = sourceControlPoints.map((cp) => ({
      ...cp,
      offset: { ...cp.offset },
    }));
    this._runtimeControlPoints = [];
    this._mouseLinkedControlPoints = [];
    this._nonMouseLinkedControlPoints = [];
    const emitCenter = this._emitCenterProvider();
    for (const cp of this._sourceControlPoints) {
      const runtimeCp: RuntimeControlPoint = {
        position: cp.linkMouse
          ? { x: 0, y: 0, z: 0 }
          : { x: emitCenter.x, y: emitCenter.y, z: 0 },
        offset: {
          x: cp.offset.x * this._coverScale,
          y: cp.offset.y * this._coverScale,
          z: cp.offset.z,
        },
        linkMouse: cp.linkMouse,
        worldSpace: cp.worldSpace,
      };
      this._runtimeControlPoints[cp.id] = runtimeCp;
      if (runtimeCp.linkMouse) {
        this._mouseLinkedControlPoints.push(runtimeCp);
      } else {
        this._nonMouseLinkedControlPoints.push(runtimeCp);
      }
    }
  }

  setAnimations(configs: ControlPointAnimationConfig[]): void {
    this._controlPointAnimations = [...configs];
  }

  update(deltaTime: number): void {
    this.updatePositions();
    this.updateAnimations(deltaTime);
  }

  getPosition(cpId: number): ControlPointPosition {
    const cp = this._runtimeControlPoints[cpId];
    if (cp) return cp.position;
    const emitCenter = this._emitCenterProvider();
    return { x: emitCenter.x, y: emitCenter.y, z: 0 };
  }

  getSourceControlPoints(): ControlPointConfig[] {
    return this._sourceControlPoints.map((cp) => ({ ...cp, offset: { ...cp.offset } }));
  }

  getRuntimeControlPoints(): RuntimeControlPoint[] {
    return this._runtimeControlPoints;
  }

  getAnimationConfigs(): ControlPointAnimationConfig[] {
    return [...this._controlPointAnimations];
  }

  getControlPointCount(): number {
    return this._runtimeControlPoints.filter(Boolean).length;
  }

  private updatePositions(): void {
    if (this._mouseLinkedControlPoints.length === 0 && this._nonMouseLinkedControlPoints.length === 0) return;

    const emitCenter = this._emitCenterProvider();
    const { hasPosTransform, scale, cos, sin } = this._posTransformProvider();
    const sx = scale.x;
    const sy = scale.y;
    const { mouse, width, height } = this._mouseStateProvider();
    const normalizedMouse = { x: mouse.x, y: mouse.y };

    for (const cp of this._mouseLinkedControlPoints) {
      const mousePos = {
        x: normalizedMouse.x * width,
        y: normalizedMouse.y * height,
      };
      let simPos = { x: mousePos.x, y: mousePos.y };

      if (hasPosTransform) {
        const screenDelta = {
          x: mousePos.x - emitCenter.x,
          y: mousePos.y - emitCenter.y,
        };
        const invSx = Math.abs(sx) > 1e-6 ? 1 / sx : 1;
        const invSy = Math.abs(sy) > 1e-6 ? 1 / sy : 1;
        const simDelta = {
          x: cos * invSx * screenDelta.x + sin * invSx * screenDelta.y,
          y: -sin * invSy * screenDelta.x + cos * invSy * screenDelta.y,
        };
        simPos = {
          x: emitCenter.x + simDelta.x,
          y: emitCenter.y + simDelta.y,
        };
      }

      cp.position.x = simPos.x + cp.offset.x;
      cp.position.y = simPos.y + cp.offset.y;
      cp.position.z = cp.offset.z;
    }

    for (const cp of this._nonMouseLinkedControlPoints) {
      cp.position.x = emitCenter.x + cp.offset.x;
      cp.position.y = emitCenter.y + cp.offset.y;
      cp.position.z = cp.offset.z;
    }
  }

  private updateAnimations(deltaTime: number): void {
    if (this._controlPointAnimations.length === 0) return;
    for (const cpAnim of this._controlPointAnimations) {
      const cp = this._runtimeControlPoints[cpAnim.id];
      if (!cp || cp.linkMouse) continue;
      cpAnim.animation.update(deltaTime);
      const value = cpAnim.animation.sample();
      cp.offset.x = value[0] ?? cp.offset.x;
      cp.offset.y = value[1] ?? cp.offset.y;
      cp.offset.z = value[2] ?? cp.offset.z;
    }
  }
}
