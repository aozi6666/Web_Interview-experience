import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Progress } from 'antd';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useMemo } from 'react';
import { useStyles } from './styles';

const hiddenStyle: CSSProperties = {
  opacity: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
};

const visibleStyle: CSSProperties = {
  opacity: 1,
  visibility: 'visible',
  pointerEvents: 'auto',
};

const overlayHiddenStyle: CSSProperties = {
  opacity: 0,
  visibility: 'hidden',
};

const overlayVisibleStyle: CSSProperties = {
  opacity: 1,
  visibility: 'visible',
};

interface CardOverlayContentProps {
  isBusy: boolean;
  isDownloading: boolean;
  isHovered: boolean;
  progress: number;
  onPreview?: () => void;
  onDelete?: () => void;
  onApply: () => void;
  onReset: () => void;
  applyText: string;
  resetText: string;
  isUsing: boolean;
  isLocalReady: boolean;
  isBusyDisabled: boolean;
  isResetDisabled: boolean;
  variant?: 'default' | 'store';
}

function CardOverlayContent({
  isBusy,
  isDownloading,
  isHovered,
  progress,
  onPreview,
  onDelete,
  onApply,
  onReset,
  applyText,
  resetText,
  isUsing,
  isLocalReady,
  isBusyDisabled,
  isResetDisabled,
  variant = 'default',
}: CardOverlayContentProps) {
  const { styles } = useStyles();
  const isStoreVariant = variant === 'store';

  const buttonText = useMemo(() => {
    if (isBusy && isDownloading) {
      return `下载中 ${progress}%`;
    }
    if (isBusy) return '处理中';
    if (isUsing) return '正在使用';
    if (isStoreVariant && !isLocalReady) return '下载使用';
    return applyText;
  }, [
    applyText,
    isBusy,
    isDownloading,
    isLocalReady,
    isStoreVariant,
    isUsing,
    progress,
  ]);

  const stopPropagation = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };
  const isApplyDisabled = isBusyDisabled || isUsing;

  if (isBusy) {
    return (
      <div
        className={`${styles.progressOverlay} wallpaper-card-progress-overlay`}
        style={overlayVisibleStyle}
      >
        <div
          className={`${styles.progressCircle} wallpaper-card-progress-circle`}
        >
          <ConfigProvider
            theme={{
              components: {
                Progress: {
                  circleTextColor: '#fff',
                  lineHeight: 0,
                },
              },
            }}
          >
            <Progress
              type="circle"
              percent={progress}
              size={100}
              strokeColor="#19c8c8"
              trailColor="rgba(255, 255, 255, 0.35)"
              format={() => `${progress}%`}
              classNames={{
                body: styles.progressBody,
                indicator: styles.progressIndicator,
              }}
            />
          </ConfigProvider>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`${styles.gradientOverlay} wallpaper-card-gradient-overlay`}
        style={isHovered ? overlayVisibleStyle : overlayHiddenStyle}
      />

      {!isStoreVariant && (onPreview || onDelete) ? (
        <div
          className={`${styles.topRightActions} wallpaper-card-top-right-actions`}
          style={isHovered ? visibleStyle : hiddenStyle}
        >
          {onPreview ? (
            <button
              type="button"
              className={`${styles.iconButton} wallpaper-card-icon-button`}
              onClick={(event) => {
                stopPropagation(event);
                onPreview();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  stopPropagation(event);
                  onPreview();
                }
              }}
              aria-label="预览壁纸"
            >
              <EyeOutlined />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className={`${styles.iconButton} wallpaper-card-icon-button`}
              onClick={(event) => {
                stopPropagation(event);
                onDelete();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  stopPropagation(event);
                  onDelete();
                }
              }}
              aria-label="删除壁纸"
            >
              <DeleteOutlined />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`${styles.actionRow} wallpaper-card-action-row`}
        style={isHovered ? visibleStyle : hiddenStyle}
      >
        <Button
          type="default"
          className={`${styles.actionButton} wallpaper-card-action-button`}
          onClick={(event) => {
            stopPropagation(event);
            if (isApplyDisabled) {
              return;
            }
            onApply();
          }}
          disabled={isApplyDisabled}
          loading={isBusyDisabled}
        >
          {buttonText}
        </Button>
        {!isStoreVariant ? (
          <Button
            type="default"
            className={`${styles.actionButton} wallpaper-card-action-button`}
            onClick={(event) => {
              stopPropagation(event);
              onReset();
            }}
            disabled={isResetDisabled}
          >
            {resetText}
          </Button>
        ) : null}
      </div>
    </>
  );
}

export default CardOverlayContent;
