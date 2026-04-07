import closeIcon from '$assets/images/uploadPhoto/icon-close_state_nor.png';
import { useStyles } from './styles';

interface AssetPreviewProps {
  imageUrl: string;
  onClose: () => void;
  variant?: 'scene' | 'character';
}

function AssetPreview({
  imageUrl,
  onClose,
  variant = 'scene',
}: AssetPreviewProps) {
  const { styles } = useStyles();
  const containerClassName =
    variant === 'character'
      ? `${styles.container} ${styles.containerCharacter}`
      : `${styles.container} ${styles.containerScene}`;
  const imageWrapClassName =
    variant === 'character'
      ? `${styles.imageWrap} ${styles.imageWrapCharacter}`
      : `${styles.imageWrap} ${styles.imageWrapScene}`;

  return (
    <div className={containerClassName}>
      <div className={styles.label}>预览</div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label="关闭预览"
      >
        <img src={closeIcon} alt="close" className={styles.closeIcon} />
      </button>
      <div className={imageWrapClassName}>
        {imageUrl ? (
          <img src={imageUrl} alt="preview" className={styles.image} />
        ) : (
          <div className={styles.empty}>暂无预览图</div>
        )}
      </div>
    </div>
  );
}

export default AssetPreview;
