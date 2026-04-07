import checkIcon from '$assets/icons/WallPaper/check.svg';
import { EllipsisOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { CharacterItem } from '../types';
import { useStyles } from './styles';

interface CharacterCardProps {
  character: CharacterItem;
  currentWallpaperGender: string;
  wallpaperConfigParams: Record<string, any>;
  onSelect: (character: CharacterItem) => void;
  onCardBtnClick: (character: CharacterItem) => void;
  onPreview?: (character: CharacterItem) => void;
  onRedownload?: (character: CharacterItem, source?: 'no-resource' | 'menu') => void;
  onDelete?: (character: CharacterItem) => void;
  onRename?: (character: CharacterItem) => void;
  // 预览相关配置
  allCharacters?: CharacterItem[]; // 所有角色列表，用于预览时传递所有图片
  showNavigation?: boolean; // 是否显示左右导航按钮，默认为 false（与推荐页面一致）
}

function CharacterCard({
  character,
  currentWallpaperGender,
  wallpaperConfigParams,
  onSelect,
  onCardBtnClick,
  onPreview,
  onRedownload,
  onDelete = () => {},
  onRename = () => {},
  allCharacters,
  showNavigation = false, // 默认不显示导航按钮，与推荐页面一致
}: CharacterCardProps) {
  const { styles } = useStyles();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 根据 config_params 判断当前角色是否可以更换
  const canSwitchRole = useMemo(() => {
    // 检查 config_params 中是否有 switchableAvatar 配置
    const switchableAvatar = wallpaperConfigParams?.switchableAvatar;

    // 如果 switchableAvatar 为 false，则不能更换角色
    if (switchableAvatar === false) {
      return false;
    }

    // 如果 switchableAvatar 为 true，则可以更换角色，但需要性别相同
    if (switchableAvatar === true) {
      return character.metadata?.gender === currentWallpaperGender;
    }

    // 如果没有配置 switchableAvatar，则使用原来的性别判断逻辑（向后兼容）
    return character.metadata?.gender === currentWallpaperGender;
  }, [
    character.metadata?.gender,
    currentWallpaperGender,
    wallpaperConfigParams,
  ]);
  // eslint-disable-next-line no-console
  console.log(
    `角色 ${character.name}: gender=${character.metadata?.gender}, currentWallpaperGender=${currentWallpaperGender}, canSwitchRole=${canSwitchRole}`,
  );

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

  const handleMenuClick = (e: any) => {
    e.stopPropagation();
    analytics.track(AnalyticsEvent.MY_ROLES_MENU_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});
    setIsMenuOpen(!isMenuOpen);
  };

  const handlePreview = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    analytics.track(AnalyticsEvent.MY_ROLES_PREVIEW_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});
    // 直接调用 IPC 预览（与推荐页面模式一致）
    if (allCharacters && allCharacters.length > 0) {
      const index = allCharacters.findIndex((c) => c.id === character.id);
      if (index !== -1) {
        ipcEvents
          .invoke(IPCChannels.PREVIEW_WINDOW, {
            index,
            images: allCharacters.map((c) => c.avatar).filter(Boolean),
            showNavigation, // 使用传入的 showNavigation 参数
            showDelete: false, // 不显示删除按钮
          })
          .catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error('打开预览窗口失败:', error);
          });
      }
    } else if (character.avatar) {
      // 如果没有提供所有角色列表，只预览当前角色
      ipcEvents
        .invoke(IPCChannels.PREVIEW_WINDOW, {
          index: 0,
          images: [character.avatar],
          showNavigation, // 使用传入的 showNavigation 参数
          showDelete: false, // 不显示删除按钮
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console
          console.error('打开预览窗口失败:', error);
        });
    } else if (onPreview) {
      // 回退到使用传入的 onPreview prop
      onPreview(character);
    }
  };

  const handleRedownload = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onRedownload) {
      onRedownload(character, 'menu');
    }
  };

  const handleDelete = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    analytics.track(AnalyticsEvent.MY_ROLES_DELETE_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});
    if (onDelete) {
      onDelete(character);
    }
  };

  const handleRename = (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    analytics.track(AnalyticsEvent.MY_ROLES_ICON_PREVIEW_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});
    if (onRename) {
      onRename(character);
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
      role="button"
      tabIndex={0}
    >
      {/* 背景头像 */}
      <div className={styles.characterBg}>
        <img
          alt={character.name}
          src={character.avatar}
          className={`${styles.characterImage} character-image`}
          style={{ cursor: 'pointer' }}
        />

        {/* Hover时显示的按钮区域 */}
        <div
          className={`${styles.hoverButtons} hover-buttons ${character.resourceStatus?.needsDownload ? 'download-mode' : ''}`}
        >
          {character.resourceStatus?.needsDownload ? (
            // 需要下载：显示单个居中的下载按钮
            <div className={styles.hoverButtonsContent}>
              <button
                type="button"
                className={`${styles.hoverButton} download-single`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRedownload) onRedownload(character, 'no-resource');
                }}
              >
                下载
              </button>
            </div>
          ) : (
            // 有资源：显示正常的两个按钮
            <div className={styles.hoverButtonsContent}>
             {/* <button
                type="button"
                className={`${styles.hoverButton} ${canSwitchRole ? 'switch-role' : 'switch-role-disabled'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canSwitchRole) {
                    analytics.track(AnalyticsEvent.MY_ROLES_CHANGE_CHARACTER_CLICK,
                      {
                        visitor_id: getVisitorId() || 'unknown',
                        chunk_id: character.metadata?.chunk_id,
                      },
                    ).catch(() => {});
                    handleSelect(e);
                  }
                }}
              >
                更换角色
              </button>*/}
              <button
                type="button"
                className={`${styles.hoverButton} apply-dress`}
                onClick={(e) => {
                  e.stopPropagation();
                  analytics.track(AnalyticsEvent.MY_ROLES_APPEARANCE_CLICK,
                    {
                      visitor_id: getVisitorId() || 'unknown',
                      chunk_id: character.metadata?.chunk_id,
                      gender: character.metadata?.gender,
                    },
                  ).catch(() => {});
                  handleCardBtnClick(e);
                }}
              >
                装扮
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 渐变遮罩 */}
      {/* <div className={`${styles.gradientOverlay} gradient-overlay`} /> */}

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
            <div
              className={styles.menuItem}
              onClick={handleRedownload}
              role="button"
              tabIndex={0}
            >
              重新下载
            </div>
            <div
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
            </div>
            <div
              className={styles.menuItem}
              onClick={handleRename}
              role="button"
              tabIndex={0}
            >
              重命名
            </div>
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
          {/*<Button
            type="default"
            className={`${styles.actionButton} select-btn`}
            onClick={handleCardBtnClick}
          >
            装扮
          </Button>*/}
        </div>
      </div>
    </div>
  );
}

export default CharacterCard;
