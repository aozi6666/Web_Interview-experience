import { useEffect, useRef, useState } from 'react';

interface UseAudioWaveformOptions {
  enabled: boolean;
  pointCount?: number;
}

const DEFAULT_POINT_COUNT = 48;
const FFT_SIZE = 1024;
const SIGNAL_THRESHOLD = 0.012;
const MIN_GAIN = 1;
const MAX_GAIN = 12;
const TARGET_RMS = 0.08;
const MIN_RMS_FOR_GAIN = 0.004;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const downsample = (input: Float32Array, pointCount: number): number[] => {
  if (input.length === 0 || pointCount <= 0) {
    return [];
  }

  const step = Math.max(1, Math.floor(input.length / pointCount));
  const output = new Array<number>(pointCount).fill(0);
  for (let i = 0; i < pointCount; i += 1) {
    const sourceIndex = Math.min(i * step, input.length - 1);
    output[i] = input[sourceIndex];
  }
  return output;
};

export const useAudioWaveform = ({
  enabled,
  pointCount = DEFAULT_POINT_COUNT,
}: UseAudioWaveformOptions) => {
  const [samples, setSamples] = useState<number[]>(
    Array.from({ length: pointCount }, () => 0),
  );
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Float32Array | null>(null);
  const fallbackDecayRef = useRef<number[]>(
    Array.from({ length: pointCount }, () => 0),
  );
  const agcGainRef = useRef<number>(1);
  const noiseFloorRef = useRef<number>(SIGNAL_THRESHOLD * 0.5);

  useEffect(() => {
    fallbackDecayRef.current = Array.from({ length: pointCount }, () => 0);
    agcGainRef.current = 1;
    noiseFloorRef.current = SIGNAL_THRESHOLD * 0.5;
    setSamples(Array.from({ length: pointCount }, () => 0));
  }, [pointCount]);

  useEffect(() => {
    let disposed = false;

    const stopAll = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      dataRef.current = null;
      fallbackDecayRef.current = Array.from({ length: pointCount }, () => 0);
      agcGainRef.current = 1;
      noiseFloorRef.current = SIGNAL_THRESHOLD * 0.5;
      setSamples(Array.from({ length: pointCount }, () => 0));
    };

    if (!enabled || typeof window === 'undefined' || !navigator.mediaDevices) {
      stopAll();
      return () => {
        stopAll();
      };
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          return;
        }

        const context = new window.AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.1;
        source.connect(analyser);

        streamRef.current = stream;
        audioContextRef.current = context;
        analyserRef.current = analyser;
        dataRef.current = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (disposed || !analyserRef.current || !dataRef.current) return;

          analyserRef.current.getFloatTimeDomainData(dataRef.current);

          let sum = 0;
          for (let i = 0; i < dataRef.current.length; i += 1) {
            const v = dataRef.current[i];
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataRef.current.length);
          const input = downsample(dataRef.current, pointCount);
          const prevNoiseFloor = noiseFloorRef.current;
          const nextNoiseFloor =
            rms < SIGNAL_THRESHOLD
              ? prevNoiseFloor * 0.97 + rms * 0.03
              : prevNoiseFloor * 0.995 + rms * 0.005;
          noiseFloorRef.current = clamp(nextNoiseFloor, 0.0015, 0.03);
          const effectiveRms = Math.max(
            rms - noiseFloorRef.current * 0.65,
            MIN_RMS_FOR_GAIN,
          );
          const targetGain = clamp(
            TARGET_RMS / effectiveRms,
            MIN_GAIN,
            MAX_GAIN,
          );
          const nextGain = agcGainRef.current * 0.92 + targetGain * 0.08;
          agcGainRef.current = nextGain;

          if (rms < SIGNAL_THRESHOLD && effectiveRms <= MIN_RMS_FOR_GAIN * 1.2) {
            const next = input.map((_, idx) => {
              const decayed = fallbackDecayRef.current[idx] * 0.82;
              return clamp(decayed, -0.02, 0.02);
            });
            fallbackDecayRef.current = next;
            setSamples(next);
          } else {
            const next = input.map((value, idx) => {
              const prev = fallbackDecayRef.current[idx] || 0;
              const boosted = clamp(value * agcGainRef.current, -1, 1);
              const alpha = Math.abs(boosted) > Math.abs(prev) ? 0.55 : 0.2;
              const merged = prev * (1 - alpha) + boosted * alpha;
              return clamp(merged, -1, 1);
            });
            fallbackDecayRef.current = next;
            setSamples(next);
          }

          animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);
      } catch {
        stopAll();
      }
    };

    void start();

    return () => {
      disposed = true;
      stopAll();
    };
  }, [enabled, pointCount]);

  return { samples };
};

export default useAudioWaveform;
