/**
 * 应用生命周期管理模块
 *
 * 负责：
 * - 应用事件监听（window-all-closed, before-quit, activate, will-quit, process.exit）
 * - 单实例锁定监听（second-instance）
 * - 资源清理（UE进程、鼠标监听、存储、托盘、WebSocket、aria2c、窗口池）
 * - 强制退出
 */

import { execSync } from 'child_process';
import { app } from 'electron';
import { inject, injectable } from 'inversify';
import type { IAppState } from '../core/interfaces';
import { TYPES } from '../container/identifiers';
import { Aria2Engine } from '../modules/download/managers/Aria2Engine';
import { getRTCChatManagerRef } from '../modules/rtc-chat/rtcChatManagerAccess';
import { getCleanupUEDownloader } from '../modules/window/ipc/cleanupUEDownloader';
import storeManager from '../modules/store/managers/StoreManager';
import { UEStateManager } from '../modules/ue-state/managers/UEStateManager';
import { wsService } from '../modules/websocket/core/ws-service';
import { logMain } from '../modules/logger';
import { mouseEventForwarder } from '../modules/mouse/MouseEventForwarder';
import { windowPool } from '../modules/window/pool/windowPool';

@injectable()
export class AppLifecycle {
  private ctx: IAppState;

  constructor(@inject(TYPES.AppState) ctx: IAppState) {
    this.ctx = ctx;
  }

  /**
   * 🔒 设置单实例锁定：防止应用多开
   * 当用户尝试打开第二个实例时，显示并聚焦主窗口
   */
  setupSingleInstanceLock(): void {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // 当用户尝试打开第二个实例时，显示并聚焦主窗口
      console.log('检测到尝试打开第二个实例，聚焦现有窗口');
      logMain.info('检测到尝试打开第二个实例');

      if (this.ctx.mainWindow) {
        // 如果窗口被隐藏或最小化，恢复显示
        if (this.ctx.mainWindow.isMinimized()) {
          this.ctx.mainWindow.restore();
        }
        if (!this.ctx.mainWindow.isVisible()) {
          this.ctx.mainWindow.show();
        }
        // 聚焦窗口
        this.ctx.mainWindow.focus();
      }
    });
  }

  /**
   * 设置应用事件监听器
   * @param onCreateWindow 当 macOS activate 时且无主窗口时调用的回调
   */
  setupAppEventListeners(onCreateWindow: () => void): void {
    // 所有窗口关闭事件 - 不要自动退出应用，保持托盘运行
    app.on('window-all-closed', () => {
      // 不执行任何操作，让应用保持在托盘中运行
    });

    // 应用退出前的清理工作
    app.on('before-quit', () => {
      console.log('📌 收到 before-quit 事件，开始清理资源...');
      this.cleanup();
    });

    // macOS 激活事件
    app.on('activate', () => {
      // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，重新创建窗口
      if (this.ctx.mainWindow === null) {
        onCreateWindow();
      }
    });

    // 🆕 监听进程退出事件（最后的保障）
    app.on('will-quit', async (event) => {
      console.log('📌 收到 will-quit 事件，执行最终清理...');
      // 确保清理逻辑被执行
      await this.cleanup();
    });

    // 🆕 监听进程退出事件（最后的最后保障，防止强制关闭时遗漏）
    process.on('exit', () => {
      console.log('📌 进程退出事件触发，强制清理 aria2c 进程...');
      // 同步执行，因为进程即将退出
      try {
        const platform = process.platform;
        if (platform === 'win32') {
          execSync('taskkill /F /IM aria2c.exe /T', { stdio: 'ignore' });
        } else if (platform === 'darwin' || platform === 'linux') {
          execSync('killall -9 aria2c', { stdio: 'ignore' });
        }
      } catch (error) {
        // 忽略错误，因为进程可能已经退出
      }
    });
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('开始清理应用程序资源...');

    // 🆕 首先停止所有嵌入的exe进程（最重要！）
    try {
      const ueManager = UEStateManager.getInstance();
      ueManager.stopAllEmbedders();
      console.log('✅ 所有嵌入的exe进程已停止');
    } catch (error) {
      console.error('❌ 停止嵌入的exe进程时出错:', error);
    }

    // 停止鼠标事件监听
    try {
      mouseEventForwarder.stop();
      console.log('鼠标事件监听器已停止');
    } catch (error) {
      console.error('停止鼠标事件监听器时出错:', error);
    }

    // 清理存储管理器
    try {
      storeManager.cleanup();
    } catch (error) {
      console.error('清理存储管理器时出错:', error);
    }

    // 清理托盘管理器
    if (this.ctx.trayManager) {
      this.ctx.trayManager.destroy();
      this.ctx.trayManager = null;
    }

    // 清理 RTC 聊天管理器，避免退出时 speaker 的 native 异步写入回调撞到失效 env
    try {
      const rtcManager = getRTCChatManagerRef();
      if (rtcManager) {
        rtcManager.destroySync();
        console.log('✅ RTCChatManager 已清理');
      }
    } catch (error) {
      console.error('❌ 清理 RTCChatManager 时出错:', error);
    }

    // 清理 WebSocket 服务和连接
    try {
      wsService.stop();
    } catch (error) {
      console.error('清理WebSocket服务时出错:', error);
    }

    // 🆕 清理UE下载器（取消下载并清理 aria2 进程）
    try {
      const cleanupUEDownloader = getCleanupUEDownloader();
      if (cleanupUEDownloader) {
        cleanupUEDownloader();
        console.log('✅ UE下载器资源已清理');
      }
    } catch (error) {
      console.error('❌ 清理UE下载器时出错:', error);
    }

    // 🆕 强制终止所有 aria2c 进程（防止遗留进程）
    try {
      await Aria2Engine.killAllAria2Processes();
      console.log('✅ 所有 aria2c 进程已清理');
    } catch (error) {
      console.error('❌ 清理 aria2c 进程时出错:', error);
    }

    // 强制关闭所有窗口
    try {
      windowPool.closeAll();
      windowPool.clear();
    } catch (error) {
      console.error('清理窗口池时出错:', error);
    }

    console.log('应用程序资源清理完成');
  }

  /**
   * 强制退出应用程序
   */
  forceQuit(): void {
    console.log('🚪 强制退出应用程序...');

    // 设置退出标志
    this.ctx.isQuitting = true;

    // 先清理资源（包括停止所有exe进程）
    this.cleanup();

    // 移除所有事件监听器以避免阻止退出
    app.removeAllListeners('window-all-closed');
    app.removeAllListeners('before-quit');

    // 强制关闭主窗口
    if (this.ctx.mainWindow && !this.ctx.mainWindow.isDestroyed()) {
      this.ctx.mainWindow.close();
    }

    // 🆕 多重保障机制：给予足够时间让exe进程被终止
    // stop() 方法会先尝试 SIGTERM（优雅关闭），5秒后再 SIGKILL（强制终止）
    // 所以这里等待 6 秒，确保exe进程有足够时间被完全终止
    setTimeout(() => {
      console.log('⏰ 第一阶段清理完成，准备退出...');
    }, 3000);

    setTimeout(() => {
      console.log('⏰ 第二阶段清理完成，准备退出...');
    }, 6000);

    // 最终退出（等待7秒，确保所有清理工作完成）
    setTimeout(() => {
      console.log('✅ 强制终止应用程序进程');
      app.exit(0);
    }, 7000);
  }
}
