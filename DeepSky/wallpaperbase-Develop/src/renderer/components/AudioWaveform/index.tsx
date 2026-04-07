import React, { useEffect, useMemo, useState } from 'react';
import { useStyles } from './styles';

interface AudioWaveformProps {
  isEnabled: boolean;
  samples: number[];
}

const DEFAULT_POINTS = 48;
const LOW_SIGNAL_THRESHOLD = 0.03;
const IDLE_SINE_AMPLITUDE = 0.08;
const IDLE_WAVE_CYCLES = 2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createIdleSineSamples = (pointCount: number, phase: number): number[] =>
  Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1 || 1);
    return (
      Math.sin(t * Math.PI * 2 * IDLE_WAVE_CYCLES + phase) * IDLE_SINE_AMPLITUDE
    );
  });

const buildSmoothPath = (samples: number[], width: number, height: number) => {
  const centerY = height / 2;
  if (!samples.length) {
    return `M 0 ${centerY} L ${width} ${centerY}`;
  }

  const points = samples.map((sample, index) => ({
    x: (index / (samples.length - 1 || 1)) * width,
    y: centerY - clamp(sample, -1, 1) * (height * 0.45),
  }));

  if (points.length < 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = ((current.x + next.x) / 2).toFixed(2);
    path += ` Q ${controlX} ${current.y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
};

// 麦克风输入示波器组件（时域折线）
const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isEnabled,
  samples,
}) => {
  const { styles } = useStyles();
  const [idlePhase, setIdlePhase] = useState(0);
  useEffect(() => {
    let frameId: number | null = null;
    if (!isEnabled) {
      setIdlePhase(0);
    } else {
      const tick = () => {
        setIdlePhase((prev) => prev + 0.12);
        frameId = window.requestAnimationFrame(tick);
      };
      frameId = window.requestAnimationFrame(tick);
    }
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isEnabled]);

  const maxAbs = useMemo(
    () => samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0),
    [samples],
  );
  const isLowSignal = maxAbs < LOW_SIGNAL_THRESHOLD;
  const displaySamples = useMemo(() => {
    if (!isEnabled) {
      return Array.from({ length: DEFAULT_POINTS }, () => 0);
    }
    if (isLowSignal) {
      return createIdleSineSamples(samples.length || DEFAULT_POINTS, idlePhase);
    }
    return samples;
  }, [idlePhase, isEnabled, isLowSignal, samples]);
  const waveformPath = buildSmoothPath(displaySamples, 220, 40);

  return (
    <svg
      className={styles.audioWaveform}
      viewBox="0 0 220 40"
      role="img"
      aria-label="音频输入波形"
    >
      <path d="M 0 20 L 220 20" className={styles.baseLine} />
      <path d={waveformPath} className={styles.waveLine} />
    </svg>
  );
};

export default AudioWaveform;
