/**
 * Audio Spectrum Analyzer
 * 参考 linux-wallpaperengine Audio/AudioContext.cpp, AudioStream.cpp, Detectors/
 * 
 * 使用 Web Audio API 的 AnalyserNode 进行 FFT 分析，
 * 生成 g_AudioSpectrum16/32/64 Left/Right uniform 数据。
 */

import { AudioDataProvider } from './AudioDataProvider';

/**
 * 音频频谱分析器
 */
export class AudioAnalyzer {
  private _audioContext: AudioContext | null = null;
  private _analyserLeft: AnalyserNode | null = null;
  private _analyserRight: AnalyserNode | null = null;
  private _splitter: ChannelSplitterNode | null = null;
  private _source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  private _connectedSourceType: 'element' | 'stream' | null = null;
  
  // FFT 数据缓冲区
  private _frequencyDataLeft: Float32Array<ArrayBuffer> = AudioAnalyzer.createFloatBuffer(128);
  private _frequencyDataRight: Float32Array<ArrayBuffer> = AudioAnalyzer.createFloatBuffer(128);
  
  // 输出频谱数据 (匹配 C++ g_AudioSpectrum* uniform)
  private _spectrum16Left: Float32Array = new Float32Array(16);
  private _spectrum16Right: Float32Array = new Float32Array(16);
  private _spectrum32Left: Float32Array = new Float32Array(32);
  private _spectrum32Right: Float32Array = new Float32Array(32);
  private _spectrum64Left: Float32Array = new Float32Array(64);
  private _spectrum64Right: Float32Array = new Float32Array(64);

  // 前一帧频谱值（用于非对称 attack/decay 平滑）
  private _prev16Left: Float32Array = new Float32Array(16);
  private _prev16Right: Float32Array = new Float32Array(16);
  private _prev32Left: Float32Array = new Float32Array(32);
  private _prev32Right: Float32Array = new Float32Array(32);
  private _prev64Left: Float32Array = new Float32Array(64);
  private _prev64Right: Float32Array = new Float32Array(64);

  private _connected: boolean = false;
  private _enabled: boolean = false;
  private _testMode: boolean = false;
  private _testPhase: number = 0;
  private _simLastTime: number = 0;  // ms，上一帧时间戳
  private _simTimeS: number = 0;     // 秒，模拟累计时间

  private static createFloatBuffer(length: number): Float32Array<ArrayBuffer> {
    return new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT));
  }

  /**
   * 连接到 HTML audio/video 元素
   */
  connect(mediaElement: HTMLMediaElement): void {
    try {
      this.disconnect();
      this._testMode = false;
      this._audioContext = new AudioContext();
      
      // 创建音频源
      this._source = this._audioContext.createMediaElementSource(mediaElement);
      
      // 创建立体声分离器
      this._splitter = this._audioContext.createChannelSplitter(2);
      
      // 创建左右声道分析器
      this._analyserLeft = this._audioContext.createAnalyser();
      this._analyserLeft.fftSize = 2048; // 1024 frequency bins, ~21.5 Hz resolution
      this._analyserLeft.smoothingTimeConstant = 0; // 关闭内置平滑，改用自定义非对称 attack/decay

      this._analyserRight = this._audioContext.createAnalyser();
      this._analyserRight.fftSize = 2048;
      this._analyserRight.smoothingTimeConstant = 0;

      // 连接: source → splitter → analysers
      this._source.connect(this._splitter);
      this._splitter.connect(this._analyserLeft, 0);
      this._splitter.connect(this._analyserRight, 1);
      
      // 同时连接到输出 (保持可听)
      this._source.connect(this._audioContext.destination);
      
      this._frequencyDataLeft = AudioAnalyzer.createFloatBuffer(this._analyserLeft.frequencyBinCount);
      this._frequencyDataRight = AudioAnalyzer.createFloatBuffer(this._analyserRight.frequencyBinCount);
      
      this._connected = true;
      this._connectedSourceType = 'element';
      console.log('AudioAnalyzer: 已连接到媒体元素');
    } catch (e) {
      console.warn('AudioAnalyzer: 连接失败:', e);
    }
  }

  /**
   * 连接到 MediaStream（麦克风等）
   */
  connectStream(stream: MediaStream): void {
    try {
      this.disconnect();
      this._testMode = false;
      this._audioContext = new AudioContext();

      this._source = this._audioContext.createMediaStreamSource(stream);
      this._splitter = this._audioContext.createChannelSplitter(2);

      this._analyserLeft = this._audioContext.createAnalyser();
      this._analyserLeft.fftSize = 2048;
      this._analyserLeft.smoothingTimeConstant = 0;

      this._analyserRight = this._audioContext.createAnalyser();
      this._analyserRight.fftSize = 2048;
      this._analyserRight.smoothingTimeConstant = 0;

      // stream 模式不输出到 destination，避免反馈与回声
      this._source.connect(this._splitter);
      this._splitter.connect(this._analyserLeft, 0);
      this._splitter.connect(this._analyserRight, 1);

      this._frequencyDataLeft = AudioAnalyzer.createFloatBuffer(this._analyserLeft.frequencyBinCount);
      this._frequencyDataRight = AudioAnalyzer.createFloatBuffer(this._analyserRight.frequencyBinCount);

      this._connected = true;
      this._connectedSourceType = 'stream';
      console.log('AudioAnalyzer: 已连接到 MediaStream');
    } catch (e) {
      console.warn('AudioAnalyzer: MediaStream 连接失败:', e);
    }
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 更新频谱数据并推送到 ImageLayer 的全局 uniform
   */
  update(): void {
    if (this._testMode) {
      this._updateTestSpectrum();
      return;
    }
    if (!this._enabled) return;
    if (!this._connected || !this._analyserLeft || !this._analyserRight) {
      this._updateSimulatedSpectrum();
      return;
    }
    
    // 获取频率域数据 (dB 值, 范围约 -100 到 0)
    this._analyserLeft.getFloatFrequencyData(this._frequencyDataLeft);
    this._analyserRight.getFloatFrequencyData(this._frequencyDataRight);
    
    const nyquist = (this._audioContext?.sampleRate || 44100) / 2;
    this._mapToSpectrum(this._frequencyDataLeft, this._spectrum16Left, 16, nyquist);
    this._mapToSpectrum(this._frequencyDataLeft, this._spectrum32Left, 32, nyquist);
    this._mapToSpectrum(this._frequencyDataLeft, this._spectrum64Left, 64, nyquist);
    this._mapToSpectrum(this._frequencyDataRight, this._spectrum16Right, 16, nyquist);
    this._mapToSpectrum(this._frequencyDataRight, this._spectrum32Right, 32, nyquist);
    this._mapToSpectrum(this._frequencyDataRight, this._spectrum64Right, 64, nyquist);

    // 非对称 attack/decay 平滑：快攻慢衰，低频衰减更快
    this._applySmoothing(this._spectrum16Left, this._prev16Left);
    this._applySmoothing(this._spectrum16Right, this._prev16Right);
    this._applySmoothing(this._spectrum32Left, this._prev32Left);
    this._applySmoothing(this._spectrum32Right, this._prev32Right);
    this._applySmoothing(this._spectrum64Left, this._prev64Left);
    this._applySmoothing(this._spectrum64Right, this._prev64Right);
    
    AudioDataProvider.setSpectrum(
      this._spectrum16Left, this._spectrum16Right,
      this._spectrum32Left, this._spectrum32Right,
      this._spectrum64Left, this._spectrum64Right
    );
  }

  /**
   * 开启/关闭测试模式（使用程序生成的频谱）
   */
  setTestMode(enabled: boolean): void {
    this._testMode = enabled;
    if (enabled) {
      this._enabled = true;
      this.disconnect();
      this._connectedSourceType = null;
    }
  }

  /**
   * 将 FFT 频率数据映射到指定大小的频谱数组。
   *
   * 使用对数频率分布（每个 band 覆盖等比的频率范围），
   * 对范围内的 FFT bin 取平均，然后将 dB 值线性映射到 [0, 1]。
   *
   * @param nyquist  AudioContext 采样率 / 2（用于 bin→频率换算）
   */
  private _mapToSpectrum(freqData: Float32Array, output: Float32Array, size: number, nyquist: number): void {
    const binCount = freqData.length;

    // 对数频率分布：55 Hz ~ 20 kHz（或 Nyquist * 0.95，取较小值）
    // 55 Hz 起步避免超低频段 FFT 分辨率不足导致多个 band 共享同一 bin
    const fMin = 55;
    const fMax = Math.min(20000, nyquist * 0.95);
    const logMin = Math.log(fMin);
    const logMax = Math.log(fMax);

    // dB → [0, 1] 参数
    const DB_FLOOR = -80;
    const DB_RANGE = 55;

    for (let i = 0; i < size; i++) {
      // 当前 band 的上下频率边界
      const fLow  = Math.exp(logMin + (logMax - logMin) * i / size);
      const fHigh = Math.exp(logMin + (logMax - logMin) * (i + 1) / size);

      // 频率 → bin 索引
      const binLow  = Math.max(0, Math.floor(fLow  / nyquist * binCount));
      const binHigh = Math.min(binCount - 1, Math.ceil(fHigh / nyquist * binCount));

      // 对范围内 bin 的 dB 取平均，再映射到 [0, 1]
      let sum = 0;
      const count = Math.max(1, binHigh - binLow + 1);
      for (let b = binLow; b <= binHigh; b++) {
        sum += Math.max(0, (freqData[b] - DB_FLOOR) / DB_RANGE);
      }
      const avg = sum / count;

      // 频率倾斜补偿：拉平低频与高频的天然能量差异
      const fCenter = Math.sqrt(fLow * fHigh);
      const octaves = Math.log2(fCenter / fMin);
      const maxOctaves = Math.log2(fMax / fMin); // ≈8.5
      // 低频（octaves≈0）乘 0.7，高频（octaves≈8.5）乘 3.0
      const tiltGain = 0.7 + (2.3 * octaves / maxOctaves);
      // gamma 1.5：保留峰值冲击力，同时压低中间值增加稀疏感
      output[i] = Math.min(1.0, Math.pow(avg * tiltGain, 1.5));
    }
  }

  /**
   * 非对称 attack/decay 平滑。
   * - attack（上升）：快速跟随，alpha ≈ 0.35（仅保留 35% 旧值）
   * - decay（下降）：低频区衰减更快（alpha ≈ 0.6），高频区稍慢（alpha ≈ 0.75）
   *   以解决低音区 bar 回落过慢的问题
   */
  private _applySmoothing(current: Float32Array, prev: Float32Array): void {
    const size = current.length;
    const ATTACK_ALPHA = 0.35;   // 上升时保留旧值的比例（越小越灵敏）
    const DECAY_ALPHA_LOW = 0.6; // 低频衰减（band index 0）
    const DECAY_ALPHA_HIGH = 0.75; // 高频衰减（band index = size-1）

    for (let i = 0; i < size; i++) {
      const raw = current[i];
      const old = prev[i];
      if (raw >= old) {
        // 上升：快速跟随
        current[i] = old + (raw - old) * (1 - ATTACK_ALPHA);
      } else {
        // 下降：低频区衰减更快
        const t = i / Math.max(1, size - 1);
        const decayAlpha = DECAY_ALPHA_LOW + (DECAY_ALPHA_HIGH - DECAY_ALPHA_LOW) * t;
        current[i] = old + (raw - old) * (1 - decayAlpha);
      }
      prev[i] = current[i];
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }
    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = null;
    }
    this._analyserLeft = null;
    this._analyserRight = null;
    this._splitter = null;
    this._connected = false;
    this._connectedSourceType = null;
  }

  /**
   * 是否已连接
   */
  get connected(): boolean {
    return this._connected;
  }

  get connectedSourceType(): 'element' | 'stream' | null {
    return this._connectedSourceType;
  }

  private _updateTestSpectrum(): void {
    this._testPhase += 0.06;
    this._fillTestBand(this._spectrum16Left, this._testPhase, 0.0);
    this._fillTestBand(this._spectrum16Right, this._testPhase, 0.9);
    this._fillTestBand(this._spectrum32Left, this._testPhase, 0.3);
    this._fillTestBand(this._spectrum32Right, this._testPhase, 1.2);
    this._fillTestBand(this._spectrum64Left, this._testPhase, 0.6);
    this._fillTestBand(this._spectrum64Right, this._testPhase, 1.5);

    AudioDataProvider.setSpectrum(
      this._spectrum16Left, this._spectrum16Right,
      this._spectrum32Left, this._spectrum32Right,
      this._spectrum64Left, this._spectrum64Right,
    );
  }

  private _fillTestBand(output: Float32Array, phase: number, channelOffset: number): void {
    const len = output.length;
    for (let i = 0; i < len; i += 1) {
      const x = i / Math.max(1, len - 1);
      const sweep = Math.sin(phase * 1.7 + x * 8.0 + channelOffset) * 0.5 + 0.5;
      const pulse = Math.sin(phase * 3.2 + x * 22.0 + channelOffset * 0.7) * 0.5 + 0.5;
      const falloff = 1.0 - x * 0.65;
      output[i] = Math.max(0, Math.min(1, (sweep * 0.7 + pulse * 0.3) * falloff));
    }
  }

  /**
   * 无音频源时生成模拟重鼓频谱（120 BPM），基于真实挂钟时间，
   * 使 AUDIOPROCESSING 型 pulse/shake 效果仍可见周期性亮暗变化。
   */
  private _updateSimulatedSpectrum(): void {
    const now = Date.now();
    if (this._simLastTime === 0) this._simLastTime = now;
    const dt = Math.min((now - this._simLastTime) / 1000, 0.1); // 单帧最多推进 100ms
    this._simLastTime = now;
    this._simTimeS += dt;

    // 重鼓是单声道，左右声道使用完全相同的包络
    this._fillKickBand(this._spectrum16Left, this._simTimeS);
    this._fillKickBand(this._spectrum16Right, this._simTimeS);
    this._fillKickBand(this._spectrum32Left, this._simTimeS);
    this._fillKickBand(this._spectrum32Right, this._simTimeS);
    this._fillKickBand(this._spectrum64Left, this._simTimeS);
    this._fillKickBand(this._spectrum64Right, this._simTimeS);
    AudioDataProvider.setSpectrum(
      this._spectrum16Left, this._spectrum16Right,
      this._spectrum32Left, this._spectrum32Right,
      this._spectrum64Left, this._spectrum64Right,
    );
  }

  /**
   * 模拟 120 BPM 重鼓（kick drum）的频谱包络。
   * 每 0.5 s 触发一次：快速冲击攻击 + 指数衰减，能量高度集中在低频 bin。
   *
   * 低频 bin 静息值 ≈ 0.22（低于常见 audiobounds 下限 0.3），
   * 鼓击峰值 ≈ 0.95，确保 pulse 效果明显亮起随后快速暗下。
   */
  private _fillKickBand(output: Float32Array, timeS: number): void {
    const len = output.length;
    const BEAT_PERIOD = 0.5; // 120 BPM → 每拍 0.5 秒
    const beatPos = (timeS % BEAT_PERIOD) / BEAT_PERIOD; // [0, 1)

    // 鼓击包络：线性攻击（前 5%）+ 指数衰减
    const ATTACK = 0.05;
    const kick = beatPos < ATTACK
      ? beatPos / ATTACK
      : Math.exp(-9.0 * (beatPos - ATTACK));

    for (let i = 0; i < len; i++) {
      const x = i / Math.max(1, len - 1);
      // 重鼓能量集中在低频，高频 bin 急剧衰减
      const freqFalloff = Math.pow(Math.max(0, 1.0 - x * 1.1), 1.5);
      const value = (0.22 + kick * 0.73) * freqFalloff;
      output[i] = Math.max(0, Math.min(1, value));
    }
  }
}
