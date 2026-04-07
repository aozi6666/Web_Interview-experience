import type { TimelineAnimationConfig } from '../animation/TimelineAnimation';
import { TimelineAnimation } from '../animation/TimelineAnimation';
import type { Vec2Like } from '../../math';

export interface CameraEffectHost {
  update(engine: unknown, deltaTime: number): void;
}

export interface CameraIntroConfig {
  enabled: boolean;
  origin?: TimelineAnimationConfig;
  zoom?: TimelineAnimationConfig;
  originFallback?: [number, number, number];
  zoomFallback?: number;
}

export class CameraSystem {
  // WE 的 camerashakespeed=1 在原生里节奏更慢，
  // 这里做统一速度标定，避免全局壁纸出现“约数倍过快”的系统性偏差。
  private static readonly SHAKE_SPEED_CALIBRATION = 0.2;
  private _parallaxDisplacement: Vec2Like = { x: 0, y: 0 };
  private _smoothedMouse: Vec2Like = { x: 0.5, y: 0.5 };
  private _parallaxEnabled = false;
  private _parallaxAmount = 1;
  private _parallaxDelay = 0.1;
  private _parallaxMouseInfluence = 1;
  private _shakeEnabled = false;
  private _shakeAmplitude = 0;
  private _shakeRoughness = 0;
  private _shakeSpeed = 1;
  private _shakeDisplacement: Vec2Like = { x: 0, y: 0 };
  private _cameraEffects: CameraEffectHost[] = [];
  private _cameraIntroEnabled = false;
  private _cameraOriginAnimation: TimelineAnimation | null = null;
  private _cameraZoomAnimation: TimelineAnimation | null = null;
  private _cameraOriginFallback: [number, number, number] = [0, 0, 0];
  private _cameraZoomFallback = 1;
  private _cameraOffset: Vec2Like = { x: 0, y: 0 };
  private _cameraZoom = 1;

  get parallaxDisplacementX(): number { return this._parallaxDisplacement.x; }
  get parallaxDisplacementY(): number { return this._parallaxDisplacement.y; }
  get shakeDisplacementX(): number { return this._shakeDisplacement.x; }
  get shakeDisplacementY(): number { return this._shakeDisplacement.y; }
  get cameraOffsetX(): number { return this._cameraOffset.x; }
  get cameraOffsetY(): number { return this._cameraOffset.y; }
  get cameraZoom(): number { return this._cameraZoom; }

  getParallaxPositionX(): number {
    if (!this._parallaxEnabled) return 0.5;
    return Math.min(1, Math.max(0, this._smoothedMouse.x));
  }

  getParallaxPositionY(): number {
    if (!this._parallaxEnabled) return 0.5;
    return Math.min(1, Math.max(0, this._smoothedMouse.y));
  }

  setParallax(enabled: boolean, amount = 1, delay = 0.1, mouseInfluence = 1): void {
    this._parallaxEnabled = enabled;
    this._parallaxAmount = amount;
    this._parallaxDelay = delay;
    this._parallaxMouseInfluence = mouseInfluence;
  }

  setShake(enabled: boolean, amplitude = 0, roughness = 0, speed = 1): void {
    this._shakeEnabled = enabled;
    this._shakeAmplitude = amplitude;
    this._shakeRoughness = roughness;
    this._shakeSpeed = speed;
  }

  setCameraIntro(config: CameraIntroConfig | null): void {
    if (!config || config.enabled !== true) {
      this._cameraIntroEnabled = false;
      this._cameraOriginAnimation = null;
      this._cameraZoomAnimation = null;
      this._cameraOriginFallback = [0, 0, 0];
      this._cameraZoomFallback = 1;
      this._cameraOffset.x = 0;
      this._cameraOffset.y = 0;
      this._cameraZoom = 1;
      return;
    }

    this._cameraIntroEnabled = true;
    this._cameraOriginFallback = Array.isArray(config.originFallback) && config.originFallback.length >= 3
      ? [Number(config.originFallback[0]), Number(config.originFallback[1]), Number(config.originFallback[2])]
      : [0, 0, 0];
    const zoomFallback = Number(config.zoomFallback);
    this._cameraZoomFallback = Number.isFinite(zoomFallback) && zoomFallback > 0 ? zoomFallback : 1;
    this._cameraOriginAnimation = config.origin ? new TimelineAnimation(config.origin) : null;
    this._cameraZoomAnimation = config.zoom ? new TimelineAnimation(config.zoom) : null;
    this._cameraOriginAnimation?.reset();
    this._cameraZoomAnimation?.reset();
  }

  addCameraEffect(effect: CameraEffectHost): void {
    this._cameraEffects.push(effect);
  }

  removeCameraEffect(effect: CameraEffectHost): void {
    this._cameraEffects = this._cameraEffects.filter((e) => e !== effect);
  }

  update(deltaTime: number, time: number, mouseX: number, mouseY: number, effectEngine: unknown): void {
    if (!this._parallaxEnabled
      && !(this._shakeEnabled && this._shakeAmplitude > 0)
      && !this._cameraIntroEnabled
      && this._cameraEffects.length === 0) {
      return;
    }

    if (this._parallaxEnabled) {
      const t = Math.min(1, deltaTime / Math.max(this._parallaxDelay, 0.001));
      this._smoothedMouse.x += (mouseX - this._smoothedMouse.x) * t;
      this._smoothedMouse.y += (mouseY - this._smoothedMouse.y) * t;

      const targetParallax = {
        x: (mouseX - 0.5) * 2 * this._parallaxAmount * this._parallaxMouseInfluence,
        y: (mouseY - 0.5) * 2 * this._parallaxAmount * this._parallaxMouseInfluence,
      };
      this._parallaxDisplacement.x += (targetParallax.x - this._parallaxDisplacement.x) * t;
      this._parallaxDisplacement.y += (targetParallax.y - this._parallaxDisplacement.y) * t;
    }

    if (this._shakeEnabled && this._shakeAmplitude > 0) {
      const animTime = time * this._shakeSpeed * CameraSystem.SHAKE_SPEED_CALIBRATION;
      const lowFreq = {
        x: Math.sin(animTime * 0.7) * 0.6 + Math.sin(animTime * 1.3) * 0.4,
        y: Math.cos(animTime * 0.5) * 0.6 + Math.cos(animTime * 1.1) * 0.4,
      };
      const highFreq = {
        x: this._shakeRoughness > 0 ? Math.sin(animTime * 4.7) * this._shakeRoughness : 0,
        y: this._shakeRoughness > 0 ? Math.cos(animTime * 3.9) * this._shakeRoughness : 0,
      };
      this._shakeDisplacement.x = (lowFreq.x + highFreq.x) * this._shakeAmplitude;
      this._shakeDisplacement.y = (lowFreq.y + highFreq.y) * this._shakeAmplitude;
    }

    if (this._cameraIntroEnabled) {
      this._cameraOriginAnimation?.update(deltaTime);
      this._cameraZoomAnimation?.update(deltaTime);

      if (this._cameraOriginAnimation) {
        const s = this._cameraOriginAnimation.sample();
        const ox = s?.[0];
        const oy = s?.[1];
        this._cameraOffset.x = Number.isFinite(ox) ? Number(ox) : this._cameraOriginFallback[0];
        this._cameraOffset.y = Number.isFinite(oy) ? Number(oy) : this._cameraOriginFallback[1];
      } else {
        this._cameraOffset.x = 0;
        this._cameraOffset.y = 0;
      }

      if (this._cameraZoomAnimation) {
        const z = this._cameraZoomAnimation.sample()?.[0];
        const resolved = Number.isFinite(z) ? Number(z) : this._cameraZoomFallback;
        this._cameraZoom = resolved > 0.0001 ? resolved : 1;
      } else {
        this._cameraZoom = this._cameraZoomFallback > 0.0001 ? this._cameraZoomFallback : 1;
      }

      const originDone = !this._cameraOriginAnimation
        || (this._cameraOriginAnimation.mode === 'single'
            && this._cameraOriginAnimation.getFrame() >= this._cameraOriginAnimation.lengthFrames);
      const zoomDone = !this._cameraZoomAnimation
        || (this._cameraZoomAnimation.mode === 'single'
            && this._cameraZoomAnimation.getFrame() >= this._cameraZoomAnimation.lengthFrames);
      if (originDone && zoomDone) {
        this._cameraIntroEnabled = false;
        this._cameraOffset.x = 0;
        this._cameraOffset.y = 0;
        this._cameraZoom = 1;
      }
    } else {
      this._cameraOffset.x = 0;
      this._cameraOffset.y = 0;
      this._cameraZoom = 1;
    }

    for (const effect of this._cameraEffects) {
      effect.update(effectEngine, deltaTime);
    }
  }

  buildCameraTransform(
    width: number,
    height: number,
    createTransformMatrix: (x: number, y: number, scaleX: number, scaleY: number, rotation: number) => Float32Array,
  ): Float32Array | undefined {
    if (this._cameraZoom === 1 && this._cameraOffset.x === 0 && this._cameraOffset.y === 0) return undefined;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const zoom = this._cameraZoom;
    const tx = cx - cx * zoom - this._cameraOffset.x;
    const ty = cy - cy * zoom - this._cameraOffset.y;
    return createTransformMatrix(tx, ty, zoom, zoom, 0);
  }

  reset(): void {
    this._parallaxDisplacement.x = 0;
    this._parallaxDisplacement.y = 0;
    this._smoothedMouse.x = 0.5;
    this._smoothedMouse.y = 0.5;
    this._parallaxEnabled = false;
    this._parallaxAmount = 1;
    this._parallaxDelay = 0.1;
    this._parallaxMouseInfluence = 1;
    this._shakeDisplacement.x = 0;
    this._shakeDisplacement.y = 0;
    this._shakeEnabled = false;
    this._shakeAmplitude = 0;
    this._shakeRoughness = 0;
    this._shakeSpeed = 1;
    this._cameraEffects = [];
    this._cameraOffset.x = 0;
    this._cameraOffset.y = 0;
    this._cameraZoom = 1;
  }
}
