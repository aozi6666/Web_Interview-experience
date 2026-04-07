import { useCallback, useRef, useEffect } from 'react';
import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


/**
 * 获取音频文件的正确路径
 */
const getAudioPath = async (audioFile: string): Promise<string> => {
  try {
    // 在开发环境中，使用相对路径
    if (process.env.NODE_ENV === 'development') {
      return `/${audioFile}`;
    }

    // 在生产环境中，通过IPC获取resources路径
    const resourcesPath = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.GET_RESOURCES_PATH);
    if (resourcesPath) {
      // 音频文件在assets/audio目录下
      return `file://${resourcesPath}/assets/audio/${audioFile}`;
    }

    // 如果无法获取resources路径，使用相对路径作为fallback
    console.warn('无法获取resources路径，使用相对路径');
    return `/${audioFile}`;
  } catch (error) {
    console.error('获取音频路径失败:', error);
    return `/${audioFile}`;
  }
};

/**
 * 音频播放 Hook
 */
export const useChatAudio = () => {
  const playAudio = useCallback(async (audioFile: string) => {
    try {
      const audioPath = await getAudioPath(audioFile);
      const audio = new Audio(audioPath);
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.error('播放音频失败:', audioFile, error, '路径:', audioPath);
      });
    } catch (error) {
      console.error('创建音频对象失败:', audioFile, error);
    }
  }, []);

  return { playAudio };
};

/**
 * 等待音频播放 Hook - 支持循环播放和停止
 */
export const useWaitingAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playWaitingAudio = useCallback(async () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audioPath = await getAudioPath('phone_waiting.mp3');
      const audio = new Audio(audioPath);
      audio.volume = 0.3; // 设置较低音量
      audio.loop = true; // 循环播放

      audioRef.current = audio;
      audio.play().catch((error) => {
        console.error('播放等待音频失败:', error, '路径:', audioPath);
      });
    } catch (error) {
      console.error('创建等待音频对象失败:', error);
    }
  }, []);

  const stopWaitingAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      stopWaitingAudio();
    };
  }, [stopWaitingAudio]);

  return {
    playWaitingAudio,
    stopWaitingAudio,
  };
};
