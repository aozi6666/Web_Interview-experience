export interface AudioSpectrumData {
  spectrum16Left: Float32Array;
  spectrum16Right: Float32Array;
  spectrum32Left: Float32Array;
  spectrum32Right: Float32Array;
  spectrum64Left: Float32Array;
  spectrum64Right: Float32Array;
}

/**
 * 通用音频频谱数据源。
 */
export class AudioDataProvider {
  private static _s16l: Float32Array = new Float32Array(16);
  private static _s16r: Float32Array = new Float32Array(16);
  private static _s32l: Float32Array = new Float32Array(32);
  private static _s32r: Float32Array = new Float32Array(32);
  private static _s64l: Float32Array = new Float32Array(64);
  private static _s64r: Float32Array = new Float32Array(64);

  static setSpectrum(
    s16l: Float32Array,
    s16r: Float32Array,
    s32l: Float32Array,
    s32r: Float32Array,
    s64l: Float32Array,
    s64r: Float32Array,
  ): void {
    this._s16l = s16l;
    this._s16r = s16r;
    this._s32l = s32l;
    this._s32r = s32r;
    this._s64l = s64l;
    this._s64r = s64r;
  }

  static getSpectrum(): AudioSpectrumData {
    return {
      spectrum16Left: this._s16l,
      spectrum16Right: this._s16r,
      spectrum32Left: this._s32l,
      spectrum32Right: this._s32r,
      spectrum64Left: this._s64l,
      spectrum64Right: this._s64r,
    };
  }
}
