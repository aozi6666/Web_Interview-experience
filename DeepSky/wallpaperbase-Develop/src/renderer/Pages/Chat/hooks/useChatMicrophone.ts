import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import { wallpaperInputActions } from '@stores/WallpaperInputStore';
import { useCallback } from 'react';

const ipcEvents = getIpcEvents();

/**
 * 麦克风控制 Hook
 */
export const useChatMicrophone = (isUE3DActive: boolean, rtcContext: any) => {
  /**
   * 🎯 统一的麦克风控制接口
   * 根据 UE 状态自动选择控制方式（UE 或 RTC）
   */
  const setMicrophoneUnified = useCallback(
    async (operation: 'open' | 'close', updateGlobalState: boolean = true) => {
      const isMicEnabled = operation === 'open';

      if (isUE3DActive) {
        // ✅ UE 3D 模式 -> 控制 UE 麦克风
        console.log('🎤 [Chat] 通过 UE 控制麦克风:', operation);
        try {
          await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_OPERATE_MIC, {
            type: 'operateMic',
            data: { operation },
          });
        } catch (error) {
          console.error('❌ [Chat] UE 麦克风控制失败:', error);
        }
      }

      // ✅ RTC 麦克风始终同步控制（与 UE 并行）
      if (rtcContext.isActive || rtcContext.isConnected) {
        console.log('🎤 [Chat] 通过 RTC 控制麦克风:', operation);
        const shouldMute = operation === 'close';
        await rtcContext.mute(shouldMute);
      } else if (!isUE3DActive) {
        console.warn('⚠️ [Chat] RTC 未激活，麦克风控制失败');
      }

      // 更新全局麦克风状态
      if (updateGlobalState) {
        wallpaperInputActions.setMicEnabled(isMicEnabled);

        // 跨窗口同步
        ipcEvents.emitTo(
          WindowName.WALLPAPER_INPUT,
          IPCChannels.MICROPHONE_STATE_UPDATE,
          {
            type: 'mic-state-update',
            isMicEnabled,
            source: 'Chat',
          },
        );
      }
    },
    [isUE3DActive, rtcContext],
  );

  return { setMicrophoneUnified };
};
