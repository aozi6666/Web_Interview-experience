import React, { useState, useEffect, useRef } from 'react';
import './FloatingBall.css';

// 导入图标图片
import mainIcon from '$assets/icons/WallPaperInput/open-main.png';
import chatIcon from '$assets/icons/WallPaperInput/open-input.png';
import modeIcon from '$assets/icons/WallPaperInput/change-inputtype.png';
import wallpaperIcon from '$assets/icons/WallPaperInput/change-wallpaper.png';
import openMicIcon from '$assets/icons/WallPaperInput/open-mic.png';
import closeMicIcon from '$assets/icons/WallPaperInput/close-mic.png';
import closeMemu from '$assets/icons/WallPaperInput/close.png';

type ChatMode = 'voice' | 'text';

interface FloatingBallProps {
  chatMode: ChatMode;
  isMicEnabled: boolean;
  onToggleMic: () => void;
  onToggleChatMode: () => void;
  onOpenChat: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onSwitchWallpaper: () => void;
}

const FloatingBall: React.FC<FloatingBallProps> = ({
  chatMode,
  isMicEnabled,
  onToggleMic,
  onToggleChatMode,
  onOpenChat,
  onOpenMenu,
  onCloseMenu,
  onSwitchWallpaper,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const ballRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭快捷方式菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ballRef.current &&
        !ballRef.current.contains(event.target as Node) &&
        shortcutsRef.current &&
        !shortcutsRef.current.contains(event.target as Node)
      ) {
        setShowShortcuts(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleBallClick = () => {
    setShowShortcuts(!showShortcuts);
  };

  const handleShortcutClick = (action: string) => {
    setShowShortcuts(false);
    switch (action) {
      case 'menu':
        onOpenMenu();
        break;
      case 'chat':
        onOpenChat();
        break;
      case 'mode':
        onToggleChatMode();
        break;
      case 'mic':
        onToggleMic();
        break;
      case 'wallpaper':
        onSwitchWallpaper();
        break;
      case 'closeMemu':
        onCloseMenu();
        break;
      default:
        break;
    }
  };

  const getShortcutsForMode = () => {
    const commonShortcuts = [
      {
        key: 'menu',
        label: '菜单界面',
        icon: mainIcon,
      },
      {
        key: 'chat',
        label: '打开聊天窗口',
        icon: chatIcon,
      },
      {
        key: 'mode',
        label: '切换聊天模式',
        icon: modeIcon,
      },
      {
        key: 'wallpaper',
        label: '切换壁纸',
        icon: wallpaperIcon,
      },
      {
        key: 'closeMemu',
        label: '关闭',
        icon: closeMemu,
      },
    ];

    if (chatMode === 'voice') {
      return [
        ...commonShortcuts.slice(0, 3),
        {
          key: 'mic',
          label: isMicEnabled ? '关闭麦克风' : '开启麦克风',
          icon: isMicEnabled ? closeMicIcon : openMicIcon,
        },
        commonShortcuts[3],
        commonShortcuts[4], // 关闭按钮
      ];
    }

    return commonShortcuts;
  };

  return (
    <div className="floating-container">
      {/* 悬浮球 */}
      <div
        ref={ballRef}
        className={`floating-ball ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleBallClick}
      >
        {/* 文字聊天模式的提示 */}
        {chatMode === 'text' && isHovered && (
          <div className="floating-ball-tooltip">按下 Alt+X 对话</div>
        )}

        {/* 悬浮球图片 */}
        <div className="floating-ball-image" />
      </div>

      {/* 快捷方式菜单 */}
      {showShortcuts && (
        <div ref={shortcutsRef} className="floating-shortcuts">
          {getShortcutsForMode().map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              className="floating-shortcut-item"
              onClick={() => handleShortcutClick(shortcut.key)}
            >
              <img src={shortcut.icon} alt="" className="shortcut-icon" />
              <span className="shortcut-label">{shortcut.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FloatingBall;
