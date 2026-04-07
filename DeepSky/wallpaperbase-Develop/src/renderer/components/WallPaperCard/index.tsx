import { WallpaperListItem } from '@api/types/wallpaper';
import { useMemo, useState } from 'react';
import checkIcon from '../../../../assets/icons/WallPaper/check.svg';
import CardOverlayContent from './CardOverlayContent';
import { useStyles } from './styles';

type DownloadState = {
  status?: string;
  paksProgress?: number;
  groupId?: string;
};

interface WallpaperCardProps {
  item: WallpaperListItem;
  isActive?: boolean;
  isLocalReady?: boolean;
  isProcessing?: boolean;
  isUsing?: boolean;
  download?: DownloadState;
  onApply: () => void;
  onReset?: () => void;
  onClick?: () => void;
  onPreview?: () => void;
  onDelete?: () => void;
  applyText?: string;
  resetText?: string;
  variant: 'default' | 'store';
}

function WallpaperCard({
  item,
  isActive = false,
  isLocalReady = false,
  isProcessing = false,
  isUsing = false,
  download,
  onApply,
  onReset,
  onClick,
  onPreview,
  onDelete,
  applyText = '设为壁纸',
  resetText = '重置壁纸',
  variant = 'default',
}: WallpaperCardProps) {
  const { styles } = useStyles();
  const [isHovered, setIsHovered] = useState(false);

  const isDownloading = isProcessing;
  const isBusy = isProcessing;

  const displayProgress = useMemo(() => {
    if (isDownloading) {
      return Math.min(100, Math.max(0, download?.paksProgress ?? 0));
    }
    return 0;
  }, [download?.paksProgress, isDownloading]);

  const cardClassName = [
    styles.wallpaperCard,
    styles.adaptiveWide,
    isActive ? styles.wallpaperCardActive : '',
    isUsing ? styles.wallpaperCardUsing : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleCardClick = () => {
    onClick?.();
  };

  return (
    <div
      className={cardClassName}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleCardClick();
        }
      }}
    >
      {isUsing ? (
        <div className={styles.usingIndicator} aria-hidden>
          <img
            src={checkIcon}
            alt=""
            className={styles.usingIndicatorIcon}
            aria-hidden
          />
        </div>
      ) : null}

      {item.preview_url ? (
        <img
          alt={item.levelId}
          src={item.preview_url}
          className={styles.wallpaperImage}
          onError={(event) => {
            const target = event.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : (
        <div className={styles.imageFallback}>暂无预览图</div>
      )}

      <CardOverlayContent
        isBusy={isBusy}
        isDownloading={isDownloading}
        isHovered={isHovered}
        progress={displayProgress}
        onPreview={onPreview}
        onDelete={onDelete}
        onApply={onApply}
        onReset={onReset ?? onApply}
        applyText={applyText}
        resetText={resetText}
        isUsing={isUsing}
        isLocalReady={isLocalReady}
        isBusyDisabled={isBusy}
        isResetDisabled={isProcessing}
        variant={variant}
      />
      <div className={`${styles.cardContent} wallpaper-card-content`}>
        <div className={`${styles.cardTitle} wallpaper-card-title`}>
          {item.name || item.description || item.levelId}
        </div>
      </div>
    </div>
  );
}

export default WallpaperCard;
