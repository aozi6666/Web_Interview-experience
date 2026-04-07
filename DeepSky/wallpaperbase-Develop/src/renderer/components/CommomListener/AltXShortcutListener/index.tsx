import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

/**
 * Alt+X快捷键监听器
 * 监听Alt+X快捷键触发消息。
 * 注意：默认策略下不再通过 Alt+X 自动切到 3D，
 * 3D 仅由“手工模式切换器”或“桌面五连击”触发。
 */
export function AltXShortcutListener() {
  useEffect(() => {
    // 监听Alt+X快捷键触发消息
    const handleAltXShortcut = () => {
      console.log('[AltXShortcutListener] 🎹 收到Alt+X快捷键触发消息（不自动切3D）');
      // try {
      //   // 调用ensureWallpaperBabyRunning拉起UE
      //   const result = await ensureWallpaperBabyRunning();

      //   if (result.success) {
      //     console.log(
      //       '[AltXShortcutListener] ✅ WallpaperBaby 启动成功',
      //       result
      //     );

      //     // 发送UE启动成功消息给相关窗口
      //     ipcEvents.emitTo(
      //       WindowName.MAIN,
      //       IPCChannels.UE_LAUNCH_RESULT,
      //       {
      //         success: true,
      //         message: 'UE启动成功',
      //       }
      //     );
      //     ipcEvents.emitTo(
      //       WindowName.WALLPAPER_INPUT,
      //       IPCChannels.UE_LAUNCH_RESULT,
      //       {
      //         success: true,
      //         message: 'UE启动成功',
      //       }
      //     );
      //   } else {
      //     console.log(
      //       '[AltXShortcutListener] ❌ WallpaperBaby 启动失败',
      //       result
      //     );

      //     // 发送UE启动失败消息给相关窗口
      //     ipcEvents.emitTo(
      //       WindowName.MAIN,
      //       IPCChannels.UE_LAUNCH_RESULT,
      //       {
      //         success: false,
      //         message: 'UE启动失败',
      //         error: result.error,
      //       }
      //     );
      //     ipcEvents.emitTo(
      //       WindowName.WALLPAPER_INPUT,
      //       IPCChannels.UE_LAUNCH_RESULT,
      //       {
      //         success: false,
      //         message: 'UE启动失败',
      //         error: result.error,
      //       }
      //     );
      //   }
      // } catch (error) {
      //   console.error(
      //     '[AltXShortcutListener] ❌ WallpaperBaby 启动异常',
      //     error
      //   );

      //   // 发送UE启动异常消息给相关窗口
      //   ipcEvents.emitTo(
      //     WindowName.MAIN,
      //     IPCChannels.UE_LAUNCH_RESULT,
      //     {
      //       success: false,
      //       message: 'UE启动异常',
      //       error,
      //     }
      //   );
      //   ipcEvents.emitTo(
      //     WindowName.WALLPAPER_INPUT,
      //     IPCChannels.UE_LAUNCH_RESULT,
      //     {
      //       success: false,
      //       message: 'UE启动异常',
      //       error,
      //     }
      //   );
      // }
    };

    // 监听 IPC 消息
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.ALT_X_SHORTCUT_TRIGGERED,
      handleAltXShortcut,
    );
    const unsubscribe = () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.ALT_X_SHORTCUT_TRIGGERED,
        handleAltXShortcut,
      );
    };

    return () => {
      // 清理监听器
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      } else {
        ipcEvents.off(
          IpcTarget.MAIN,
          IPCChannels.ALT_X_SHORTCUT_TRIGGERED,
          handleAltXShortcut,
        );
      }
    };
  }, []);

  return null; // 这个组件不渲染任何UI
}

export default AltXShortcutListener;
