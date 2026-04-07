import ModifyCharacter from '@components/ModifyCharacter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommonLayout from '../../components/CommonLayout';
import DetailChatPanel from '../../components/DetailChatPanel';
import WallpaperDetailSlidePanel from '../../components/WallpaperDetailSlidePanel';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { loadWallpaperConfig } from '@renderer/api/wallpaperConfig';
import { previewActions } from '../../stores/PreviewStore';
import CharacterSection from './CharacterSection/index';
import { useStyles } from './styles';
import WallpaperSection, {
  WallpaperSectionRef,
} from './WallpaperSection/index';

const isCompactViewport = (): boolean => {
  const innerWidth = window.innerWidth || Number.MAX_SAFE_INTEGER;
  const clientWidth =
    document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
  return Math.min(innerWidth, clientWidth) <= 975;
};

function MyAssets() {
  const { styles } = useStyles();
  const wallpaperSectionRef = useRef<WallpaperSectionRef>(null);

  const [selectedDataType] = useState('wallpaper');
  const [selectedWallpaper, setSelectedWallpaper] =
    useState<WallpaperItem | null>(null);
  const [appliedWallpaperId, setAppliedWallpaperId] = useState<string | null>(
    null,
  );
  const [detailSlideOpen, setDetailSlideOpen] = useState(false);
  const closeDetailSlide = useCallback(() => setDetailSlideOpen(false), []);
  const [modifyCharacterVisible, setModifyCharacterVisible] = useState(false);
  const [globalCharacters, setGlobalCharacters] = useState<any[]>([]);
  const [filteredCharacters, setFilteredCharacters] = useState<any[]>([]);

  const handleWallpaperSelect = useCallback(
    (
      wallpaper: WallpaperItem | null,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 与列表 onSelect 签名一致
      levelId: string,
    ) => {
      setSelectedWallpaper(wallpaper);
      console.log('---------------handleWallpaperSelect', wallpaper);
    },
    [],
  );

  const handleAppliedChange = useCallback((levelId: string) => {
    setAppliedWallpaperId(levelId);
  }, []);

  const handleSaveWallpaper = useCallback(async (wallpaper?: WallpaperItem) => {
    await wallpaperSectionRef.current?.handleSave(wallpaper);
  }, []);

  const applyWallpaper = useCallback(async (wallpaper?: WallpaperItem) => {
    const levelId = wallpaper?.id;
    if (!levelId) {
      return;
    }
    await wallpaperSectionRef.current?.applyByLevelId(levelId);
  }, []);

  const handleOpenModifyCharacter = useCallback(() => {
    setGlobalCharacters(filteredCharacters);
    setModifyCharacterVisible(true);
  }, [filteredCharacters]);

  const handleCloseModifyCharacter = useCallback(() => {
    setModifyCharacterVisible(false);
  }, []);

  const handleSelectCharacterInModal = useCallback((character: any) => {
    console.log('在修改角色模态框中选择了角色:', character.name);
  }, []);

  const handleCardBtnClickInModal = useCallback((character: any) => {
    console.log('在修改角色模态框中点击了装扮按钮:', character.name);
  }, []);

  const handlePreviewInModal = useCallback((item: any) => {
    previewActions.showPreview(
      item.preview || item.avatar,
      item.title || item.name,
      '图片加载失败',
    );
  }, []);

  const handleFilteredCharactersChange = useCallback((chars: any[]) => {
    setFilteredCharacters(chars);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (!isCompactViewport()) {
        setDetailSlideOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const syncAppliedWallpaperFromConfig = async () => {
      const result = await loadWallpaperConfig();
      if (result.success && result.config?.levelId) {
        setAppliedWallpaperId(result.config.levelId);
      }
    };

    syncAppliedWallpaperFromConfig().catch(() => {});
  }, []);

  const effectiveSelectedWallpaper = useMemo(() => {
    if (!selectedWallpaper) return null;
    return {
      ...selectedWallpaper,
      isUsing: selectedWallpaper.id === appliedWallpaperId,
    };
  }, [selectedWallpaper, appliedWallpaperId]);

  return (
    <>
      <CommonLayout
        showRightPanel
        onRightPanelDragStart={closeDetailSlide}
        rightPanel={
          <DetailChatPanel
            wallpaper={effectiveSelectedWallpaper}
            onSave={handleSaveWallpaper}
            onModifyCharacter={handleOpenModifyCharacter}
            applyLocalWallpaper={applyWallpaper}
            showResetButton={false}
            defaultChatHeight={228}
            minChatHeight={228}
            maxChatHeight={560}
            onSplitDragStart={closeDetailSlide}
          />
        }
        rightPanelWidth={400}
        rightPanelMinHeight={228}
        rightPanelMaxHeight={560}
      >
        <div className={styles.slideHost}>
          <div className={styles.slideHostScroll}>
            <div className={styles.wallpaperGrid}>
              {selectedDataType === 'wallpaper' && (
                <WallpaperSection
                  ref={wallpaperSectionRef}
                  appliedWallpaperId={appliedWallpaperId}
                  onWallpaperSelect={handleWallpaperSelect}
                  onAppliedChange={handleAppliedChange}
                  onOpenDetailSlide={() => {
                    if (isCompactViewport()) {
                      setDetailSlideOpen(true);
                    }
                  }}
                />
              )}
              {selectedDataType === 'character' && (
                <CharacterSection
                  onFilteredCharactersChange={handleFilteredCharactersChange}
                />
              )}
            </div>
          </div>
          <WallpaperDetailSlidePanel
            open={detailSlideOpen}
            onClose={closeDetailSlide}
            wallpaper={effectiveSelectedWallpaper}
            onSave={handleSaveWallpaper}
            applyLocalWallpaper={applyWallpaper}
            onModifyCharacter={handleOpenModifyCharacter}
          />
        </div>
      </CommonLayout>

      <ModifyCharacter
        visible={modifyCharacterVisible}
        characters={globalCharacters}
        onClose={handleCloseModifyCharacter}
        onSelectCharacter={handleSelectCharacterInModal}
        onPreviewCharacter={handlePreviewInModal}
        onCardBtnClick={handleCardBtnClickInModal}
      />
    </>
  );
}

export default MyAssets;
