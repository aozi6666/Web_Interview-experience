import { Engine } from 'moyu-engine';
import { parsePkg, getMimeType } from '../PkgLoader';
import { ResourceIO } from '../ResourceIO';
import type { SceneObject } from '../LoaderTypes';
import { getScriptFieldValue } from '../LoaderUtils';

type PkgData = ReturnType<typeof parsePkg>;

/** 当前播放的音频元素（用于清理） */
let _currentAudio: HTMLAudioElement | null = null;

/**
 * 清除当前播放的音频（供 clearLoaderCaches 调用）
 */
export function clearSoundObjectAudio(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = '';
    _currentAudio = null;
  }
}

/**
 * 加载并播放场景音频
 *
 * 从 PKG 包中提取音频文件，创建 blob URL 后使用 HTML5 Audio 播放。
 * 支持循环播放和音量控制。
 */
export function loadSoundObject(
  engine: Engine,
  pkg: PkgData | null,
  obj: SceneObject,
  basePath: string,
  io?: ResourceIO,
): void {
  const resourceIO = io ?? new ResourceIO(pkg, basePath);
  const soundPaths = obj.sound || [];
  if (soundPaths.length === 0) return;

  const soundPath = soundPaths[0];
  const loop = obj.playbackmode?.toLowerCase() === 'loop';
  const rawVolume = getScriptFieldValue(obj.volume) ?? 1.0;
  const volume = (Number.isFinite(rawVolume) && rawVolume >= 0 && rawVolume <= 1) ? rawVolume : 1.0;

  const audioUrl = resourceIO.loadBlobUrl(soundPath, getMimeType(soundPath)) ?? `${basePath}/${soundPath}`;

  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = '';
    _currentAudio = null;
  }

  const audio = new Audio(audioUrl);
  audio.loop = loop;
  audio.volume = volume;
  engine.registerAudioElement(audio);
  _currentAudio = audio;

  audio.play().then(() => {
    console.log(`音频已播放: ${obj.name || soundPath} (loop=${loop}, volume=${volume})`);
  }).catch(() => {
    console.log(`音频等待用户交互后播放: ${obj.name || soundPath}`);
    const resumeAudio = () => {
      audio.play().then(() => {
        console.log(`音频已恢复播放: ${obj.name || soundPath}`);
      }).catch(err => {
        console.warn('音频播放失败:', err);
      });
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio, { once: true });
    document.addEventListener('keydown', resumeAudio, { once: true });
  });
}
