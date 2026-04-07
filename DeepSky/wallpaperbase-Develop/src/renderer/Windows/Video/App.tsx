import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect, useRef, useState } from 'react';
import { GlobalStyle, useStyles } from './styles';

const ipcEvents = getIpcEvents();

function App() {
  const { styles } = useStyles();
  const [filePath, setFilePath] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = 'videoWallpaper';

    const handleFilePath = (path: string) => {
      if (!path || !path.trim()) {
        setFilePath('');
        return;
      }

      const normalizedPath = path.startsWith('file://')
        ? path
        : `file://${path}`;
      setFilePath(normalizedPath);
    };

    const handlePauseVideo = () => {
      videoRef.current?.pause();
    };

    const handlePlayVideo = () => {
      const video = videoRef.current;
      if (!video || !video.paused || !video.src) {
        return;
      }

      const tryPlay = () => {
        video.play().catch((error) => {
          console.error('播放视频失败:', error);
          return undefined;
        });
      };

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        tryPlay();
        return;
      }

      video.addEventListener('canplay', tryPlay, { once: true });
    };

    const unsubscribeFilePath = ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.GET_FILE_PATH,
      handleFilePath,
    );
    const unsubscribePauseVideo = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.PAUSE_VIDEO,
      handlePauseVideo,
    );
    const unsubscribePlayVideo = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.PLAY_VIDEO,
      handlePlayVideo,
    );

    return () => {
      unsubscribeFilePath();
      unsubscribePauseVideo();
      unsubscribePlayVideo();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = 0;

    if (!filePath) {
      video.src = '';
      video.load();
      return;
    }

    video.src = filePath;
    video.load();
  }, [filePath]);

  return (
    <>
      <GlobalStyle />
      <div className={styles.container}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          loop
          playsInline
        >
          您的浏览器不支持视频播放。
        </video>
      </div>
    </>
  );
}

export default App;
