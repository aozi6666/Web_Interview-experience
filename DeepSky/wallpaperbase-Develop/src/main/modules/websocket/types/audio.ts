/**
 * 音频相关命令类型定义
 */

export interface SoundBody {
  seq: number;
  chat_id: string;
  segment_id: string;
  base64: string;
  start: boolean;
  end: boolean;
  character?: string;
}

export interface SoundCommand {
  type: 'sound';
  sound: SoundBody;
}

export interface PlaySoundCommand {
  type: 'playSound';
  startPlay: boolean;
  chat_id: string;
}

export interface InterruptCommand {
  type: 'interrupt';
  chat_id: string;
}

// 背景音乐音量控制命令
export interface BGMVolumeCommand {
  type: 'bgmVolume';
  data: {
    volume: number; // 0-100 的音量值
  };
}

// 静音控制命令
export interface MuteCommand {
  type: 'mute';
  data: {
    muted: boolean; // true表示静音，false表示取消静音
  };
}

// 对话音频静音控制命令
export interface ChatAudioMuteCommand {
  type: 'chatAudioMute';
  data: {
    muted: boolean; // true表示静音，false表示取消静音
  };
}
