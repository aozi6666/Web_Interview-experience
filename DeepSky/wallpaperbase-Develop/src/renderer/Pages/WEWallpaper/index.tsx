import { getIpcEvents } from '@renderer/ipc-events';
import { useGridColumns } from '@hooks/useGridColumns';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useStyles } from '@renderer/Pages/WEWallpaper/styles';
import {
  setSelectedCharacter,
  setSelectedWallpaperTitle,
} from '@stores/CharacterStore';
import { setCurrentCharacter as setCurrentConversation } from '@stores/ConversationStore';
import CommonLayout from '../../components/CommonLayout';
import { WE_CHARACTER_SCENE_ID, getWECharacter } from './weCharacter';
import {
  Button,
  Empty,
  Space,
  Spin,
  Tag,
  message,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

const ipcEvents = getIpcEvents();

interface WEWallpaperEntry {
  id: string;
  title: string;
  preview: string | null;
  type: string;
  tags: string[];
  dirPath: string;
}

interface WEActionResult {
  success?: boolean;
  error?: string;
}

const GRID_CALC_FN = (width: number) => {
  const maxCardWidth = 275;
  const minColumns = 2;
  if (width >= maxCardWidth) {
    return Math.max(minColumns, Math.floor(width / maxCardWidth) + 1);
  }
  return minColumns;
};

function WEWallpaper() {
  const { styles } = useStyles();
  const [wallpapers, setWallpapers] = useState<WEWallpaperEntry[]>([]);
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [loadLoadingId, setLoadLoadingId] = useState<string | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const calcFn = useCallback((width: number) => GRID_CALC_FN(width), []);
  const gridColumns = useGridColumns(gridRef, calcFn);

  const switchToWECharacter = useCallback(async (wallpaperTitle?: string) => {
    const character = await getWECharacter();
    const resolvedWallpaperTitle = wallpaperTitle || character.name;
    console.log(
      '[WEWallpaper] 切换人设，准备 dispatch wallpaper-character-changed',
      {
        wallpaperTitle: resolvedWallpaperTitle,
        character: character.name,
      },
    );
    setSelectedCharacter(character, WE_CHARACTER_SCENE_ID);
    setCurrentConversation(WE_CHARACTER_SCENE_ID, character.name);
    setSelectedWallpaperTitle(
      resolvedWallpaperTitle,
      WE_CHARACTER_SCENE_ID,
    );
    window.dispatchEvent(
      new CustomEvent('wallpaper-character-changed', {
        detail: { character, shouldConnectRTC: true },
      }),
    );
    console.log('[WEWallpaper] wallpaper-character-changed 已 dispatch', {
      sceneId: WE_CHARACTER_SCENE_ID,
      character: character.name,
    });
    void ipcEvents
      .invokeTo(IpcTarget.MAIN, IPCChannels.SET_ACTIVE_WALLPAPER_RUNTIME, {
        sceneKey: WE_CHARACTER_SCENE_ID,
        wallpaperTitle: resolvedWallpaperTitle,
        character,
      })
      .then((result) => {
        const runtimeResult = result as { success?: boolean; error?: string };
        if (!runtimeResult?.success) {
          console.warn(
            '[WEWallpaper] 同步当前壁纸运行态失败:',
            runtimeResult?.error || 'unknown',
          );
        }
      })
      .catch((error) => {
        console.warn('[WEWallpaper] 同步当前壁纸运行态异常:', error);
      });
  }, []);

  const scanWallpapers = async () => {
    setScanLoading(true);
    try {
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.WE_SCAN_WALLPAPERS,
      )) as {
        success: boolean;
        data?: WEWallpaperEntry[];
        error?: string;
      };
      if (!result?.success) {
        message.error(result?.error || '扫描 WE 壁纸失败');
        return;
      }
      setWallpapers(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('扫描 WE 壁纸失败:', error);
      message.error('扫描 WE 壁纸失败');
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    scanWallpapers();
  }, []);

  const loadAndEmbedWallpaper = async (
    wallpaperDirPath: string,
  ): Promise<{ success: boolean; loaded: boolean; error?: string }> => {
    const loadResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WE_SET_WALLPAPER,
      wallpaperDirPath,
    )) as WEActionResult;

    if (!loadResult?.success) {
      return {
        success: false,
        loaded: false,
        error: loadResult?.error || '打开 WE 窗口失败',
      };
    }

    setIsWindowOpen(true);

    const embedResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WE_EMBED_TO_DESKTOP,
    )) as WEActionResult;

    if (!embedResult?.success) {
      return {
        success: false,
        loaded: true,
        error: embedResult?.error || '设置桌面壁纸失败',
      };
    }

    return { success: true, loaded: true };
  };

  const handleLoadWallpaper = async (entry: WEWallpaperEntry) => {
    if (loadLoadingId) {
      return;
    }
    console.info('[WEWallpaper] 尝试应用条目', {
      id: entry.id,
      title: entry.title,
      dirPath: entry.dirPath,
    });
    setLoadLoadingId(entry.id);
    try {
      const result = await loadAndEmbedWallpaper(entry.dirPath);
      if (result.success) {
        await switchToWECharacter(entry.title);
        message.success(`已设置桌面壁纸：${entry.title}`);
        return;
      }

      if (result.loaded) {
        message.warning(
          result.error || `已打开 WE 窗口，但设置桌面壁纸失败：${entry.title} (${entry.id})`,
        );
        return;
      }

      message.error(result.error || `打开 WE 窗口失败：${entry.title} (${entry.id})`);
    } catch (error) {
      console.error('设置 WE 壁纸失败:', {
        id: entry.id,
        title: entry.title,
        dirPath: entry.dirPath,
        error,
      });
      message.error(`设置 WE 壁纸失败：${entry.title} (${entry.id})`);
    } finally {
      setLoadLoadingId(null);
    }
  };

  const handleSelectDirectory = async () => {
    if (loadLoadingId) {
      return;
    }
    try {
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SELECT_FOLDER,
      )) as string[] | null;
      if (!result || result.length === 0) {
        return;
      }

      setLoadLoadingId('manual-select');
      const applyResult = await loadAndEmbedWallpaper(result[0]);
      if (applyResult.success) {
        switchToWECharacter();
        message.success('已设置桌面壁纸');
        return;
      }

      if (applyResult.loaded) {
        message.warning(
          applyResult.error || '已打开 WE 窗口，但设置桌面壁纸失败',
        );
        return;
      }

      message.error(applyResult.error || '打开 WE 窗口失败');
    } catch (error) {
      console.error('手动选择目录失败:', error);
      message.error('手动选择目录失败');
    } finally {
      setLoadLoadingId(null);
    }
  };

  const handleCloseWEWindow = async () => {
    if (!isWindowOpen) {
      return;
    }
    setCloseLoading(true);
    try {
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.WE_REMOVE_WALLPAPER,
      )) as WEActionResult;
      if (!result?.success) {
        message.error(result?.error || '关闭 WE 窗口失败');
        return;
      }
      setIsWindowOpen(false);
      message.success('WE 窗口已关闭');
    } catch (error) {
      console.error('关闭 WE 窗口失败:', error);
      message.error('关闭 WE 窗口失败');
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <CommonLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>WE 壁纸列表</div>
          <Space>
            <Button danger loading={closeLoading} onClick={handleCloseWEWindow}>
              关闭 WE 窗口
            </Button>

            <Button loading={scanLoading} onClick={scanWallpapers}>
              刷新列表
            </Button>
          </Space>
        </div>

        {scanLoading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spin tip="正在扫描 Steam 壁纸...">
              <div style={{ minHeight: 24 }} />
            </Spin>
          </div>
        ) : wallpapers.length === 0 ? (
          <Empty
            description="未检测到 Wallpaper Engine 壁纸目录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button onClick={handleSelectDirectory}>手动选择壁纸目录</Button>
          </Empty>
        ) : (
          <div
            ref={gridRef}
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(180px, 1fr))` }}
          >
            {wallpapers.map((entry) => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                className={styles.wallpaperCard}
                onClick={() => handleLoadWallpaper(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    handleLoadWallpaper(entry);
                  }
                }}
              >
                <div className={styles.previewArea}>
                  {entry.preview ? (
                    <img
                      src={entry.preview}
                      alt={entry.title}
                      className={styles.previewImage}
                    />
                  ) : (
                    <div className={styles.previewFallback}>无预览图</div>
                  )}
                </div>

                {loadLoadingId === entry.id ? (
                  <div className={styles.loadingBadge}>
                    <Spin size="small" />
                  </div>
                ) : null}

                <div className={styles.metaBar}>
                  <div className={styles.title}>{entry.title}</div>
                  <Tag color="blue" className={styles.typeTag}>
                    {entry.type}
                  </Tag>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CommonLayout>
  );
}

export default WEWallpaper;
