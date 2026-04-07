import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect, useRef } from 'react';

type BGMPlayPayload = {
  audioUrl: string;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
};

type BGMAudioStatePayload = {
  muted?: boolean;
  volume?: number;
};

const ipcEvents = getIpcEvents();

function normalizeVolume(volume: number): number {
  if (Number.isNaN(volume)) {
    return 1;
  }
  return Math.max(0, Math.min(1, volume / 100));
}

function BGMAudioListener() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const getOrCreateAudio = (): HTMLAudioElement => {
      if (audioRef.current) {
        return audioRef.current;
      }
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
      return audio;
    };

    const stopAudio = () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    };

    const handlePlayAudio = (payload: BGMPlayPayload) => {
      if (!payload?.audioUrl) {
        stopAudio();
        return;
      }

      const audio = getOrCreateAudio();
      if (audio.src !== payload.audioUrl) {
        audio.src = payload.audioUrl;
      }
      if (typeof payload.loop === 'boolean') {
        audio.loop = payload.loop;
      }
      if (typeof payload.muted === 'boolean') {
        audio.muted = payload.muted;
      }
      if (typeof payload.volume === 'number') {
        audio.volume = normalizeVolume(payload.volume);
      }
      void audio.play().catch((error) => {
        console.error('[BGMAudioListener] 播放音频失败:', error);
      });
    };

    const handleAudioStateChanged = (payload: BGMAudioStatePayload) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (typeof payload?.muted === 'boolean') {
        audio.muted = payload.muted;
      }
      if (typeof payload?.volume === 'number') {
        audio.volume = normalizeVolume(payload.volume);
      }
    };

    const handlePauseAudio = () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.pause();
    };

    const handleResumeAudio = () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      void audio.play().catch((error) => {
        console.error('[BGMAudioListener] 恢复音频失败:', error);
      });
    };

    ipcEvents.on(IpcTarget.MAIN, IPCChannels.BGM_PLAY_AUDIO, handlePlayAudio);
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.BGM_STOP_AUDIO, stopAudio);
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.BGM_PAUSE_AUDIO, handlePauseAudio);
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.BGM_RESUME_AUDIO, handleResumeAudio);
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.BGM_AUDIO_STATE_CHANGED,
      handleAudioStateChanged,
    );

    return () => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.BGM_PLAY_AUDIO, handlePlayAudio);
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.BGM_STOP_AUDIO, stopAudio);
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.BGM_PAUSE_AUDIO, handlePauseAudio);
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.BGM_RESUME_AUDIO, handleResumeAudio);
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.BGM_AUDIO_STATE_CHANGED,
        handleAudioStateChanged,
      );
      stopAudio();
      audioRef.current = null;
    };
  }, []);

  return null;
}

export default BGMAudioListener;
