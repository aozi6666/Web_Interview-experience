import { LeftOutlined } from '@ant-design/icons';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import DetailPanel from '../DetailPanel';
import { useStyles } from './styles';

export interface WallpaperDetailSlidePanelProps {
  open: boolean;
  onClose: () => void;
  wallpaper: WallpaperItem | null;
  onSave?: (wallpaper: WallpaperItem) => void;
  applyLocalWallpaper?: (wallpaper: WallpaperItem) => void;
  onModifyCharacter?: () => void;
  /** 当前壁纸是否已下载到本地 */
  isLocalReady?: boolean;
  /** 是否正在处理中（下载/应用） */
  isProcessing?: boolean;
  /** 点击"下载壁纸"按钮 */
  onDownload?: () => void;
  /** 点击"设为壁纸"按钮（覆盖 DetailPanel 默认应用逻辑） */
  onApply?: () => void;
}

function WallpaperDetailSlidePanel({
  open,
  onClose,
  wallpaper,
  onSave,
  applyLocalWallpaper,
  onModifyCharacter,
  isLocalReady = false,
  isProcessing = false,
  onDownload,
  onApply,
}: WallpaperDetailSlidePanelProps) {
  const { styles } = useStyles();

  return (
    <div
      className={`${styles.root} ${open ? styles.rootOpen : ''}`}
      aria-hidden={!open}
    >
      <div
        className={`${styles.panel} ${open ? styles.panelVisible : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="壁纸详情"
      >
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>
            <LeftOutlined style={{ fontSize: 12 }} />
            退出详情
          </button>
        </div>
        <div className={styles.body}>
          {wallpaper ? (
            <DetailPanel
              wallpaper={wallpaper}
              onSave={onSave}
              applyLocalWallpaper={onApply || applyLocalWallpaper}
              onModifyCharacter={onModifyCharacter}
              isLocalReady={isLocalReady}
              isProcessing={isProcessing}
              onDownload={onDownload}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

WallpaperDetailSlidePanel.defaultProps = {
  onSave: undefined,
  applyLocalWallpaper: undefined,
  onModifyCharacter: undefined,
  isLocalReady: false,
  isProcessing: false,
  onDownload: undefined,
  onApply: undefined,
};

export default WallpaperDetailSlidePanel;
