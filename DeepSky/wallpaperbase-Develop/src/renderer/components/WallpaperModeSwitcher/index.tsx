/**
 * 壁纸模式切换器组件
 * 在主界面显示当前壁纸模式，并允许用户快速切换
 * 可互动壁纸：互动/标准/静止三种模式
 * 不可互动壁纸：标准/静止两种模式
 */
import checkIcon from '$assets/comment/check-f.svg';
import loadingIcon from '$assets/comment/loading.svg';
import { loadWallpaperConfig } from '@renderer/api/wallpaperConfig';
import {
  useSystemStatus,
  useWallpaperDisplayMode,
} from '@renderer/hooks/useSystemStatus';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import type { WallpaperDisplayMode } from '@shared/types';
import { isWallpaperInteractable } from '@shared/types/wallpaper';
import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallpaperModeSwitcherStyles } from './styles';

/** 模式配置 */
const MODE_OPTIONS: {
  value: WallpaperDisplayMode;
  label: string;
  tip: string;
}[] = [
  {
    value: 'Interactive',
    label: '互动模式',
    tip: '实时渲染壁纸，边聊边互动，沉浸体验。',
  },
  {
    value: 'EnergySaving',
    label: '标准模式',
    tip: '轻量动态壁纸，超流畅运行，超低功耗。',
  },
  {
    value: 'StaticFrame',
    label: '静止模式',
    tip: '静态高清壁纸，资源零占用，随时畅聊。',
  },
];

const ipcEvents = getIpcEvents();

export default function WallpaperModeSwitcher() {
  const { styles } = useWallpaperModeSwitcherStyles();
  const {
    mode,
    switchToInteractive,
    switchToEnergySaving,
    switchToStaticFrame,
    resumeFromStaticFrame,
    isStaticFrame,
  } = useWallpaperDisplayMode();
  const { status, embedToDesktop } = useSystemStatus();
  const [interactable, setInteractable] = useState(false);
  const [open, setOpen] = useState(false);
  const [expectedSceneId, setExpectedSceneId] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<WallpaperDisplayMode | null>(
    null,
  );
  const [isInteractiveStableReady, setIsInteractiveStableReady] =
    useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastEmbedRetryAtRef = useRef(0);

  const currentSceneId = status.ueState.currentScene;
  const isInteractiveCoreReady =
    mode === 'Interactive' &&
    status.ueState.isEmbedded &&
    Boolean(currentSceneId) &&
    (!expectedSceneId || currentSceneId === expectedSceneId);
  const isInteractiveAppliedReady =
    isInteractiveCoreReady && isInteractiveStableReady;
  const isInteractivePending =
    (pendingMode === 'Interactive' || mode === 'Interactive') &&
    !isInteractiveAppliedReady;

  const currentModeLabel = useMemo(() => {
    if (isInteractivePending) {
      return '加载中';
    }
    return (
      MODE_OPTIONS.find((item) => item.value === mode)?.label || '标准模式'
    );
  }, [isInteractivePending, mode]);

  const refreshInteractable = useCallback(async () => {
    try {
      const result = await loadWallpaperConfig();
      if (result.success && result.config) {
        setInteractable(isWallpaperInteractable(result.config.tags));
        setExpectedSceneId(
          result.config.sceneId || result.config.levelId || null,
        );
      } else {
        setInteractable(false);
        setExpectedSceneId(null);
      }
    } catch {
      setInteractable(false);
      setExpectedSceneId(null);
    }
  }, []);

  // 加载当前壁纸标签判断是否可互动
  useEffect(() => {
    refreshInteractable();
  }, [refreshInteractable]);

  // 壁纸配置更新时同步刷新（与托盘保持一致）
  useEffect(() => {
    const handleConfigLoaded = () => {
      refreshInteractable();
    };
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_CONFIG_LOADED,
      handleConfigLoaded,
    );
    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.WALLPAPER_CONFIG_LOADED,
        handleConfigLoaded,
      );
    };
  }, [refreshInteractable]);

  // 壁纸切换后刷新，确保 expectedSceneId 与新场景对齐
  useEffect(() => {
    const handleWallpaperApplied = () => {
      refreshInteractable();
    };
    window.addEventListener('wallpaper-applied', handleWallpaperApplied);
    return () => {
      window.removeEventListener('wallpaper-applied', handleWallpaperApplied);
    };
  }, [refreshInteractable]);

  // 每次展开下拉前刷新一次，避免状态过期
  useEffect(() => {
    if (open) {
      refreshInteractable();
    }
  }, [open, refreshInteractable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // UE 真正切到互动模式后，清理待切换状态。
  useEffect(() => {
    if (pendingMode === 'Interactive' && isInteractiveAppliedReady) {
      setPendingMode(null);
    }
  }, [isInteractiveAppliedReady, pendingMode]);

  // 互动就绪需保持短暂稳定窗口，避免人物尚未渲染完成时过早回显“互动模式”。
  useEffect(() => {
    if (!isInteractiveCoreReady) {
      setIsInteractiveStableReady(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsInteractiveStableReady(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isInteractiveCoreReady]);

  // 互动模式切换中若 UE 尚未稳定嵌入，触发一次重嵌入修复，避免 UE 窗口层级异常盖住界面。
  // 装扮场景（char_appear_edit_level）需要全屏而非嵌入桌面，跳过重嵌入。
  useEffect(() => {
    if (mode !== 'Interactive') return;
    if (!status.wallpaperBaby.isRunning) return;
    if (status.ueState.isEmbedded) return;
    if (currentSceneId === 'char_appear_edit_level') return;

    const now = Date.now();
    if (now - lastEmbedRetryAtRef.current < 1500) return;
    lastEmbedRetryAtRef.current = now;

    embedToDesktop().catch(() => undefined);
  }, [
    embedToDesktop,
    mode,
    status.wallpaperBaby.isRunning,
    status.ueState.isEmbedded,
    currentSceneId,
  ]);

  const handleSwitch = useCallback(
    async (targetMode: WallpaperDisplayMode) => {
      if (targetMode === mode) return;
      setPendingMode(targetMode === 'Interactive' ? 'Interactive' : null);
      try {
        if (targetMode === 'Interactive') {
          await switchToInteractive();
        } else if (targetMode === 'EnergySaving') {
          if (isStaticFrame) {
            // 从静止恢复后再切标准
            await resumeFromStaticFrame();
          } else {
            await switchToEnergySaving();
          }
        } else {
          await switchToStaticFrame();
        }
        setOpen(false);
      } catch {
        setPendingMode(null);
        message.error('切换模式失败');
      }
    },
    [
      mode,
      isStaticFrame,
      switchToInteractive,
      switchToEnergySaving,
      switchToStaticFrame,
      resumeFromStaticFrame,
    ],
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.currentModeButton}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      >
        <div className={styles.currentModeLabel}>
          {isInteractivePending ? (
            <>
              <img
                src={loadingIcon}
                alt="loading"
                style={{ width: 16, height: 16, marginRight: 4 }}
              />
              {currentModeLabel}
            </>
          ) : (
            currentModeLabel
          )}
        </div>
        <div className={styles.arrowIcon}>›</div>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {MODE_OPTIONS.map((opt) => {
            const isActive = opt.value === mode;
            const disabled = opt.value === 'Interactive' && !interactable;

            return (
              <button
                key={opt.value}
                type="button"
                className={`${styles.optionItem} ${
                  disabled ? styles.optionItemDisabled : ''
                }`}
                disabled={disabled}
                title={
                  disabled && opt.value === 'Interactive'
                    ? '当前壁纸不支持互动模式'
                    : opt.tip
                }
                onClick={() => handleSwitch(opt.value)}
              >
                <span>{opt.label}</span>
                <span className={styles.checkMark}>
                  {isActive ? (
                    <img
                      className={styles.checkIcon}
                      src={checkIcon}
                      alt="selected"
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
