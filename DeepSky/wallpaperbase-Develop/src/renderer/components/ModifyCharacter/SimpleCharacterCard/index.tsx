import { useSnapshot } from 'valtio';
import { CharacterItem } from '../../../pages/myAssets/types';
import {
  characterState,
  setSelectedButton,
} from '../../../stores/CharacterStore';
import { useStyles } from './styles';
import trashIcon from '$assets/images/uploadPhoto/icon-trash_state_nor_24_trash-03__36_Default.png';
import previewIcon from '$assets/images/uploadPhoto/eye.png';
import { agentPromptItem } from '../../../pages/myAssets/types';
import { AnyMxRecord } from 'node:dns';
interface SimpleCharacterCardProps {
  character: CharacterItem;
  onSelect: (id: string,avatar: string) => void;
  onCardBtnClick?: (character: CharacterItem) => void;
  onPreview?: (avatar: string) => void;
  isSelected?: boolean;
  // onCardSelect?: (character: agentPromptItem) => void;
}

function SimpleCharacterCard({
  character,
  onSelect,
  onCardBtnClick,
  onPreview,
  isSelected = false,
  // onCardSelect,
}: SimpleCharacterCardProps) {
  const { styles } = useStyles();
  const { selectedButton, selectedCharacterId } = useSnapshot(characterState);

  // 检查当前按钮是否被选中
  const isUseButtonSelected =
    selectedButton === 'use' && selectedCharacterId === character.id;
  const isDressButtonSelected =
    selectedButton === 'dress' && selectedCharacterId === character.id;

  const handleUseClick = (e: any) => {
    e.stopPropagation();
    console.log('handleUseClick', character);
    setSelectedButton('use', character.id);
    onSelect(character.id,character.avatar);
  };

  const handleDressClick = (e: any) => {
    e.stopPropagation();
    console.log('handleDressClick', character);
    // setSelectedButton('dress', character.id);
    if (onCardBtnClick) {
      onCardBtnClick(character);
    }
  };

  const handlePreviewClick = (e: any) => {
    e.stopPropagation();
    onPreview?.(character.avatar);
  };

  const handleTrashClick = (e: any) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`${styles.characterCard} ${isSelected ? styles.selectedCard : styles.noSelectedCard}`}
      // className={`${styles.characterCard} ${styles.selectedCard}`}
      role="button"
      tabIndex={0}
      // onClick={() => onCardSelect?.(character)}
      // onKeyDown={(event) => {
      //   if (event.key === 'Enter' || event.key === ' ') {
      //     event.preventDefault();
      //     onCardSelect?.(character);
      //   }
      // }}
      onClick={handleUseClick}
    >
      <div className={styles.topRightActions}>
        <button
          type="button"
          className={styles.topRightActionBtn}
          onClick={handlePreviewClick}
          aria-label="预览"
        >
          <img src={previewIcon} alt="preview" className={styles.topRightActionIcon} />
        </button>
        {/* <button
          type="button"
          className={styles.topRightActionBtn}
          onClick={handleTrashClick}
          aria-label="删除"
        >
          <img src={trashIcon} alt="trash" className={styles.topRightActionIcon} />
        </button> */}
      </div>

      {/* 背景头像 */}
      <img
        alt={character.name}
        src={character.avatar}
        className={styles.characterImage}
        // onClick={handleImageClick}
        style={{ cursor: onPreview ? 'pointer' : 'default' }}
      />

      {/* 渐变遮罩 */}
      <div className={styles.gradientOverlay} />

      {/* 按钮区域 */}
      {(!character.resourceStatus.needsDownload) && (<div className={styles.buttonArea}>
        <button
          type="button"
          // className={`${styles.actionBtn} ${isUseButtonSelected ? styles.clicked : ''}`}
          className={styles.actionBtn}
          onClick={handleUseClick}
        >
          立即使用
        </button>
        <button
          type="button"
          // className={`${styles.actionBtn} ${isDressButtonSelected ? styles.clicked : ''}`}
          className={styles.actionBtn}
          onClick={handleDressClick}
        >
          装扮
        </button>
      </div>)}
      {(character.resourceStatus.needsDownload) && (<div className={styles.buttonArea}>
        <button
          type="button"
          // className={`${styles.actionBtn} ${isUseButtonSelected ? styles.clicked : ''}`}
          className={styles.actionBtn}
          onClick={handleUseClick}
        >
          下载
        </button>
      </div>)} 
      {(character.progress > 0 && character.progress < 100) && (<div className={styles.bg}>
        <div className={styles.loadingText}>更新中。。。。</div>
        <div className={styles.loadingBox}>
          <div className={styles.loadingInner} style={{width: `${character.progress}%`}}></div>
        </div>
      </div>)}
      {/* 底部内容 */}
      <div className={styles.cardContent}>
        {/* 创作者名称 */}
        {/* <div className={styles.cardAuthor}>{character.creator_name}</div> */}

        {/* 标题和按钮行 */}
        <div className={styles.titleRow}>
          <div className={styles.cardTitle}>{character.name}</div>
        </div>
      </div>
    </div>
  );
}

SimpleCharacterCard.defaultProps = {
  onCardBtnClick: undefined,
  onPreview: undefined,
  isSelected: false,
  onCardSelect: undefined,
};

export default SimpleCharacterCard;
