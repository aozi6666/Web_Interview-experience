import React, { useEffect, useCallback, useState,useRef } from 'react';
import { useStyles } from './styles';
import refreshIcon from '$assets/images/uploadPhoto/refresh-ccw-01.png';
import playIcon from '$assets/images/uploadPhoto/play.png';
import pauseIcon from '$assets/images/uploadPhoto/pause.png';
import selectIcon from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose2__size_32.png';

import {
  speakWithVolcVoice,
  VolcVoiceItem,
} from '@api/requests/volcVoice';
import { message } from 'antd';

type VoiceOption = Partial<VolcVoiceItem> & {
  voice_id: string;
  voice_name?: string;
  speaker_name?: string;
};

interface SetVoiceSettingProps {
  voices: VoiceOption[];
  selectedVoiceId: string | null;
  defaultSelectedVoiceId?: string | '';
  onSelectedVoiceIdChange?: (voiceId: string) => void;
}

function SetVoiceSetting({
  voices,
  selectedVoiceId,
  defaultSelectedVoiceId = '',
  onSelectedVoiceIdChange,
}: SetVoiceSettingProps) {
  const { styles } = useStyles();
  const [selectedVoiceItem, setSelectedVoiceItem] = useState<string | null>(selectedVoiceId);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    setSelectedVoiceItem(selectedVoiceId);
  }, [selectedVoiceId]);

  const handleSelectVoice = useCallback(
    (voiceId: string) => {
      setSelectedVoiceItem(voiceId);
      onSelectedVoiceIdChange?.(voiceId);
    },
    [onSelectedVoiceIdChange],
  );

  const handleResetSelectedVoice = useCallback(() => {
    setSelectedVoiceItem(defaultSelectedVoiceId);
    onSelectedVoiceIdChange?.(defaultSelectedVoiceId);
  }, [defaultSelectedVoiceId, onSelectedVoiceIdChange]);

  const handlePlayPreview = useCallback(
    async (voice: VoiceOption) => {
      // 如果正在播放同一个音色，则停止
      if (playingVoiceId === voice.voice_id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingVoiceId(null);
        return;
      }

      // 停止之前的播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      try {
        setPlayingVoiceId(voice.voice_id);

        // 调用新接口进行语音合成
        const speakResult = await speakWithVolcVoice({
          voice_id: voice.voice_id,
          text: voice.speaker_name || voice.voice_id, // 预览文本
        });
        const audioUrl = speakResult?.data?.url;
        if (!audioUrl) {
          throw new Error('未获取到音频地址');
        }

        // 使用返回的音频URL直接播放
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.addEventListener('ended', () => {
          setPlayingVoiceId(null);
        });

        audio.addEventListener('error', () => {
          message.error('音色预览播放失败');
          setPlayingVoiceId(null);
        });

        await audio.play();
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('播放音色预览失败:', error);
        message.error(`预览失败: ${error.message || '未知错误'}`);
        setPlayingVoiceId(null);
      }
    },
    [playingVoiceId],
  );
  return (
    <div className={styles.container}>
      <div className={styles.title}>修改音色</div>
      <div className={styles.contentBox}>
        <div className={styles.contentGrid}>
          {voices.map((voice) => (
            <div
              key={voice.voice_id}
              className={styles.contentItem}
              onClick={() => handleSelectVoice(voice.voice_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectVoice(voice.voice_id);
                }
              }}
            >
              <button
                type="button"
                className={styles.contentItemAvatar}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPreview(voice);
                }}
              >
                <img
                  src={playingVoiceId === voice.voice_id ? pauseIcon : playIcon}
                  alt={playingVoiceId === voice.voice_id ? 'pause' : 'play'}
                  className={styles.contentItemAvatarIcon}
                />
              </button>
              <div className={styles.contentItemText}>
                {voice.speaker_name || voice.voice_name || voice.voice_id}
              </div>
              {selectedVoiceItem === voice.voice_id && (
                <img
                  src={selectIcon}
                  alt="selected"
                  className={styles.contentItemSelectIcon}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.bottomButton}
        onClick={handleResetSelectedVoice}
      >
        <img src={refreshIcon} alt="refresh" className={styles.bottomButtonIcon} />
        <span className={styles.bottomButtonText}>重置</span>
      </button>
    </div>
  );
}

export default SetVoiceSetting;
