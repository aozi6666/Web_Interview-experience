import { useWallpaperInfoStyles } from './styles';

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

interface WallpaperInfoProps {
  wallpaper: WallpaperItem;
}

function WallpaperInfo({ wallpaper }: WallpaperInfoProps) {
  const { styles } = useWallpaperInfoStyles();

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>壁纸信息</h3>
      <div className={styles.content}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>标题：</span>
          <span className={styles.infoValue}>{wallpaper.title}</span>
        </div>

        {wallpaper.description && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>描述：</span>
            <span className={styles.infoValue}>
              {wallpaper.description}
            </span>
          </div>
        )}

        {wallpaper.author && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>作者：</span>
            <span className={styles.infoValue}>{wallpaper.author}</span>
          </div>
        )}

        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>创建时间：</span>
          <span className={styles.infoValue}>{wallpaper.createdAt}</span>
        </div>

        {wallpaper.tags && wallpaper.tags.length > 0 && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>标签：</span>
            <div className={styles.infoTags}>
              {wallpaper.tags.map((tag) => (
                <span key={tag} className={styles.tagItem}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WallpaperInfo;
export type { WallpaperInfoProps, WallpaperItem };
