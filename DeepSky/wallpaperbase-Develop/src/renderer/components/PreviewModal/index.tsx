import { CloseOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { previewActions, previewStore } from '../../stores/PreviewStore';
import { useStyles } from './styles';

function PreviewModal() {
  const { styles } = useStyles();
  const { isVisible, imageUrl, title, placeholder } = useSnapshot(previewStore);
  const [modalSize, setModalSize] = useState({ width: 800, height: 500 });

  const handleClose = () => {
    previewActions.hidePreview();
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;

    // 获取图片原始尺寸

    // 计算适合的Modal尺寸
    const maxWidth = window.innerWidth * 0.9; // 最大宽度为屏幕的90%
    const maxHeight = window.innerHeight * 0.8; // 最大高度为屏幕的80%

    let modalWidth = naturalWidth;
    let modalHeight = naturalHeight;

    // 如果图片太大，按比例缩放
    if (naturalWidth > maxWidth || naturalHeight > maxHeight) {
      const widthRatio = maxWidth / naturalWidth;
      const heightRatio = maxHeight / naturalHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      modalWidth = naturalWidth * ratio;
      modalHeight = naturalHeight * ratio;
    }

    // 确保最小尺寸
    modalWidth = Math.max(modalWidth, 400);
    modalHeight = Math.max(modalHeight, 300);

    setModalSize({ width: modalWidth, height: modalHeight });
  };

  // 当Modal关闭时重置尺寸
  useEffect(() => {
    if (!isVisible) {
      setModalSize({ width: 800, height: 500 });
    }
  }, [isVisible]);

  return (
    <Modal
      open={isVisible}
      title="预览"
      onCancel={handleClose}
      footer={null}
      width={modalSize.width}
      className={styles.previewModal}
      closeIcon={<CloseOutlined className={styles.closeIcon} />}
      maskClosable
    >
      <div
        className={styles.previewContainer}
        style={{ height: modalSize.height }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title || '预览图片'}
            className={styles.previewImage}
            onLoad={handleImageLoad}
            onError={(e) => {
              // 图片加载失败时显示占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const placeholderElement =
                target.nextElementSibling as HTMLElement;
              if (placeholderElement) {
                placeholderElement.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className={styles.placeholderContainer}
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          <div className={styles.placeholderText}>{placeholder}</div>
        </div>
      </div>
    </Modal>
  );
}

export default PreviewModal;
