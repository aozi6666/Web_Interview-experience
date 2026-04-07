import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import { useStyles } from './styles';
import '../../index.css';
import {
  getVolcengineVoiceList,
  testVolcengineVoice,
  VolcengineVoice,
} from '@api/requests/volcengine';

interface ModifyVoiceProps {
  onClose: () => void;
  onSelectVoice?: (voice: VolcengineVoice) => void;
}

function ModifyVoice({ onClose, onSelectVoice }: ModifyVoiceProps) {
  const { styles } = useStyles();
  const [voices, setVoices] = useState<VolcengineVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 加载音色列表
  useEffect(() => {
    const loadVoices = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('开始加载音色列表...');
        const response = await getVolcengineVoiceList({ language: 'zh' });
        // eslint-disable-next-line no-console
        console.log('音色列表API响应:', response);

        // 根据实际API响应结构调整数据提取逻辑
        // 火山引擎API响应格式：{ Result: { Timbres: [...] } }
        // 每个Timbre包含：SpeakerID 和 TimbreInfos[]
        let voiceList: VolcengineVoice[] = [];

        if (
          response?.Result?.Timbres &&
          Array.isArray(response.Result.Timbres)
        ) {
          // 火山引擎标准格式：提取所有TimbreInfos
          voiceList = response.Result.Timbres.flatMap((timbre: any) => {
            if (timbre.TimbreInfos && Array.isArray(timbre.TimbreInfos)) {
              return timbre.TimbreInfos.map((info: any) => {
                let gender = info.Gender;
                if (info.Gender === '女') {
                  gender = 'female';
                } else if (info.Gender === '男') {
                  gender = 'male';
                }
                return {
                  voice_id: timbre.SpeakerID || info.SpeakerID,
                  voice_name: info.SpeakerName || timbre.SpeakerID,
                  voice_type: timbre.SpeakerID,
                  gender,
                  language:
                    info.Categories?.[0]?.NextCategory?.Category || 'zh',
                  description: info.DemoText,
                };
              });
            }
            // 如果没有TimbreInfos，使用SpeakerID
            return [
              {
                voice_id: timbre.SpeakerID,
                voice_name: timbre.SpeakerID,
                voice_type: timbre.SpeakerID,
              },
            ];
          });
        } else {
          // 其他格式（Coze API或后端代理格式）
          voiceList =
            response.data?.voices ||
            response.data?.list ||
            response.voices ||
            response.list ||
            response.data ||
            [];
        }

        // eslint-disable-next-line no-console
        console.log('解析后的音色列表:', voiceList);

        if (voiceList.length > 0) {
          setVoices(voiceList);
        } else {
          // 如果返回空数组，使用默认音色列表
          // eslint-disable-next-line no-console
          console.warn('API返回空列表，使用默认音色');
          setVoices([
            {
              voice_id: 'zh_male_wennuanahu_moon_bigtts',
              voice_name: '温暖男声',
            },
            { voice_id: 'zh_female_qingxin', voice_name: '清新女声' },
          ]);
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('加载音色列表失败:', error);
        message.error(`加载音色列表失败: ${error.message}`);
        // 如果API调用失败，使用默认音色列表作为降级方案
        setVoices([
          {
            voice_id: 'zh_male_wennuanahu_moon_bigtts',
            voice_name: '温暖男声',
          },
          { voice_id: 'zh_female_qingxin', voice_name: '清新女声' },
        ]);
      }
    };

    loadVoices();
  }, []);

  // 播放音色预览
  const handlePlayPreview = useCallback(
    async (voice: VolcengineVoice) => {
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

        // 调用火山引擎API进行语音合成
        const audioBlob = await testVolcengineVoice({
          voice_id: voice.voice_id,
          text: '你好，这是音色预览', // 预览文本
          format: 'mp3',
          sample_rate: 16000,
        });

        // 创建音频URL并播放
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.addEventListener('ended', () => {
          setPlayingVoiceId(null);
          URL.revokeObjectURL(audioUrl);
        });

        audio.addEventListener('error', () => {
          message.error('音色预览播放失败');
          setPlayingVoiceId(null);
          URL.revokeObjectURL(audioUrl);
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

  // 选择音色
  const handleSelectVoice = useCallback(
    (voice: VolcengineVoice) => {
      setSelectedVoiceId(voice.voice_id);
      if (onSelectVoice) {
        onSelectVoice(voice);
      }
    },
    [onSelectVoice],
  );

  // 清理音频资源
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className={styles.modifyContainer}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          title="关闭"
        >
          ✕
        </button>
      )}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.allButton}>
          全部音色
        </button>
      </div>

      <div className={styles.tonesGrid}>
        {voices.map((voice) => (
          <div
            key={voice.voice_id}
            className={`${styles.toneCard} ${selectedVoiceId === voice.voice_id ? styles.toneCardSelected : ''}`}
            onClick={() => handleSelectVoice(voice)}
          >
            <div
              className={styles.tonePlayButton}
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPreview(voice);
              }}
            >
              {playingVoiceId === voice.voice_id ? (
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="rgba(255, 255, 255, 0.2)" />
                  <rect x="5" y="5" width="2" height="6" fill="#fff" />
                  <rect x="9" y="5" width="2" height="6" fill="#fff" />
                </svg>
              ) : (
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="rgba(255, 255, 255, 0.2)" />
                <path d="M6 5L11 8L6 11V5Z" fill="#fff" />
              </svg>
              )}
            </div>
            <div className={styles.toneName}>
              {voice.voice_name || voice.voice_id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

ModifyVoice.defaultProps = {
  onSelectVoice: undefined,
};

export default ModifyVoice;
