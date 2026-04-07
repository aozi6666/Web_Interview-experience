import transferIcon from '$assets/icons/Cteation/trash.png';
import selectIcon from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose2__size_32.png';
import { Image, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import '../../index.css';
import { useStyles } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


interface CreationTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: string;
  type: 'wallpaper' | 'character' | 'scene' | 'light' | 'music';
  audioUrl?: string;
}

const CREATION_TEMPLATES: CreationTemplate[] = [
  {
    id: '3',
    name: '1号音乐',
    description: '音乐模板',
    author: '1号音乐',
    thumbnail: '',
    type: 'music',
    // 使用 $assets 别名，将在运行时解析为实际路径
    audioUrl: '$assets/audio/music1.m4a',
  },
  {
    id: '9',
    name: '2号音乐',
    description: '音乐模板',
    author: '2号音乐',
    thumbnail: '',
    type: 'music',
    audioUrl: '$assets/audio/music2.m4a',
  },
  {
    id: '4',
    name: '音乐3',
    description: '音乐模板',
    author: '拨号音',
    thumbnail:
      'https://img.tukuppt.com/png_preview/00/04/80/6qOaqJZnpq.jpg!/fw/780',
    type: 'music',
    audioUrl: '$assets/audio/拨号.m4a',
  },
  {
    id: '5',
    name: '音乐4',
    description: '音乐模板',
    author: '音乐4',
    thumbnail: '',
    type: 'music',
    audioUrl: '$assets/audio/music4.wav',
  },
];
interface MusicProps {
  musicId?: string;
  onSelectMusic?: (id:string) => void;
}
const Music: React.FC<MusicProps> = ({musicId,onSelectMusic})=> {
  const { styles } = useStyles();
  // 选中的筛选类型状态 - 必须在所有条件之前调用
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  // 选中的音乐ID状态
  // const [selectedMusic, setSelectedMusic] = useState<string>('');
  // hover 的音乐ID状态
  const [hoveredMusicId, setHoveredMusicId] = useState<string | null>(null);
  // 播放相关状态
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingMusicId, setLoadingMusicId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 项目根路径缓存
  const [projectPath, setProjectPath] = useState<string | null>(null);
  // 音乐时长和剩余时间状态
  const [musicDurations, setMusicDurations] = useState<
    Record<string, { total: number; remaining: number }>
  >({});
  // 用于存储每个音频的定时器引用，用于手动更新进度
  const progressUpdateTimers = useRef<
    Record<string, ReturnType<typeof setInterval>>
  >({});

  // 获取项目路径
  useEffect(() => {
    const fetchProjectPath = async () => {
      try {
        const projectRootPath = await ipcEvents.invokeTo(IpcTarget.MAIN, 
          IPCChannels.PATH_GET_PROJECT_PATH,
        );
        if (projectRootPath) {
          setProjectPath(projectRootPath);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('获取项目路径失败:', error);
      }
    };
    fetchProjectPath();
  }, []);

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      // 清理所有进度更新定时器
      Object.values(progressUpdateTimers.current).forEach((timer) => {
        clearInterval(timer);
      });
      progressUpdateTimers.current = {};

      // 清理音频资源
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // 解析音频文件路径
  const resolveAudioPath = useCallback(
    async (audioUrl: string): Promise<string> => {
      // 如果已经是 file:// 协议，直接返回
      if (audioUrl.startsWith('file://')) {
        return audioUrl;
      }

      // 获取项目路径（如果还没有）
      let currentProjectPath = projectPath;
      if (!currentProjectPath) {
        currentProjectPath = await ipcEvents.invokeTo(IpcTarget.MAIN, 
          IPCChannels.PATH_GET_PROJECT_PATH,
        );
        if (!currentProjectPath) {
          throw new Error('无法获取项目路径');
        }
        setProjectPath(currentProjectPath);
      }

      // 如果是 $assets 别名，需要解析
      if (audioUrl.startsWith('$assets/')) {
        const relativePath = audioUrl.replace('$assets/', 'assets/');
        const normalizedPath = currentProjectPath.replace(/\\/g, '/');
        const fullPath = `${normalizedPath}/${relativePath}`;
        return `file:///${fullPath}`;
      }

      // 如果是相对路径，需要解析为绝对路径
      if (audioUrl.startsWith('../') || audioUrl.startsWith('./')) {
        // 简化处理：假设相对路径是相对于项目根目录的
        const normalizedPath = currentProjectPath.replace(/\\/g, '/');
        const fullPath = `${normalizedPath}/${audioUrl}`;
        return `file:///${fullPath}`;
      }

      // 其他情况直接返回
      return audioUrl;
    },
    [projectPath],
  );

  // 处理播放/暂停
  const handlePlayClick = useCallback(
    async (e: React.MouseEvent, template: CreationTemplate) => {
      e.stopPropagation(); // 阻止触发卡片点击事件

      // 如果点击的是当前播放的音乐，则暂停
      if (playingMusicId === template.id && isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        return;
      }

      // 停止之前播放的音乐
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';

        // 清除之前音频的进度更新定时器
        const previousMusicId = playingMusicId;
        if (previousMusicId && progressUpdateTimers.current[previousMusicId]) {
          clearInterval(progressUpdateTimers.current[previousMusicId]);
          delete progressUpdateTimers.current[previousMusicId];
        }

        audioRef.current = null;
      }

      // 播放新音乐
      if (!template.audioUrl) {
        message.warning('该音乐暂无音频文件');
        return;
      }

      try {
        setLoadingMusicId(template.id);

        // 解析音频文件路径
        const resolvedPath = await resolveAudioPath(template.audioUrl!);
        // eslint-disable-next-line no-console
        console.log('解析后的音频路径:', resolvedPath);

        // 使用 Audio 构造函数创建音频对象
        // 这种方式在 Electron 中兼容性更好
        const audio = new Audio(resolvedPath);
        audioRef.current = audio;

        // 设置预加载属性
        audio.preload = 'auto';

        // 用于跟踪音频是否成功加载
        let audioLoadedSuccessfully = false;
        let errorHandled = false;

        // 添加错误处理（只在真正失败时显示错误）
        audio.addEventListener('error', () => {
          // 如果音频已经成功加载，忽略错误事件
          if (audioLoadedSuccessfully || errorHandled) {
            return;
          }

          // 延迟检查，给音频一些时间加载
          setTimeout(() => {
            // 再次检查音频状态
            if (audioLoadedSuccessfully || errorHandled) {
              return;
            }

            // 检查 readyState，如果大于 0 说明至少加载了一些数据
            // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
            if (audio.readyState > 0) {
              // 音频至少加载了元数据，可能不是真正的错误
              return;
            }

            const { error } = audio;
            if (!error) {
              return;
            }

            errorHandled = true;

            let errorMessage = '音频加载失败';

            switch (error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                // 用户中止加载，不显示错误
                setLoadingMusicId(null);
                setIsPlaying(false);
                setPlayingMusicId(null);
                return;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                // 格式不支持，但如果能播放就不显示错误
                // 只在播放真正失败时才提示
                setLoadingMusicId(null);
                setIsPlaying(false);
                setPlayingMusicId(null);
                return;
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage =
                  '网络错误，无法加载音频，请检查网络连接或 CORS 设置';
                break;
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = '音频解码失败，请检查文件格式或文件是否损坏';
                break;
              default:
                errorMessage = `音频加载失败 (错误代码: ${error.code})`;
            }

            message.error(errorMessage);
            setLoadingMusicId(null);
            setIsPlaying(false);
            setPlayingMusicId(null);
          }, 500); // 延迟 500ms 检查
        });

        // 等待音频可以播放
        audio.addEventListener('canplaythrough', async () => {
          // 标记音频已成功加载，防止错误处理触发
          audioLoadedSuccessfully = true;
          errorHandled = true;
          try {
            await audio.play();
            setPlayingMusicId(template.id);
            setIsPlaying(true);
            setLoadingMusicId(null);
          } catch (playError: any) {
            // 处理播放权限问题
            if (playError.name === 'NotAllowedError') {
              message.error('浏览器阻止了自动播放，请手动点击播放按钮');
            } else {
              message.error(
                `播放失败: ${playError.message || '请检查音频文件'}`,
              );
            }
            setLoadingMusicId(null);
            setIsPlaying(false);
            setPlayingMusicId(null);
          }
        });

        // 也监听 loadeddata 事件，更早地标记为成功
        audio.addEventListener('loadeddata', () => {
          audioLoadedSuccessfully = true;
          // 获取音频总时长
          if (
            audio.duration &&
            !Number.isNaN(audio.duration) &&
            Number.isFinite(audio.duration)
          ) {
            setMusicDurations((prev) => ({
              ...prev,
              [template.id]: {
                total: audio.duration,
                remaining: audio.duration,
              },
            }));
          }
        });

        // 监听 loadedmetadata 事件，获取音频元数据（包括时长）
        audio.addEventListener('loadedmetadata', () => {
          if (
            audio.duration &&
            !Number.isNaN(audio.duration) &&
            Number.isFinite(audio.duration)
          ) {
            setMusicDurations((prev) => ({
              ...prev,
              [template.id]: {
                total: audio.duration,
                remaining: audio.duration,
              },
            }));
          }
        });

        // 监听播放进度，实时更新剩余时间
        const updateProgress = () => {
          if (!audio) return;

          // 检查音频是否仍在播放
          if (audio.paused || audio.ended) {
            return;
          }

          // 优先使用 timeupdate 事件中的值，但如果 duration 无效，使用之前保存的值
          const { currentTime, duration } = audio;

          // 如果 duration 有效，使用它；否则使用之前保存的 total
          const validDuration =
            duration && !Number.isNaN(duration) && Number.isFinite(duration)
              ? duration
              : musicDurations[template.id]?.total || 0;

          if (
            validDuration > 0 &&
            !Number.isNaN(currentTime) &&
            Number.isFinite(currentTime)
          ) {
            const remaining = Math.max(0, validDuration - currentTime);
            setMusicDurations((prev) => ({
              ...prev,
              [template.id]: {
                total: validDuration,
                remaining,
              },
            }));
          }
        };

        // 使用 timeupdate 事件（浏览器原生事件，更准确）
        audio.addEventListener('timeupdate', updateProgress);

        // 添加备选方案：使用 setInterval 定期更新（防止 timeupdate 停止触发）
        // 清除之前的定时器（如果存在）
        if (progressUpdateTimers.current[template.id]) {
          clearInterval(progressUpdateTimers.current[template.id]);
        }

        // 每 100ms 更新一次进度（作为 timeupdate 的备选方案）
        progressUpdateTimers.current[template.id] = setInterval(() => {
          if (audio && !audio.paused && !audio.ended) {
            updateProgress();
          }
        }, 100);

        // 播放结束
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setPlayingMusicId(null);
          setLoadingMusicId(null);

          // 清除进度更新定时器
          if (progressUpdateTimers.current[template.id]) {
            clearInterval(progressUpdateTimers.current[template.id]);
            delete progressUpdateTimers.current[template.id];
          }

          // 重置剩余时间为总时长
          setMusicDurations((prev) => {
            if (prev[template.id]) {
              return {
                ...prev,
                [template.id]: {
                  ...prev[template.id],
                  remaining: prev[template.id].total,
                },
              };
            }
            return prev;
          });
        });

        // 开始加载音频
        audio.load();
      } catch (error: any) {
        message.error(`播放失败: ${error.message || '未知错误'}`);
        setLoadingMusicId(null);
        setIsPlaying(false);
        setPlayingMusicId(null);
      }
    },
    [playingMusicId, isPlaying, resolveAudioPath, musicDurations],
  );

  // 过滤出角色类型的模板
  const filteredTemplates = CREATION_TEMPLATES.filter(
    (template) => template.type === 'music',
  );

  const handleTemplateClick = useCallback((template: CreationTemplate) => {
    // setSelectedMusic(template.id);
    message.info(`选择音乐: ${template.name}`);
    if (onSelectMusic) {
      onSelectMusic(template.id);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    message.info('上传音乐功能开发中');
  }, []);

  const handleFilterClick = useCallback((filter: string) => {
    setSelectedFilter(filter);
  }, []);

  // 格式化时间为 "Xm Ys" 格式
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) {
      return '0m 0s';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  }, []);

  return (
    <div className={styles.musicContainer}>
      <div className="typeButtons">
        <button
          type="button"
          className={`${styles.musicTypeButton} ${selectedFilter === 'all' ? styles.musicTypeButtonActiveClick : ''}`}
          onClick={() => handleFilterClick('all')}
        >
          所有音乐
        </button>
        <button
          type="button"
          className={styles.uptypeButtons}
          onClick={handleCreateNew}
        >
          上传音乐
        </button>
      </div>
      <div className={styles.templatesGrid}>
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className={styles.templateCard}
            onClick={() => handleTemplateClick(template)}
            onMouseEnter={() => setHoveredMusicId(template.id)}
            onMouseLeave={() => setHoveredMusicId(null)}
          >
            {/* <div className="templateThumbnail">
              <img src={template.thumbnail} alt={template.name} />
            </div> */}
            {musicId === template.id && (
              <div className={styles.selectIcon}>
                <Image width={36} src={selectIcon} alt="选择" preview={false} />
              </div>
            )}

            {hoveredMusicId === template.id && (
              <div className={styles.iconContainer}>
                <div className={styles.deleteIcon}>
                  <img src={transferIcon} alt="删除" />
                </div>
              </div>
            )}
            <div className={styles.musicTime}>
              {musicDurations[template.id]
                ? formatTime(musicDurations[template.id].remaining)
                : '0m 0s'}
            </div>
            <div className={styles.templateInfo}>
              <h3 className={styles.templateTitle}>
                <div
                  className={styles.tonePlayButton}
                  onClick={(e) => handlePlayClick(e, template)}
                  style={{ cursor: 'pointer' }}
                >
                  {(() => {
                    if (loadingMusicId === template.id) {
                      // 加载中图标
                      return (
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <circle
                            width="32"
                            height="32"
                            cx="8"
                            cy="8"
                            r="7"
                            fill="rgba(99, 112, 107, 1)"
                          />
                          <circle
                            cx="8"
                            cy="8"
                            r="4"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray="12.566"
                            strokeDashoffset="6.283"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0 8 8"
                              to="360 8 8"
                              dur="1s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        </svg>
                      );
                    }
                    if (playingMusicId === template.id && isPlaying) {
                      // 暂停图标
                      return (
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <circle
                            width="32"
                            height="32"
                            cx="8"
                            cy="8"
                            r="7"
                            fill="rgba(99, 112, 107, 1)"
                          />
                          <rect x="5" y="5" width="2" height="6" fill="#fff" />
                          <rect x="9" y="5" width="2" height="6" fill="#fff" />
                        </svg>
                      );
                    }
                    // 播放图标
                    return (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          width="32"
                          height="32"
                          cx="8"
                          cy="8"
                          r="7"
                          fill="rgba(99, 112, 107, 1)"
                        />
                        <path d="M6 5L11 8L6 11V5Z" fill="#fff" />
                      </svg>
                    );
                  })()}
                </div>
                {template.author}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Music;
