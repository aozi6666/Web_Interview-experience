/* eslint no-console: off, promise/always-return: off */
import 'reflect-metadata';

/**
 * Electron 主进程入口文件
 *
 * 本文件是应用的主入口，负责：
 * 1. 处理 Squirrel 安装事件
 * 2. 单实例锁定
 * 3. 创建和初始化主应用
 *
 * 主要逻辑已模块化到以下目录：
 * - app/          应用核心（配置、启动检测、主应用类）
 * - events/       事件处理（鼠标事件、全屏检测）
 * - Windows/      窗口管理
 * - WebSocket/    WebSocket 通信
 * - ipcMain/      IPC 通信处理
 * - StoreManager/ 数据存储管理
 * - TrayManager/  系统托盘管理
 * - ShortcutKeyManager/ 全局快捷键管理
 */

import { Application } from './app/Application';
import { Bootstrap } from './app/Bootstrap';
import { createContainer } from './container/createContainer';
import { TYPES } from './container/identifiers';

/**
 * 处理 Squirrel 启动事件
 * 防止在安装/更新/卸载时创建多余的桌面快捷方式
 */
const bootstrap = new Bootstrap();

// ==================== 创建主应用 ====================

/**
 * 创建并初始化主应用程序
 * Application 类封装了所有核心功能：
 * - 窗口管理
 * - 事件处理
 * - IPC 通信
 * - 生命周期管理
 */
const container = createContainer();
const application = container.get<Application>(TYPES.Application);

async function startApplication(): Promise<void> {
  const shouldExit = await bootstrap.handleSquirrelStartup();
  if (shouldExit) {
    return;
  }

  if (!bootstrap.ensureSingleInstanceLock()) {
    return;
  }

  await application.initialize();
}

startApplication().catch((error: unknown) => {
  console.error('[Main] 应用启动失败:', error);
});

// ==================== 导出 ====================

/**
 * 导出主应用实例以供其他模块使用
 */
export default application;
export { application as mainApp };
