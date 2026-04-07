import { EllipsisOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import checkIcon from '../../../../../assets/icons/WallPaper/check.svg';
import { CharacterItem } from '../types';
import { useStyles } from './styles';

interface CharacterCardProps {
  character: CharacterItem;
  onSelect: (character: CharacterItem) => void;
  onCardBtnClick: (character: CharacterItem) => void;
  onPreview?: (character: CharacterItem) => void;
  onDelete?: (character: CharacterItem) => void;
}

function CharacterCard({
  character,
  onSelect,
  onCardBtnClick,
  onPreview,
  onDelete = () => {},
}: CharacterCardProps) {
  const { styles } = useStyles();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelect = (e: any) => {
    e.stopPropagation();
    if (!character.isUsing) {
      onSelect(character);
    }
  };

  const handleCardBtnClick = (e: any) => {
    e.stopPropagation();
    if (onCardBtnClick) {
      onCardBtnClick(character);
    }
  };

  const handleImageClick = (e: any) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(character);
    }
  };

  const handleMenuClick = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const handlePreview = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onPreview) {
      onPreview(character);
    }
  };

  const handleDelete = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onDelete) {
      onDelete(character);
    }
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div
      className={`${styles.characterCard} ${
        character.isUsing ? 'selected' : ''
      }`}
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect(e);
        }
      }}
    >
      {/* 背景头像 */}
      <img
        alt={character.name}
        src={character.avatar}
        className={`${styles.characterImage} character-image`}
        onClick={handleImageClick}
        style={{ cursor: 'pointer' }}
      />

      {/* 渐变遮罩 */}
      <div className={`${styles.gradientOverlay} gradient-overlay`} />

      {/* 左上角状态指示器 - 对勾图标 */}
      {character.isUsing && (
        <div className={`${styles.topLeftIndicators} top-left-indicators`}>
          <div className={styles.checkButton}>
            <img src={checkIcon} alt="check" />
          </div>
        </div>
      )}

      {/* 右上角状态指示器 - 菜单按钮 */}
      <div
        className={`${styles.topRightIndicators} top-right-indicators`}
        ref={menuRef}
      >
        <div
          className={styles.menuButton}
          onClick={handleMenuClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleMenuClick(e);
            }
          }}
        >
          <EllipsisOutlined style={{ fontSize: '24px' }} />
        </div>

        {/* 菜单弹出层 */}
        {isMenuOpen && (
          <div className={styles.menuDropdown}>
            <div
              className={styles.menuItem}
              onClick={handlePreview}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handlePreview(e);
                }
              }}
            >
              预览
            </div>
            {/* <div
              className={styles.menuItem}
              onClick={handleDelete}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleDelete(e);
                }
              }}
            >
              删除
            </div> */}
          </div>
        )}
      </div>

      {/* 底部内容 */}
      <div className={styles.cardContent}>
        {/* 创作者名称 */}
        {/* <div className={styles.cardAuthor}>{character.author}</div> */}

        {/* 标题和按钮行 */}
        <div className={styles.titleRow}>
          <div className={styles.cardTitle}>{character.name}</div>
          <Button
            type="default"
            className={`${styles.actionButton} select-btn`}
            onClick={handleCardBtnClick}
          >
            装扮
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CharacterCard;
