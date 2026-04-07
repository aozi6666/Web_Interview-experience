import volumeMuteIcon from '$assets/tray/chat-sound-ban-dark.png';
import volumeIcon from '$assets/tray/chat-sound-dark.png';
import WallpaperModeSwitcher from '@renderer/components/WallpaperModeSwitcher';
import { Tooltip } from 'antd';
import { useHeaderStyles } from './styles';

interface ChatHeaderProps {
  characterName: string;
  wallpaperName: string;
  onClearChat: () => void;
  showResetButton?: boolean;
  isChatAudioMuted?: boolean;
  onToggleChatAudioMute?: () => void;
}

export default function ChatHeader({
  characterName,
  wallpaperName,
  onClearChat,
  showResetButton = true,
  isChatAudioMuted = false,
  onToggleChatAudioMute,
}: ChatHeaderProps) {
  const { styles } = useHeaderStyles();

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.characterName}>{characterName}</div>
        <div className={styles.wallpaperName}>{wallpaperName}</div>
      </div>
      <div className={styles.headerRight}>
        <WallpaperModeSwitcher />
        <Tooltip
          title={isChatAudioMuted ? '取消对话静音' : '对话静音'}
          color="#5b625f"
          styles={{
            container: {
              color: '#eceeed',
              borderRadius: '8px',
              padding: '4px 8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            },
          }}
        >
          <button
            type="button"
            className={styles.headerButtonMute}
            onClick={onToggleChatAudioMute}
            aria-label={isChatAudioMuted ? '取消对话静音' : '对话静音'}
          >
            <img
              src={isChatAudioMuted ? volumeMuteIcon : volumeIcon}
              alt=""
              className={styles.iconImg}
            />
          </button>
        </Tooltip>
        {showResetButton && (
          <button
            type="button"
            className={styles.headerButton}
            onClick={onClearChat}
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}
