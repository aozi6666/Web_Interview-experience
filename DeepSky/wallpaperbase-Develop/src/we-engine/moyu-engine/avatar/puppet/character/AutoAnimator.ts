import { ParameterManager } from './ParameterManager';

export interface BlinkConfig {
  intervalMin: number;
  intervalMax: number;
  closeDuration: number;
  openDuration: number;
}

export interface AutoAnimatorConfig {
  eyeLeftParam?: string;
  eyeRightParam?: string;
  breathParam?: string;
  angleXParam?: string;
  angleYParam?: string;
  angleZParam?: string;
  blink?: Partial<BlinkConfig>;
}

type BlinkPhase = 'waiting' | 'closing' | 'opening';

const DEFAULT_BLINK: BlinkConfig = {
  intervalMin: 2.5,
  intervalMax: 5.0,
  closeDuration: 0.08,
  openDuration: 0.12,
};

export class AutoAnimator {
  private _time = 0;
  private _nextBlinkAt = 0;
  private _blinkPhase: BlinkPhase = 'waiting';
  private _blinkTimer = 0;
  private _blink: BlinkConfig;

  private _eyeLeftParam: string;
  private _eyeRightParam: string;
  private _breathParam: string;
  private _angleXParam: string;
  private _angleYParam: string;
  private _angleZParam: string;

  constructor(config: AutoAnimatorConfig = {}) {
    this._blink = { ...DEFAULT_BLINK, ...(config.blink ?? {}) };
    this._eyeLeftParam = config.eyeLeftParam ?? 'ParamEyeLOpen';
    this._eyeRightParam = config.eyeRightParam ?? 'ParamEyeROpen';
    this._breathParam = config.breathParam ?? 'ParamBreath';
    this._angleXParam = config.angleXParam ?? 'ParamAngleX';
    this._angleYParam = config.angleYParam ?? 'ParamAngleY';
    this._angleZParam = config.angleZParam ?? 'ParamAngleZ';
    this._scheduleNextBlink();
  }

  update(deltaTime: number, parameters: ParameterManager): void {
    this._time += deltaTime;
    this.updateBlink(deltaTime, parameters);
    this.updateBreath(parameters);
    this.updateIdle(parameters);
  }

  private updateBlink(deltaTime: number, parameters: ParameterManager): void {
    if (this._blinkPhase === 'waiting') {
      if (this._time >= this._nextBlinkAt) {
        this._blinkPhase = 'closing';
        this._blinkTimer = 0;
      } else {
        this.setEyes(parameters, 1);
        return;
      }
    }

    this._blinkTimer += deltaTime;
    if (this._blinkPhase === 'closing') {
      const t = Math.min(1, this._blinkTimer / this._blink.closeDuration);
      this.setEyes(parameters, 1 - t);
      if (t >= 1) {
        this._blinkPhase = 'opening';
        this._blinkTimer = 0;
      }
      return;
    }

    const t = Math.min(1, this._blinkTimer / this._blink.openDuration);
    this.setEyes(parameters, t);
    if (t >= 1) {
      this._blinkPhase = 'waiting';
      this._blinkTimer = 0;
      this._scheduleNextBlink();
    }
  }

  private updateBreath(parameters: ParameterManager): void {
    const value = 0.5 + Math.sin(this._time * 2.2) * 0.5;
    parameters.setValue(this._breathParam, value);
  }

  private updateIdle(parameters: ParameterManager): void {
    const angleX = Math.sin(this._time * 0.8) * 8;
    const angleY = Math.cos(this._time * 0.65) * 5;
    const angleZ = Math.sin(this._time * 0.55) * 2;
    parameters.setValue(this._angleXParam, angleX);
    parameters.setValue(this._angleYParam, angleY);
    parameters.setValue(this._angleZParam, angleZ);
  }

  private setEyes(parameters: ParameterManager, value: number): void {
    parameters.setValue(this._eyeLeftParam, value);
    parameters.setValue(this._eyeRightParam, value);
  }

  private _scheduleNextBlink(): void {
    const range = this._blink.intervalMax - this._blink.intervalMin;
    const nextIn = this._blink.intervalMin + Math.random() * Math.max(0.01, range);
    this._nextBlinkAt = this._time + nextIn;
  }
}
