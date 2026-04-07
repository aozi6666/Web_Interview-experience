import { getIpcEvents } from '@renderer/ipc-events';
import {
  useIsUE3DActive,
  useIsUERunning,
  useSystemStatus,
} from '@renderer/hooks/useSystemStatus';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Modal, message } from 'antd';
import { useCallback, useRef } from 'react';

const ipcEvents = getIpcEvents();

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;

interface UEStateSnapshotResult {
  success: boolean;
  data?: { isRunning?: boolean; state?: string; isEmbedded?: boolean };
}

/**
 * 轮询主进程 UE 状态快照，等待 3D 就绪且嵌入桌面完成。
 * 与 WallpaperModeSwitcher 的 isInteractiveCoreReady 判定一致。
 */
async function waitForUE3DReadyAndEmbedded(
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_QUERY_STATE_SNAPSHOT,
      )) as UEStateSnapshotResult;
      if (
        result.success &&
        result.data?.isRunning &&
        result.data.state === '3D' &&
        result.data.isEmbedded
      ) {
        return true;
      }
    } catch {
      // ignore, keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * 确保 UE 处于互动模式（3D）的 hook。
 *
 * 若当前已处于 3D 状态，直接返回 true；
 * 否则弹出 Modal 提示用户启动，确认后切换到互动模式并等待就绪。
 *
 * 启动逻辑完全复用 switchWallpaperMode('Interactive') 标准流程：
 * 主进程 UE_CHANGE_STATE handler 会自动拉起 UE、切换模式、嵌入桌面、
 * 同步 Z 序及广播状态给所有渲染进程（Chat / WallpaperModeSwitcher 等）。
 */
export function useEnsureInteractiveMode() {
  const isUE3DActive = useIsUE3DActive();
  const isUERunning = useIsUERunning();
  const { switchWallpaperMode, embedToDesktop } = useSystemStatus();
  const busyRef = useRef(false);

  const doSwitch = useCallback(async (): Promise<boolean> => {
    busyRef.current = true;
    try {
      await switchWallpaperMode('Interactive');

      const ready = await waitForUE3DReadyAndEmbedded();
      if (!ready) {
        message.error('启动互动模式超时，请稍后重试');
        return false;
      }

      await embedToDesktop().catch(() => undefined);
      return true;
    } catch (error) {
      console.error('启动互动模式失败:', error);
      message.error('启动互动模式失败，请稍后重试');
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [switchWallpaperMode, embedToDesktop]);

  const ensureInteractiveMode = useCallback((): Promise<boolean> => {
    if (isUE3DActive) {
      return Promise.resolve(true);
    }

    if (busyRef.current) {
      return Promise.resolve(false);
    }

    // UE 已在运行但尚未处于 3D 模式，直接切换无需弹窗确认
    if (isUERunning) {
      return doSwitch();
    }

    return new Promise<boolean>((resolve) => {
      const modal = Modal.confirm({
        title: '需要启动互动模式',
        content: '修改角色/场景需要在互动模式下进行，是否现在启动？',
        okText: '启动',
        cancelText: '取消',
        maskClosable: false,
        onCancel: () => {
          resolve(false);
        },
        onOk: async () => {
          modal.update({
            okButtonProps: { loading: true },
            cancelButtonProps: { disabled: true },
          });

          const ok = await doSwitch();
          resolve(ok);
        },
      });
    });
  }, [isUE3DActive, isUERunning, doSwitch]);

  return { ensureInteractiveMode };
}
