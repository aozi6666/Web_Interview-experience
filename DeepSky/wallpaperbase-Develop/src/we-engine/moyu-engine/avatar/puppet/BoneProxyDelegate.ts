import { PuppetAnimator } from './deform/PuppetAnimator';
import type { Vec2Like, Vec3Like } from '../../math';

const IDENTITY_MATRIX_4X4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

type AnimationLayerConfig = {
  animation?: number;
  name?: string;
  rate?: number;
  blend?: number;
  visible?: boolean;
};

export class BoneProxyDelegate {
  private _animator: PuppetAnimator | null = null;

  setAnimator(animator: PuppetAnimator | null): void {
    this._animator = animator;
  }

  getBoneCount(): number {
    return this._animator?.getBoneCount() ?? 0;
  }

  getBoneTransform(bone: string | number): number[] {
    return this._animator?.getBoneTransform(bone) ?? [...IDENTITY_MATRIX_4X4];
  }

  setBoneTransform(bone: string | number, transform: ArrayLike<number>): void {
    this._animator?.setBoneTransform(bone, transform);
  }

  getLocalBoneTransform(bone: string | number): number[] {
    return this._animator?.getLocalBoneTransform(bone) ?? [...IDENTITY_MATRIX_4X4];
  }

  setLocalBoneTransform(bone: string | number, transform: ArrayLike<number>): void {
    this._animator?.setLocalBoneTransform(bone, transform);
  }

  getLocalBoneAngles(bone: string | number): Vec3Like {
    return this._animator?.getLocalBoneAngles(bone) ?? { x: 0, y: 0, z: 0 };
  }

  setLocalBoneAngles(bone: string | number, angles: Partial<Vec3Like>): void {
    this._animator?.setLocalBoneAngles(bone, angles);
  }

  getLocalBoneOrigin(bone: string | number): Vec3Like {
    return this._animator?.getLocalBoneOrigin(bone) ?? { x: 0, y: 0, z: 0 };
  }

  setLocalBoneOrigin(bone: string | number, origin: Partial<Vec3Like>): void {
    this._animator?.setLocalBoneOrigin(bone, origin);
  }

  getBoneIndex(name: string): number {
    return this._animator?.getBoneIndex(name) ?? -1;
  }

  getBoneParentIndex(child: number | string): number {
    return this._animator?.getBoneParentIndex(child) ?? -1;
  }

  applyBonePhysicsImpulse(
    bone: string | number | undefined,
    directionalImpulse: Partial<Vec2Like>,
    angularImpulse: Partial<Vec3Like>,
  ): void {
    this._animator?.applyBonePhysicsImpulse(bone, directionalImpulse, angularImpulse);
  }

  resetBonePhysicsSimulation(bone?: string | number): void {
    this._animator?.resetBonePhysicsSimulation(bone);
  }

  getBlendShapeIndex(name: string): number {
    return this._animator?.getBlendShapeIndex(name) ?? -1;
  }

  getBlendShapeWeight(blendShape: string | number): number {
    return this._animator?.getBlendShapeWeight(blendShape) ?? 0;
  }

  setBlendShapeWeight(blendShape: string | number, weight: number): void {
    this._animator?.setBlendShapeWeight(blendShape, weight);
  }

  playSingleAnimation(animation: string | AnimationLayerConfig, config?: Omit<AnimationLayerConfig, 'animation'>): unknown {
    if (!this._animator) return null;
    if (typeof animation === 'string' && config) {
      return this._animator.playSingleAnimation({ ...config, name: config.name ?? animation });
    }
    return this._animator.playSingleAnimation(animation);
  }

  getAnimationLayerCount(): number {
    return this._animator?.getAnimationLayerCount() ?? 0;
  }

  getAnimationLayer(nameOrIndex: string | number): unknown {
    return this._animator?.getAnimationLayer(nameOrIndex) ?? null;
  }

  createAnimationLayer(animation: string | AnimationLayerConfig): unknown {
    return this._animator?.createAnimationLayer(animation) ?? null;
  }

  destroyAnimationLayer(animationLayer: string | number | unknown): boolean {
    return this._animator?.destroyAnimationLayer(animationLayer as any) ?? false;
  }
}
