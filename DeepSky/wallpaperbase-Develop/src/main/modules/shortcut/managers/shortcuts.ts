import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { MainIpcEvents } from '../../../ipc-events';
import { createWallpaperInputWindow } from '../../window/factory/createSpecialWindows';
import { windowPool } from '../../window/pool/windowPool';
import type { ShortcutConfig } from './types';

/**
 * 检查是否应该阻止快捷键执行
 * @returns 如果应该阻止则返回 true
 */
function shouldBlockShortcut(): boolean {
  console.log('[Shortcut] 开始检查是否应该阻止快捷键...');

  // 检查 GenerateFace 窗口是否打开
  const generateFaceWindow = windowPool.get(WindowName.GENERATE_FACE);
  console.log('[Shortcut] GenerateFace窗口状态:', {
    exists: !!generateFaceWindow,
    isDestroyed: generateFaceWindow ? generateFaceWindow.isDestroyed() : 'N/A',
    windowName: WindowName.GENERATE_FACE,
  });

  if (generateFaceWindow && !generateFaceWindow.isDestroyed()) {
    console.log('[Shortcut] ❌ GenerateFace窗口已打开，快捷键被禁用');
    return true;
  }

  // 可以在这里添加更多的阻止条件
  // 例如：检查其他特定窗口是否打开
  // const createSceneWindow = windowPool.get(WindowName.CREATE_SCENE);
  // if (createSceneWindow && !createSceneWindow.isDestroyed()) {
  //   console.log('[Shortcut] ❌ CreateScene窗口已打开，快捷键被禁用');
  //   return true;
  // }

  console.log('[Shortcut] ✅ 没有阻止条件，快捷键可以执行');
  return false;
}

/**
 * 窗口管理相关快捷键配置
 */
export const windowShortcuts: ShortcutConfig[] = [
  {
    accelerator: 'Alt+X',
    description: '呼出壁纸输入窗口',
    handler: () => {
      console.log('\n========================================');
      console.log('[Shortcut] 🎹 触发 Alt+X - 呼出壁纸输入窗口');
      console.log('========================================');

      // 检查是否应该阻止快捷键
      if (shouldBlockShortcut()) {
        console.log('[Shortcut] ⛔ 快捷键被阻止，操作终止');
        console.log('========================================\n');
        return;
      }

      try {
        // 检查WALLPAPER_INPUT窗口是否已存在
        const existingWallpaperInputWindow = windowPool.get(
          WindowName.WALLPAPER_INPUT,
        );
        if (
          existingWallpaperInputWindow &&
          !existingWallpaperInputWindow.isDestroyed()
        ) {
          console.log('[Shortcut] ℹ️  壁纸输入窗口已存在，不执行操作');
          console.log('========================================\n');
          return;
        }

        // 检查主窗口是否已打开（未收进托盘中）
        const mainWindow = windowPool.get(WindowName.MAIN);
        const isMainWindowOpen =
          mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();

        if (isMainWindowOpen) {
          // 主窗口已打开，切换到chat页面
          console.log('[Shortcut] ✅ 主窗口已打开，切换到chat页面');
          mainWindow.show();
          mainWindow.focus();

          // 发送路由导航消息到主窗口
          console.log('发送路由导航消息到主窗口: /chat');
          MainIpcEvents.getInstance().emitTo(
            WindowName.MAIN,
            IPCChannels.NAVIGATE_TO_ROUTE,
            { route: '/chat' },
          );
          console.log('路由导航消息已发送: /chat');
        } else {
          // 主窗口未打开，创建壁纸输入窗口
          console.log('[Shortcut] ✅ 主窗口未打开，开始创建壁纸输入窗口...');
          createWallpaperInputWindow();
          console.log('[Shortcut] ✅ 壁纸输入窗口创建完成');
        }

        // 发送Alt+X触发消息给渲染进程
        if (mainWindow) {
          console.log('[Shortcut] 📤 发送Alt+X触发消息给渲染进程');
          MainIpcEvents.getInstance().emitTo(
            WindowName.MAIN,
            IPCChannels.ALT_X_SHORTCUT_TRIGGERED,
          );
        }

        console.log('========================================\n');
      } catch (error) {
        console.error('[Shortcut] ❌ 操作失败:', error);
        console.log('========================================\n');
      }
    },
  },
];

/**
 * 功能操作相关快捷键配置
 * 预留给未来的功能快捷键
 */
export const functionShortcuts: ShortcutConfig[] = [
  // 示例：
  // {
  //   accelerator: 'Alt+R',
  //   description: '刷新壁纸',
  //   handler: () => {
  //     console.log('[Shortcut] 触发 Alt+R - 刷新壁纸');
  //     // 实现刷新壁纸的逻辑
  //   },
  // },
];

/**
 * 调试相关快捷键配置
 * 仅在开发模式下启用
 */
export const debugShortcuts: ShortcutConfig[] = [
  // 示例：
  // {
  //   accelerator: 'CommandOrControl+Shift+D',
  //   description: '打开调试工具',
  //   handler: () => {
  //     console.log('[Shortcut] 触发调试工具');
  //   },
  // },
];

/**
 * 获取所有快捷键配置
 * @param includeDebug 是否包含调试快捷键（默认为开发模式）
 */
export function getAllShortcuts(
  includeDebug = process.env.NODE_ENV === 'development',
): ShortcutConfig[] {
  const shortcuts = [...windowShortcuts, ...functionShortcuts];

  if (includeDebug) {
    shortcuts.push(...debugShortcuts);
  }

  return shortcuts;
}
