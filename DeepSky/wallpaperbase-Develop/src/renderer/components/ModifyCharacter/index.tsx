import { CloseOutlined } from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { useEffect, useMemo, useState,useCallback} from 'react';
import { useSnapshot } from 'valtio';
import { CharacterItem } from '../../pages/myAssets/types';
import { characterState, setSelectedButton } from '../../stores/CharacterStore';
import SimpleCharacterCard from './SimpleCharacterCard';
import { useStyles } from './styles';
import closeIcon from '$assets/images/uploadPhoto/icon-close_state_nor.png';
import refreshIcon from '$assets/images/uploadPhoto/refresh-ccw-01.png';
import { agentPromptItem } from '../../pages/myAssets/types';
import AssetPreview from '../DetailPanel/AssetPreview';
import {
  getDefaultAppearanceData,
  isDefaultCharacter,
} from '../../utils/appearanceStorage';
import { UESence_AppearEditDynamic } from '@api/IPCRequest/selectUESence';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
const ipcEvents = getIpcEvents();
interface ModifyCharacterProps {
  visible: boolean;
  characters: any[];
  onClose: () => void;
  onSelectCharacter?: (id: string,avatar: string) => void;
  onPreviewCharacter?: (character: string) => void;
  // onCardBtnClick?: (character: string) => void;
  defaultSelectedCharacterId?: string;
  currentSelectedCharacterId?: string;
}

function ModifyCharacter({
  visible,
  characters,
  onClose,
  onSelectCharacter,
  onPreviewCharacter,
  // onCardBtnClick,
  defaultSelectedCharacterId,
  currentSelectedCharacterId,
}: ModifyCharacterProps) {
  const { styles } = useStyles();
  const { selectedCharacterId, selectedButton } = useSnapshot(characterState);
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'female' | 'male'
  >('all');
  const [loading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>(
    defaultSelectedCharacterId || '',
  );
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  useEffect(() => {
    if (!visible) return;
    console.log('currentSelectedCharacterId', currentSelectedCharacterId,defaultSelectedCharacterId);
    const hasId = (id?: string) =>
      Boolean(id) && characters.some((item: CharacterItem) => String(item.metadata.chunk_id) === id);

    if (hasId(currentSelectedCharacterId)) {
      console.log('----------', currentSelectedCharacterId);
      setSelectedCardId(currentSelectedCharacterId!);
      return;
    }
    if (hasId(defaultSelectedCharacterId)) {
      setSelectedCardId(defaultSelectedCharacterId!);
      return;
    }
    setSelectedCardId('');
  }, [
    visible,
    currentSelectedCharacterId,
    defaultSelectedCharacterId,
    characters,
  ]);

  // const filteredCharacters = useMemo(() => {
  //   if (selectedFilter === 'all') {
  //     return characters;
  //   }
  //   return characters.filter(
  //     (char) => char.metadata?.gender === selectedFilter,
  //   );
  // }, [characters, selectedFilter]);

  // // 当筛选条件改变时，检查当前选中的按钮是否还在筛选结果中
  // useEffect(() => {
  //   if (selectedCharacterId && selectedButton) {
  //     const characterExists = filteredCharacters.some(
  //       (char) => char.id === selectedCharacterId,
  //     );
  //     if (!characterExists) {
  //       // 如果当前选中的角色不在新的筛选结果中，重置按钮状态
  //       setSelectedButton(null, null);
  //     }
  //   }
  // }, [filteredCharacters, selectedFilter, selectedCharacterId, selectedButton]);
  const sendCharacterToUE = useCallback((character: CharacterItem) => {
    console.log('sendCharacterToUE', character);

    // 🆕 判断是否为默认角色
    const chunkId = character.metadata.chunk_id;
    let { appearanceData } = character.metadata;

    if (isDefaultCharacter(chunkId)) {
      // 从 localStorage 读取最新的外观数据（不存在时自动使用 DEFAULT_APPEARANCE_DATA）
      appearanceData = getDefaultAppearanceData(chunkId.toString());
    }

    UESence_AppearEditDynamic({
      chunkId: character.metadata.chunk_id,
      gender: character.metadata.gender,
      appearanceData,
      modelId: character.id,
      originalImages: character.metadata.original_images,
    });

    ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.DESKTOP_EMBEDDER_RESTORE_FULLSCREEN,
      'wallpaper-baby',
    );
  }, []);
  const onCardBtnClick = useCallback(
    (character: CharacterItem) => {
      sendCharacterToUE(character);
      // setMakeUpCharacter(character);
    },
    [sendCharacterToUE],
  );
  
  const handleSelectCharacter = (id: string,avatar: string) => {
    setSelectedCardId(id);
    onSelectCharacter?.(id,avatar);
    // onClose();
  };

  const handlePreview = (avatar: string) => {
    setPreviewImageUrl(
      avatar
    );
    // onPreviewCharacter?.(character);
  };
  const handleClosePreview = () => {
    setPreviewImageUrl('');
  };
  const handleResetSelection = () => {
    const nextId =
      defaultSelectedCharacterId &&
      characters.some(
        (item: CharacterItem) => item.id === defaultSelectedCharacterId,
      )
        ? defaultSelectedCharacterId
        : '';
    setSelectedCardId(nextId);
    if (nextId) {
      const target = characters.find(
        (item: CharacterItem) => item.id === nextId,
      );
      if (target) {
        // onSelectCharacter?.(target);
      }
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* 头部 */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>修改角色</div>
          {/* <button
            type="button"
            icon={<CloseOutlined />}
            onClick={onClose}
            className={styles.closeButton}
          /> */}
          <button
              type="button"
              className={styles.overlayClose}
              onClick={onClose}
            >
              <img src={closeIcon} alt="close"  />
            </button>
        </div>

        {/* 筛选选项 */}
        {/* <div className={styles.filterSection}>
          <div className={styles.filterOptions}>
            <div
              className={`${styles.filterItem} ${selectedFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('all')}
            >
              所有角色
            </div>
            <div
              className={`${styles.filterItem} ${selectedFilter === 'female' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('female')}
            >
              女性
            </div>
            <div
              className={`${styles.filterItem} ${selectedFilter === 'male' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('male')}
            >
              男性
            </div>
          </div>
        </div> */}

        {/* 角色列表 */}
        <div className={styles.characterList}>
          <Spin spinning={loading} size="large">
            <div className={styles.characterGrid}>
              {characters.map((character) => (
                <SimpleCharacterCard
                  key={character.id}
                  character={character}
                  onSelect={handleSelectCharacter}
                  onPreview={handlePreview}
                  onCardBtnClick={onCardBtnClick}
                  isSelected={selectedCardId === String(character.metadata.chunk_id)}
                  // onCardSelect={(item) => setSelectedCardId(item.id)}
                />
              ))}
            </div>
          </Spin>
        </div>
        <button
          type="button"
          className={styles.bottomButton}
          onClick={handleResetSelection}
        >
          <img src={refreshIcon} alt="refresh" className={styles.bottomButtonIcon} />
          <span className={styles.bottomButtonText}>重置</span>
        </button>
      </div>
      {previewImageUrl ? (
        <div className={styles.previewOverlay} onClick={handleClosePreview}>
          <div onClick={(e) => e.stopPropagation()}>
            <AssetPreview
              imageUrl={previewImageUrl}
              onClose={handleClosePreview}
              variant="character"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

ModifyCharacter.defaultProps = {
  onSelectCharacter: undefined,
  onPreviewCharacter: undefined,
  onCardBtnClick: undefined,
  defaultSelectedCharacterId: '',
  currentSelectedCharacterId: '',
};

export default ModifyCharacter;
