/**
 * 自启动相关 IPC 处理器
 */

import { IPCChannels } from '@shared/channels';
import { createIPCRegistrar, mainHandle } from '../../../ipc-events';
import { logMain } from '../../logger';
import AutoLaunchManager from '../managers/AutoLaunchManager';

/**
 * 注册自启动相关的 IPC 处理器
 */
export function registerAutoLaunchHandlers(): void {
  const manager = AutoLaunchManager.getInstance();

  // 获取自启动状态
  mainHandle(IPCChannels.AUTO_LAUNCH_GET_STATUS, () => {
    try {
      return {
        success: true,
        data: {
          enabled: manager.isEnabled(),
          minimized: manager.isMinimized(),
        },
      };
    } catch (error) {
      logMain.error('获取自启动状态失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取状态失败',
      };
    }
  });

  // 启用自启动（固定最小化模式）
  mainHandle(IPCChannels.AUTO_LAUNCH_ENABLE, () => {
    try {
      const result = manager.enable();
      return {
        success: true,
        data: {
          enabled: result,
          message: result
            ? '自启动已启用（最小化到托盘）'
            : '开发环境仅更新配置',
        },
      };
    } catch (error) {
      logMain.error('启用自启动失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '启用失败',
      };
    }
  });

  // 禁用自启动
  mainHandle(IPCChannels.AUTO_LAUNCH_DISABLE, () => {
    try {
      const result = manager.disable();
      return {
        success: true,
        data: {
          disabled: result,
          message: result ? '自启动已禁用' : '开发环境仅更新配置',
        },
      };
    } catch (error) {
      logMain.error('禁用自启动失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '禁用失败',
      };
    }
  });

  // 切换自启动状态
  mainHandle(IPCChannels.AUTO_LAUNCH_TOGGLE, () => {
    try {
      const result = manager.toggle();
      const isEnabled = manager.isEnabled();
      return {
        success: true,
        data: {
          enabled: isEnabled,
          toggled: result,
          message: isEnabled ? '自启动已启用' : '自启动已禁用',
        },
      };
    } catch (error) {
      logMain.error('切换自启动状态失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '切换失败',
      };
    }
  });

  // 设置是否最小化启动（保留接口，当前固定为 true）
  mainHandle(
    IPCChannels.AUTO_LAUNCH_SET_MINIMIZED,
    (event, minimized: boolean) => {
      try {
        const result = manager.setMinimized(minimized);
        return {
          success: true,
          data: {
            updated: result,
            minimized: manager.isMinimized(),
            message: result
              ? `启动模式已更新：${minimized ? '最小化' : '正常显示'}`
              : '配置已保存',
          },
        };
      } catch (error) {
        logMain.error('设置启动模式失败', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : '设置失败',
        };
      }
    },
  );

  // 获取配置信息（用于调试）
  mainHandle(IPCChannels.AUTO_LAUNCH_GET_CONFIG, () => {
    try {
      return {
        success: true,
        data: manager.getConfig(),
      };
    } catch (error) {
      logMain.error('获取配置信息失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取配置失败',
      };
    }
  });

  // 检查启动模式（开机自启 vs 手动启动）
  mainHandle(IPCChannels.CHECK_STARTUP_MODE, () => {
    try {
      const result = manager.getStartupMode();
      logMain.info('渲染进程查询启动模式', { result });
      return result;
    } catch (error) {
      logMain.error('查询启动模式失败', { error });
      return {
        isAutoStart: false,
        timestamp: Date.now(),
      };
    }
  });

  logMain.info('自启动 IPC 处理器注册完成');
}

export const registerAutoLaunchIPCHandlers = createIPCRegistrar(() => {
  registerAutoLaunchHandlers();
});
