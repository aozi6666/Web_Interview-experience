import { WallpaperListItem } from '@api/types/wallpaper';
import { useGridColumns } from '@hooks/useGridColumns';
import { previewActions } from '@stores/PreviewStore';
import {
  BUSY_DOWNLOAD_STATUSES,
  wallpaperDownloadStore,
} from '@stores/WallpaperDownload';
import { Spin } from 'antd';
import { useCallback, useRef } from 'react';
import { useSnapshot } from 'valtio';
import WallpaperCard from '../WallPaperCard';
import { useStyles } from './styles';

interface WallpaperGridProps {
  wallpapers: WallpaperListItem[];
  localStatusMap: Record<string, boolean>;
  loading?: boolean;
  gridCalcFn?: (width: number) => number;
  minItemWidth?: string;

  selectedId?: string;
  appliedId?: string;
  applyText?: string;
  resetText?: string;
  variant?: 'default' | 'store';
  onApply: (item: WallpaperListItem) => void;
  onReset?: (item: WallpaperListItem) => void;
  onSelect?: (item: WallpaperListItem) => void;
  onPreview?: (item: WallpaperListItem) => void;
  onDelete?: (item: WallpaperListItem) => void;
}

const defaultCalcFn = (width: number) => {
  const maxCardWidth = 275;
  const minColumns = 2;
  if (width >= maxCardWidth) {
    return Math.max(minColumns, Math.floor(width / maxCardWidth) + 1);
  }
  return minColumns;
};

function WallpaperGrid({
  wallpapers,
  localStatusMap,
  loading = false,
  gridCalcFn,
  minItemWidth = '180px',
  selectedId,
  appliedId,
  applyText,
  resetText,
  variant = 'default',
  onApply,
  onReset,
  onSelect,
  onPreview,
  onDelete,
}: WallpaperGridProps) {
  const { styles } = useStyles();
  const gridRef = useRef<HTMLDivElement>(null);
  const downloadSnapshot = useSnapshot(wallpaperDownloadStore);
  const calcFn = useCallback(
    (w: number) => (gridCalcFn ?? defaultCalcFn)(w),
    [gridCalcFn],
  );
  const gridColumns = useGridColumns(gridRef, calcFn);

  return (
    <Spin spinning={loading} size="large">
      <div
        ref={gridRef}
        className={styles.gridContainer}
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(${minItemWidth}, 1fr))`,
        }}
      >
        {wallpapers.map((item) => {
          return (
            <WallpaperCard
              key={item.levelId}
              item={item}
              isActive={selectedId === item.levelId}
              isLocalReady={Boolean(localStatusMap[item.levelId])}
              isUsing={appliedId === item.levelId}
              isProcessing={BUSY_DOWNLOAD_STATUSES.has(
                downloadSnapshot.downloads[item.levelId]?.status ?? 'idle',
              )}
              download={downloadSnapshot.downloads[item.levelId]}
              onClick={onSelect ? () => onSelect(item) : () => onApply(item)}
              onApply={() => onApply(item)}
              onReset={() => (onReset ? onReset(item) : onApply(item))}
              applyText={applyText}
              resetText={resetText}
              variant={variant}
              onPreview={() =>
                onPreview
                  ? onPreview(item)
                  : previewActions.showPreview(
                      item.preview_url || '',
                      item.name || item.description || item.levelId,
                      '图片加载失败',
                    )
              }
              onDelete={onDelete ? () => onDelete(item) : undefined}
            />
          );
        })}
      </div>
    </Spin>
  );
}

export default WallpaperGrid;
