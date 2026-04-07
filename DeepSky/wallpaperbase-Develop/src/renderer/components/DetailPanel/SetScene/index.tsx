import React, { useEffect, useState } from 'react';
import { useStyles } from './styles';
import refreshIcon from '$assets/images/uploadPhoto/refresh-ccw-01.png';
import { videoItem } from '@renderer/pages/myAssets/types';
import previewIcon from '$assets/images/uploadPhoto/eye.png';
import AssetPreview from '../AssetPreview';

interface SetSceneProps {
  sceneList: videoItem[];
  currentSelectedSceneId: string | null;
  defaultSceneId: string | null;
  force:boolean;
  // downloading:boolean;
  onSceneSelect?: (sceneId: string | null) => void;
}

function SetScene({
  sceneList,
  currentSelectedSceneId,
  defaultSceneId,
  force,
  onSceneSelect,
}: SetSceneProps) {
  const { styles } = useStyles();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [isScenePreviewOpen, setIsScenePreviewOpen] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    console.log('force', force,currentSelectedSceneId,defaultSceneId);
    if (currentSelectedSceneId && force) {
      setSelectedSceneId(currentSelectedSceneId);
      return;
    }
    // setSelectedSceneId(defaultSceneId);
  }, [currentSelectedSceneId, defaultSceneId]);

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    onSceneSelect?.(sceneId);
  };

  const handleResetScene = () => {
    setSelectedSceneId(defaultSceneId);
    onSceneSelect?.(defaultSceneId);
  };

  const handleOpenPreview = (imageUrl?: string) => {
    setPreviewImageUrl(imageUrl || '');
    setIsScenePreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsScenePreviewOpen(false);
    setPreviewImageUrl('');
  };
    
  return (
    <div className={styles.container}>
      <div className={styles.title}>修改场景</div>
      <div className={styles.sceneContent}>
        <div className={styles.sceneGrid}>
          {(sceneList || []).map((item) => (
            <div
              key={item.id}
              className={`${styles.sceneItem} ${selectedSceneId === String(item.id) ? styles.sceneItemSelected : styles.sceneItemNoneSelected}`}
              role="button"
              tabIndex={0}
            >
              <img
                src={item.metadata?.imgUrls?.[0]?.url || ''}
                className={styles.sceneThumb}
              />
              <button
                type="button"
                className={styles.scenePreviewButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPreview(item.metadata?.imgUrls?.[0]?.url);
                }}
              >
                <img
                  src={previewIcon}
                  alt="preview"
                  style={{ width: 24, height: 24 }}
                />
              </button>
              <button
                type="button"
                className={styles.sceneSetButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectScene(String(item.id));
                }}
              >
                设为场景
              </button>
              {(item.progress > 0 && item.progress < 100) && (<div className={styles.bg}>
                <div className={styles.loadingText}>更新中。。。。</div>
                <div className={styles.loadingBox}>
                  <div className={styles.loadingInner} style={{width: `${item.progress}%`}}></div>
                </div>
              </div>)}
              
              {/* <div className={styles.sceneName}>{item.description}</div> */}
            </div>
          ))}
        </div>
      </div>
      <button type="button" className={styles.bottomButton} onClick={handleResetScene}>
        <img src={refreshIcon} alt="refresh" className={styles.bottomButtonIcon} />
        <span className={styles.bottomButtonText}>重置</span>
      </button>
      {isScenePreviewOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
          onClick={handleClosePreview}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AssetPreview
              imageUrl={previewImageUrl}
              onClose={handleClosePreview}
              variant="scene"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SetScene;
