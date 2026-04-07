import { EllipsisOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useWallPaperCardStyles } from './styles';

interface WallpaperItem {
  id: string;
  title: string;
  thumbnail: string;
  preview: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  author?: string;
  isUsing?: boolean;
  agent_prompt_id?: string;
}

interface WallPaperCardProps {
  wallpaper: WallpaperItem;
  onClick: (wallpaper: WallpaperItem) => void;
  onDelete: (wallpaper: WallpaperItem) => void;
}

// WallPaperCard 组件 - 确保hooks顺序稳定
function WallPaperCard({
  wallpaper,
  onClick,
  onDelete = () => {},
}: WallPaperCardProps) {
  const { styles } = useWallPaperCardStyles(); // 1. 样式hook
  const [imageLoaded, setImageLoaded] = useState(false); // 2. 图片加载状态
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 3. 菜单打开状态
  const [isCardHovered, setIsCardHovered] = useState(false); // 4. 卡片hover状态
  const menuRef = useRef<HTMLDivElement>(null); // 5. 菜单引用

  const handleClick = () => {
    // 埋点：记录用户和时间
    analytics.track(AnalyticsEvent.WALLPAPER_CLICK,
      {},
    ).catch(() => {});
    onClick(wallpaper);
  };

  const handleMenuClick = (e: any) => {
    e.stopPropagation();
    // 埋点：记录用户和时间
    analytics.track(AnalyticsEvent.WALLPAPER_MENU_CLICK,
      {},
    ).catch(() => {});
    setIsMenuOpen(!isMenuOpen);
  };

  const handleDelete = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onDelete(wallpaper);
  };

  const handleCardMouseEnter = () => {
    setIsCardHovered(true);
  };

  const handleCardMouseLeave = () => {
    setIsCardHovered(false);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div
      className={styles.card}
      onClick={handleClick}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* 背景图片 */}
      <div className={styles.imageContainer}>
        <img
          alt={wallpaper.title}
          src={wallpaper.thumbnail}
          className={imageLoaded ? styles.imageLoaded : styles.image}
          onLoad={() => setImageLoaded(true)}
        />

        {/* 加载占位符 */}
        {!imageLoaded && <div className={styles.loading}>加载中...</div>}

        {/* 渐变遮罩 */}
        <div className={styles.overlay} />
      </div>

      {/* 状态指示器 - 对勾图标 */}
      {wallpaper.isUsing && <div className={styles.statusIndicator}>✓</div>}

      {/* 右上角操作菜单 */}
      <div className={styles.menuContainer} ref={menuRef}>
        <div
          className={`${styles.menuButton} ${isCardHovered ? styles.menuButtonVisible : ''}`}
          onClick={handleMenuClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleMenuClick(e);
            }
          }}
        >
          <EllipsisOutlined style={{ fontSize: '20px' }} />
        </div>

        {/* 菜单弹出层 */}
        {isMenuOpen && (
          <div className={styles.menuDropdown}>
            <div
              className={styles.menuItemDelete}
              onClick={handleDelete}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleDelete(e);
                }
              }}
            >
              删除
            </div>
          </div>
        )}
      </div>

      {/* 底部内容 */}
      <div className={styles.content}>
        {/* 标题 */}
        <div className={styles.title}>{wallpaper.title}</div>

        {/* 作者 */}
        {/* {wallpaper.author && (
          <div className={styles.author}>
            {wallpaper.author}
          </div>
        )} */}
      </div>
    </div>
  );
}

export default WallPaperCard;
export type { WallpaperItem };
