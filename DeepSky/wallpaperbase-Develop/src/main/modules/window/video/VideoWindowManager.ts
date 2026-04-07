import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { BrowserWindow } from 'electron';
import { MainIpcEvents } from '../../../ipc-events/MainIpcEvents';
import { SetWindowPos } from '../../../koffi/user32';
import {
  setDynamicWallpaperAsync,
  switchDynamicWallpaperScreen,
} from '../../wallpaper/setDynamicWallpaper';
import { getScreenManager } from '../../screen/managers/ScreenManager';
import { getDynamicWallpaperManager } from '../../wallpaper/managers/DynamicWallpaperManager';
import { createVideoWindow } from '../factory/createWindows';
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const HWND_TOP = 0;

/**
 * 统一的视频窗口管理器
 * 避免 ipcMain 和 TrayManager 创建多个窗口实例
 */
class VideoWindowManager {
  private static instance: VideoWindowManager;

  private videoWindow: BrowserWindow | null = null;

  private isWallpaperEnabled = false;

  private windowHandle: number | null = null;

  // 🆕 壁纸ID，用于管理和切换屏幕
  private wallpaperId: string | null = null;

  // 🆕 当前嵌入的屏幕ID
  private currentScreenId: string | null = null;

  // 过渡期黑场 CSS key（由 webContents.insertCSS 返回）
  private transitionBlackoutCssKey: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): VideoWindowManager {
    if (!VideoWindowManager.instance) {
      VideoWindowManager.instance = new VideoWindowManager();
    }
    return VideoWindowManager.instance;
  }

  /**
   * 设置动态壁纸
   * 🔧 不再需要传入 screenId，统一由 ScreenManager 管理
   * @param filePath 视频文件路径
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async setWallpaper(
    filePath: string,
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      if (process.platform !== 'win32') {
        return { success: false, error: '动态壁纸功能仅支持Windows系统' };
      }

      console.log(`[VideoWindowManager] 设置视频壁纸: ${filePath}`);

      // 检查当前窗口状态，如果窗口被销毁了，重置为null
      if (this.videoWindow && this.videoWindow.isDestroyed()) {
        console.log('检测到视频窗口已被销毁，重置窗口引用');
        this.videoWindow = null;
        this.isWallpaperEnabled = false;
        this.windowHandle = null;
        this.wallpaperId = null; // 🆕 清理壁纸ID
        this.currentScreenId = null; // 🆕 清理屏幕ID
      }

      // 如果窗口不存在，创建新窗口（createVideoWindow已有单例检查）
      if (!this.videoWindow) {
        this.videoWindow = createVideoWindow();

        this.videoWindow.on('closed', () => {
          this.videoWindow = null;
          this.isWallpaperEnabled = false;
          this.windowHandle = null;
          this.wallpaperId = null; // 🆕 清理壁纸ID
          this.currentScreenId = null; // 🆕 清理屏幕ID
        });

        console.log('创建视频窗口成功:', {
          id: this.videoWindow.id,
          isVisible: this.videoWindow.isVisible(),
          isDestroyed: this.videoWindow.isDestroyed(),
        });

        // 等待窗口准备就绪后再设置动态壁纸
        return new Promise((resolve) => {
          this.videoWindow!.once('ready-to-show', () => {
            try {
              const handle =
                this.videoWindow!.getNativeWindowHandle().readInt32LE(0);
              console.log(
                '统一窗口管理器设置动态壁纸，窗口句柄:',
                handle,
                '(屏幕由 ScreenManager 管理)',
              );

              // 保存窗口句柄供鼠标事件转发使用
              this.windowHandle = handle;

              // 🆕 使用异步版本（由 ScreenManager 管理目标屏幕）
              setDynamicWallpaperAsync(handle, 'video')
                .then((wpId) => {
                  if (wpId) {
                    this.wallpaperId = wpId;

                    // 🆕 从 DynamicWallpaperManager 获取实际使用的屏幕ID
                    const manager = getDynamicWallpaperManager();
                    const wallpaperInfo = manager?.getWallpaperInfo(wpId);

                    if (wallpaperInfo) {
                      this.currentScreenId = wallpaperInfo.screenId;
                      console.log(
                        '✅ setDynamicWallpaper 成功，壁纸ID:',
                        wpId,
                        '实际屏幕:',
                        this.currentScreenId,
                      );
                    } else {
                      this.currentScreenId = null;
                      console.log(
                        '✅ setDynamicWallpaper 成功，壁纸ID:',
                        wpId,
                        '屏幕: auto',
                      );
                    }
                  } else {
                    console.error('❌ setDynamicWallpaper 失败');
                  }
                })
                .catch((error) => {
                  console.error('❌ setDynamicWallpaper 异常:', error);
                });

              // 为了保持与旧版兼容，立即认为成功
              const success = true;
              console.log('setDynamicWallpaper启动结果:', success);

              if (success) {
                // 显示窗口
                this.videoWindow!.show();
                this.ensureVideoWindowTopLayer();
                console.log('窗口已显示，等待渲染进程准备就绪...');

                // 检查渲染进程状态
                const { webContents } = this.videoWindow!;
                console.log('WebContents状态:', {
                  isLoading: webContents.isLoading(),
                  isLoadingMainFrame: webContents.isLoadingMainFrame(),
                  isWaitingForResponse: webContents.isWaitingForResponse(),
                  getURL: webContents.getURL(),
                });

                // 等待渲染进程准备就绪
                let rendererReadyHandled = false;
                const rendererReadyHandler = () => {
                  if (rendererReadyHandled) return;
                  rendererReadyHandled = true;

                  console.log('[1] ✅ 开始发送文件路径给渲染进程');
                  if (this.videoWindow && !this.isWallpaperEnabled) {
                    console.log('[1] 📤 发送文件路径:', filePath);

                    try {
                      // 检查窗口和webContents状态
                      if (this.videoWindow.isDestroyed()) {
                        console.error('[1] ❌ 窗口已被销毁');
                        resolve({ success: false, error: '窗口已被销毁' });
                        return;
                      }

                      const { webContents: wc } = this.videoWindow;
                      if (wc.isDestroyed()) {
                        console.error('[1] ❌ WebContents已被销毁');
                        resolve({
                          success: false,
                          error: 'WebContents已被销毁',
                        });
                        return;
                      }

                      console.log('[1] 🚀 通过EventCenter发送文件路径...');
                      MainIpcEvents.getInstance().emitTo(
                        WindowName.VIDEO,
                        IPCChannels.GET_FILE_PATH,
                        filePath,
                      );
                      console.log('[1] ✅ 文件路径发送成功');

                      this.isWallpaperEnabled = true;
                      resolve({ success: true, message: '动态壁纸设置成功' });
                    } catch (error) {
                      console.error('[1] ❌ 发送文件路径时发生异常:', error);
                      resolve({
                        success: false,
                        error: `发送文件路径失败: ${(error as Error).message}`,
                      });
                    }
                  } else {
                    console.log('[1] ⚠️ 跳过发送:', {
                      hasWindow: !!this.videoWindow,
                      isWallpaperEnabled: this.isWallpaperEnabled,
                    });
                  }
                };

                // 监听DOM准备和加载完成事件
                webContents.once('dom-ready', () => {
                  console.log('📄 DOM ready 事件触发');
                  // DOM准备好后，等待一小段时间让React组件完全初始化
                  setTimeout(rendererReadyHandler, 300);
                });

                // 备用：监听did-finish-load事件
                webContents.once('did-finish-load', () => {
                  console.log('✅ did-finish-load 事件触发');
                  console.log('当前页面URL:', webContents.getURL());
                  // 如果DOM ready没有触发，在这里处理
                  setTimeout(() => {
                    if (!rendererReadyHandled) {
                      rendererReadyHandler();
                    }
                  }, 500);
                });

                webContents.once(
                  'did-fail-load',
                  (event, errorCode, errorDescription, validatedURL) => {
                    console.error('❌ 页面加载失败:', {
                      errorCode,
                      errorDescription,
                      validatedURL,
                    });
                  },
                );

                webContents.once(
                  'did-frame-finish-load',
                  (event, isMainFrame) => {
                    console.log('🖼️ 框架加载完成:', {
                      isMainFrame,
                      url: webContents.getURL(),
                    });
                  },
                );

                // 如果页面已经加载完成，等待一小段时间让渲染进程完全准备好
                if (!webContents.isLoading()) {
                  console.log('⚡ 页面已加载完成，等待渲染进程准备...');
                  setTimeout(() => {
                    if (!rendererReadyHandled) {
                      console.log(
                        '🔄 页面已加载但未收到准备信号，尝试发送路径',
                      );
                      rendererReadyHandler();
                    }
                  }, 500);
                }

                // 添加超时处理
                setTimeout(() => {
                  if (!rendererReadyHandled) {
                    console.warn('⏰ 渲染进程准备超时，强制发送路径');
                    console.log('超时时WebContents状态:', {
                      isLoading: webContents.isLoading(),
                      isDestroyed: webContents.isDestroyed(),
                      getURL: webContents.getURL(),
                    });
                    rendererReadyHandler();
                  }
                }, 5000); // 增加到5秒超时
              } else {
                console.error('无法将窗口嵌入桌面');
                this.videoWindow!.close();
                resolve({ success: false, error: '无法将窗口嵌入桌面' });
              }
            } catch (error) {
              console.error('设置动态壁纸失败:', error);
              if (this.videoWindow) {
                this.videoWindow.close();
              }
              resolve({
                success: false,
                error: `设置动态壁纸时发生错误: ${(error as Error).message}`,
              });
            }
          });
        });
      }

      // 窗口已存在，直接更新文件路径
      console.log('[1] 窗口已存在，更新文件路径:', filePath);

      // 检查窗口和webContents状态
      if (!this.videoWindow) {
        console.error('[2] 错误：窗口引用为null');
        return { success: false, error: '窗口引用丢失' };
      }

      if (this.videoWindow.isDestroyed()) {
        console.error('[3] 错误：窗口已被销毁');
        this.videoWindow = null;
        this.isWallpaperEnabled = false;
        this.windowHandle = null;
        this.wallpaperId = null; // 🆕 清理壁纸ID
        this.currentScreenId = null; // 🆕 清理屏幕ID
        return { success: false, error: '窗口已被销毁' };
      }

      const { webContents } = this.videoWindow;
      console.log('[4] WebContents状态:', {
        isDestroyed: webContents.isDestroyed(),
        isLoading: webContents.isLoading(),
        getURL: webContents.getURL(),
      });

      if (webContents.isDestroyed()) {
        console.error('[5] 错误：WebContents已被销毁');
        return { success: false, error: 'WebContents已被销毁' };
      }

      // 复用窗口时，若之前被隐藏，则先恢复显示
      if (!this.videoWindow.isVisible()) {
        await this.showWindow();
      } else {
        this.ensureVideoWindowTopLayer();
      }

      console.log('[6] 准备发送文件路径...');
      try {
        MainIpcEvents.getInstance().emitTo(
          WindowName.VIDEO,
          IPCChannels.GET_FILE_PATH,
          filePath,
        );
        console.log('[7] ✅ 文件路径已发送成功');
        return { success: true, message: '文件路径已更新' };
      } catch (error) {
        console.error('[8] ❌ 发送文件路径失败:', error);
        return {
          success: false,
          error: `发送文件路径失败: ${(error as Error).message}`,
        };
      }
    } catch (error) {
      console.error('setWallpaper处理失败:', error);
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 移除动态壁纸
   * 先清理视频资源，再关闭壁纸窗口
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async removeWallpaper(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      if (!this.videoWindow) {
        return { success: false, error: '当前没有启用动态壁纸' };
      }

      console.log('移除动态壁纸，清理视频资源并隐藏窗口...');

      // 1. 先通知渲染进程清理视频资源（通过设置空路径触发清理）
      if (!this.videoWindow.isDestroyed()) {
        try {
          console.log('发送空路径以触发视频资源清理');
          MainIpcEvents.getInstance().emitTo(
            WindowName.VIDEO,
            IPCChannels.GET_FILE_PATH,
            '',
          );

          // 等待短暂时间确保 video.pause()/load() 完成，再隐藏窗口
          await new Promise((resolve) => setTimeout(resolve, 120));
          console.log('视频资源清理等待完成');
        } catch (error) {
          console.warn('发送清理消息失败，但继续隐藏窗口:', error);
        }
      }

      // 2. 隐藏窗口而不是销毁，避免下次切换重新创建窗口
      console.log('隐藏动态壁纸窗口');

      if (this.videoWindow && !this.videoWindow.isDestroyed()) {
        this.videoWindow.hide();
      }

      this.isWallpaperEnabled = false;

      console.log('动态壁纸窗口已隐藏（可复用）');
      return { success: true, message: '动态壁纸移除成功（窗口已隐藏）' };
    } catch (error) {
      console.error('removeWallpaper处理失败:', error);
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 停止动态壁纸并关闭窗口
   */
  stopWallpaper(): void {
    if (this.videoWindow) {
      this.videoWindow.close();
      this.videoWindow = null;
    }
    this.isWallpaperEnabled = false;
    this.windowHandle = null;
    this.wallpaperId = null; // 🆕 清理壁纸ID
    this.currentScreenId = null; // 🆕 清理屏幕ID
  }

  /**
   * 获取窗口状态
   */
  isEnabled(): boolean {
    // 检查窗口是否真的存在且未被销毁
    if (this.videoWindow && this.videoWindow.isDestroyed()) {
      this.videoWindow = null;
      this.isWallpaperEnabled = false;
      this.windowHandle = null;
      this.wallpaperId = null; // 🆕 清理壁纸ID
      this.currentScreenId = null; // 🆕 清理屏幕ID
      this.transitionBlackoutCssKey = null;
    }
    return this.isWallpaperEnabled && this.videoWindow !== null;
  }

  /**
   * 获取窗口实例（用于外部状态管理）
   */
  getWindow(): BrowserWindow | null {
    // 检查窗口状态，如果窗口被销毁了，重置为null
    if (this.videoWindow && this.videoWindow.isDestroyed()) {
      console.log('检测到视频窗口已被销毁，重置窗口引用');
      this.videoWindow = null;
      this.isWallpaperEnabled = false;
      this.windowHandle = null;
      this.wallpaperId = null; // 🆕 清理壁纸ID
      this.currentScreenId = null; // 🆕 清理屏幕ID
      this.transitionBlackoutCssKey = null;
    }
    return this.videoWindow;
  }

  /**
   * 过渡期黑场：覆盖视频内容，避免 reEmbed 期间暴露视频帧
   */
  async startTransitionBlackout(): Promise<void> {
    const win = this.getWindow();
    if (!win || win.webContents.isDestroyed()) {
      return;
    }

    try {
      if (this.transitionBlackoutCssKey) {
        return;
      }
      this.transitionBlackoutCssKey = await win.webContents.insertCSS(
        'html::after{content:"";position:fixed;inset:0;background:#000;z-index:2147483647;pointer-events:none;}',
      );
      console.log('[VideoWindowManager] 过渡黑场已启用');
    } catch (error) {
      console.warn('[VideoWindowManager] 启用过渡黑场失败:', error);
      this.transitionBlackoutCssKey = null;
    }
  }

  /**
   * 移除过渡期黑场遮罩
   */
  async endTransitionBlackout(): Promise<void> {
    const cssKey = this.transitionBlackoutCssKey;
    this.transitionBlackoutCssKey = null;
    if (!cssKey) {
      return;
    }

    const win = this.getWindow();
    if (!win || win.webContents.isDestroyed()) {
      return;
    }

    try {
      await win.webContents.removeInsertedCSS(cssKey);
      console.log('[VideoWindowManager] 过渡黑场已移除');
    } catch (error) {
      console.warn('[VideoWindowManager] 移除过渡黑场失败:', error);
    }
  }

  /**
   * 获取壁纸窗口句柄（用于鼠标事件转发）
   * @returns 窗口句柄，如果窗口不存在则返回null
   */
  getWindowHandle(): number | null {
    // 检查窗口状态
    if (this.videoWindow && this.videoWindow.isDestroyed()) {
      this.videoWindow = null;
      this.isWallpaperEnabled = false;
      this.windowHandle = null;
      this.wallpaperId = null; // 🆕 清理壁纸ID
      this.currentScreenId = null; // 🆕 清理屏幕ID
    }
    return this.windowHandle;
  }

  /**
   * 显示视频窗口
   * 🔧 修复：恢复时重新设置正确的坐标，解决一横一竖屏幕下的偏移问题
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async showWindow(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      // 检查窗口状态
      if (this.videoWindow && this.videoWindow.isDestroyed()) {
        console.log('检测到视频窗口已被销毁，重置窗口引用');
        this.videoWindow = null;
        this.isWallpaperEnabled = false;
        this.windowHandle = null;
        this.wallpaperId = null;
        this.currentScreenId = null;
      }

      if (!this.videoWindow) {
        return {
          success: false,
          error: '视频窗口不存在，请先设置壁纸',
        };
      }

      if (this.videoWindow.isVisible()) {
        return {
          success: true,
          message: '视频窗口已经是显示状态',
        };
      }

      // 🆕 关键修复：在显示前锁定位置
      if (this.wallpaperId && this.windowHandle) {
        console.log('[VideoWindowManager] 📍 显示前锁定位置...');

        const screenManager = getScreenManager();
        const targetScreenId = screenManager.getEffectiveTargetScreen();

        const position = screenManager.getScreenLocalPosition(
          targetScreenId || undefined,
        );

        if (position) {
          const { x, y, width, height } = position;

          const SWP_NOZORDER = 0x0004;
          const SWP_NOACTIVATE = 0x0010;
          const SWP_SHOWWINDOW = 0x0040;
          const flags = SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW;

          // 显示前设置位置
          console.log('[VideoWindowManager] 📍 第1次设置位置（显示前）');
          SetWindowPos(this.windowHandle, 0, x, y, width, height, flags);

          // 调用 Electron 的 show
          this.videoWindow.show();
          this.ensureVideoWindowTopLayer();

          // 显示后立即再次设置
          console.log('[VideoWindowManager] 📍 第2次设置位置（显示后）');
          SetWindowPos(this.windowHandle, 0, x, y, width, height, flags);

          // 延迟后再次设置
          await new Promise((resolve) => setTimeout(resolve, 50));
          console.log('[VideoWindowManager] 📍 第3次设置位置（延迟后）');
          SetWindowPos(this.windowHandle, 0, x, y, width, height, flags);

          // 验证位置
          await new Promise((resolve) => setTimeout(resolve, 50));
          const isCorrect = screenManager.verifyWindowPosition(
            this.windowHandle,
            { x, y, width, height },
          );

          if (!isCorrect) {
            console.warn('[VideoWindowManager] ⚠️ 位置仍不正确，最后一次修正');
            SetWindowPos(this.windowHandle, 0, x, y, width, height, flags);
          }

          this.currentScreenId = position.screenId;
          console.log('[VideoWindowManager] ✅ 位置锁定完成');
        } else {
          console.error('[VideoWindowManager] ❌ 获取屏幕位置失败');
          // 没有位置信息，直接显示
          this.videoWindow.show();
          this.ensureVideoWindowTopLayer();
        }
      } else {
        // 没有壁纸ID，直接显示
        this.videoWindow.show();
        this.ensureVideoWindowTopLayer();
      }

      console.log('[VideoWindowManager] 视频窗口已显示');

      return {
        success: true,
        message: '视频窗口显示成功',
      };
    } catch (error) {
      console.error('[VideoWindowManager] 显示视频窗口失败:', error);
      return {
        success: false,
        error: `显示视频窗口时发生错误: ${(error as Error).message}`,
      };
    }
  }

  private ensureVideoWindowTopLayer(): void {
    try {
      if (!this.windowHandle) {
        return;
      }
      SetWindowPos(
        this.windowHandle,
        HWND_TOP,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
      );
    } catch (error) {
      console.warn('[VideoWindowManager] 置顶视频壁纸窗口失败:', error);
    }
  }

  /**
   * 隐藏视频窗口
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async hideWindow(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      // 检查窗口状态
      if (this.videoWindow && this.videoWindow.isDestroyed()) {
        console.log('检测到视频窗口已被销毁，重置窗口引用');
        this.videoWindow = null;
        this.isWallpaperEnabled = false;
        this.windowHandle = null;
        this.wallpaperId = null; // 🆕 清理壁纸ID
        this.currentScreenId = null; // 🆕 清理屏幕ID
      }

      if (!this.videoWindow) {
        return {
          success: false,
          error: '视频窗口不存在',
        };
      }

      if (!this.videoWindow.isVisible()) {
        return {
          success: true,
          message: '视频窗口已经是隐藏状态',
        };
      }

      this.videoWindow.hide();
      console.log('视频窗口已隐藏');

      return {
        success: true,
        message: '视频窗口隐藏成功',
      };
    } catch (error) {
      console.error('隐藏视频窗口失败:', error);
      return {
        success: false,
        error: `隐藏视频窗口时发生错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 🆕 切换视频壁纸到指定屏幕
   * @param screenId 目标屏幕ID
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async switchScreen(
    screenId: string,
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      if (!this.wallpaperId) {
        return {
          success: false,
          error: '没有活动的壁纸，请先设置壁纸',
        };
      }

      if (!this.isWallpaperEnabled) {
        return {
          success: false,
          error: '壁纸未启用',
        };
      }

      console.log(`[VideoWindowManager] 切换视频壁纸到屏幕: ${screenId}`);

      const success = await switchDynamicWallpaperScreen(
        this.wallpaperId,
        screenId,
      );

      if (success) {
        this.currentScreenId = screenId;
        console.log(`[VideoWindowManager] ✅ 成功切换到屏幕: ${screenId}`);
        return {
          success: true,
          message: `视频壁纸已切换到屏幕: ${screenId}`,
        };
      }

      console.error(`[VideoWindowManager] ❌ 切换屏幕失败: ${screenId}`);
      return {
        success: false,
        error: '切换屏幕失败',
      };
    } catch (error) {
      console.error('[VideoWindowManager] 切换屏幕异常:', error);
      return {
        success: false,
        error: `切换屏幕时发生错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 🆕 获取当前视频壁纸的屏幕ID
   * @returns 屏幕ID 或 null
   */
  getCurrentScreenId(): string | null {
    return this.currentScreenId;
  }

  /**
   * 🆕 获取壁纸ID
   * @returns 壁纸ID 或 null
   */
  getWallpaperId(): string | null {
    return this.wallpaperId;
  }

  /**
   * 🆕 完全销毁视频窗口（用于 UE 启动时）
   * 相比 hideWindow，这会真正销毁窗口，避免 Electron 缓存问题
   * 渲染进程会在 UE 退出后主动调用 setWallpaper 重新创建窗口
   * @returns Promise<{success: boolean, error?: string, message?: string}>
   */
  async destroyWindow(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      console.log('[VideoWindowManager] 🗑️ 开始销毁视频窗口...');

      // 检查窗口是否存在
      if (!this.videoWindow) {
        console.log('[VideoWindowManager] 窗口不存在，无需销毁');
        return {
          success: true,
          message: '窗口不存在，无需销毁',
        };
      }

      // 检查窗口是否已被销毁
      if (this.videoWindow.isDestroyed()) {
        console.log('[VideoWindowManager] 窗口已被销毁');
        this.videoWindow = null;
        this.isWallpaperEnabled = false;
        this.windowHandle = null;
        this.wallpaperId = null;
        this.currentScreenId = null;
        return {
          success: true,
          message: '窗口已被销毁',
        };
      }

      // 🔧 关键：完全销毁窗口，而不是隐藏
      console.log('[VideoWindowManager] 正在销毁窗口...');
      this.videoWindow.destroy();

      // 清理所有状态
      this.videoWindow = null;
      this.isWallpaperEnabled = false;
      this.windowHandle = null;
      this.wallpaperId = null;
      this.currentScreenId = null;

      console.log('[VideoWindowManager] ✅ 视频窗口已完全销毁');

      return {
        success: true,
        message: '视频窗口已完全销毁',
      };
    } catch (error) {
      console.error('[VideoWindowManager] 销毁视频窗口失败:', error);
      return {
        success: false,
        error: `销毁视频窗口时发生错误: ${(error as Error).message}`,
      };
    }
  }
}

export default VideoWindowManager;
