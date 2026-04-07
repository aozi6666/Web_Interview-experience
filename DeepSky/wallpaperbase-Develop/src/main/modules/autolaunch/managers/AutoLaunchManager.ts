import { app } from 'electron';
import { autoLaunchConfigManager } from '../../store/managers/StoreManager';

/**
 * 自启动管理器
 * 使用 Electron 内置 API 管理开机自启动功能
 */
class AutoLaunchManager {
  private static instance: AutoLaunchManager | null = null;

  private isDebug: boolean;

  /** 记录是否为开机自启动 */
  private wasAutoStarted: boolean = false;

  private constructor() {
    this.isDebug =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true';
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AutoLaunchManager {
    if (!AutoLaunchManager.instance) {
      AutoLaunchManager.instance = new AutoLaunchManager();
    }
    return AutoLaunchManager.instance;
  }

  /**
   * 初始化自启动管理器
   * 同步本地配置和系统状态
   * 首次运行时默认启用开机自启动
   */
  initialize(): void {
    if (this.isDebug) {
      console.log('⭐ 初始化自启动管理器...');
    }

    // 读取本地配置
    const config = autoLaunchConfigManager.getAutoLaunchConfig();

    if (this.isDebug) {
      console.log('本地自启动配置:', config);
    }

    // 检测是否是首次运行（lastSyncTime === 0 表示从未同步过）
    const isFirstRun = config.lastSyncTime === 0;

    // 仅在打包后才能获取系统状态
    if (app.isPackaged) {
      try {
        // 读取系统状态
        const systemState = app.getLoginItemSettings();

        if (this.isDebug) {
          console.log('系统自启动状态:', systemState);
          console.log('是否首次运行:', isFirstRun);
        }

        // 首次运行时，默认启用开机自启动
        if (isFirstRun) {
          console.log('🚀 首次运行，默认启用开机自启动');
          this.enable();
          return;
        }

        // 如果状态不一致，应用本地配置到系统
        if (config.enabled !== systemState.openAtLogin) {
          console.log('检测到本地配置与系统状态不一致，应用本地配置到系统');
          if (config.enabled) {
            this.enable();
          } else {
            this.disable();
          }
        }
      } catch (error) {
        console.error('读取系统自启动状态失败:', error);
      }
    } else {
      console.log('⚠️  开发环境不支持实际注册自启动，仅更新本地配置');

      // 开发环境下，首次运行也更新配置状态
      if (isFirstRun) {
        autoLaunchConfigManager.updateAutoLaunchConfig({
          enabled: true,
          minimized: true,
        });
      }
    }

    if (this.isDebug) {
      console.log('✅ 自启动管理器初始化完成');
    }
  }

  /**
   * 启用自启动
   * 默认最小化启动到托盘
   */
  enable(): boolean {
    if (!app.isPackaged) {
      console.warn('⚠️  开发环境不支持自启动，仅更新配置');
      autoLaunchConfigManager.updateAutoLaunchConfig({
        enabled: true,
        minimized: true,
      });
      return false;
    }

    try {
      // Windows: 使用 args 参数传递 --hidden
      // macOS: 使用 openAsHidden
      const args = ['--hidden'];

      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true, // macOS
        args, // Windows
      });

      // 保存配置
      autoLaunchConfigManager.updateAutoLaunchConfig({
        enabled: true,
        minimized: true,
      });

      console.log('✅ 自启动已启用（最小化到托盘模式）');
      return true;
    } catch (error) {
      console.error('启用自启动失败:', error);
      return false;
    }
  }

  /**
   * 禁用自启动
   */
  disable(): boolean {
    if (!app.isPackaged) {
      console.warn('⚠️  开发环境不支持自启动，仅更新配置');
      autoLaunchConfigManager.updateAutoLaunchConfig({
        enabled: false,
      });
      return false;
    }

    try {
      app.setLoginItemSettings({
        openAtLogin: false,
      });

      // 保存配置
      autoLaunchConfigManager.updateAutoLaunchConfig({
        enabled: false,
      });

      console.log('❌ 自启动已禁用');
      return true;
    } catch (error) {
      console.error('禁用自启动失败:', error);
      return false;
    }
  }

  /**
   * 切换自启动状态
   */
  toggle(): boolean {
    const isCurrentlyEnabled = this.isEnabled();

    if (isCurrentlyEnabled) {
      return this.disable();
    }
    return this.enable();
  }

  /**
   * 获取当前自启动状态
   */
  isEnabled(): boolean {
    if (!app.isPackaged) {
      // 开发环境返回本地配置
      return autoLaunchConfigManager.isAutoLaunchEnabled();
    }

    try {
      // 生产环境返回系统实际状态
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin;
    } catch (error) {
      console.error('获取自启动状态失败:', error);
      // 降级到本地配置
      return autoLaunchConfigManager.isAutoLaunchEnabled();
    }
  }

  /**
   * 是否最小化启动
   * 始终返回 true（固定为最小化模式）
   */
  isMinimized(): boolean {
    // 固定返回 true，始终最小化启动
    return true;
  }

  /**
   * 设置是否最小化启动
   * 注意：当前版本固定为最小化，此方法保留以便未来扩展
   */
  setMinimized(minimized: boolean): boolean {
    if (!app.isPackaged) {
      autoLaunchConfigManager.setAutoLaunchMinimized(minimized);
      return false;
    }

    try {
      // 如果自启动已启用，重新设置以应用新配置
      const isCurrentlyEnabled = this.isEnabled();
      if (isCurrentlyEnabled) {
        const args = minimized ? ['--hidden'] : [];

        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: minimized,
          args,
        });

        autoLaunchConfigManager.setAutoLaunchMinimized(minimized);
        console.log(`✅ 启动模式已更新：${minimized ? '最小化' : '正常显示'}`);
        return true;
      }

      // 如果自启动未启用，仅更新配置
      autoLaunchConfigManager.setAutoLaunchMinimized(minimized);
      return false;
    } catch (error) {
      console.error('设置启动模式失败:', error);
      return false;
    }
  }

  /**
   * 从系统同步状态到本地配置
   */
  syncFromSystem(): void {
    if (!app.isPackaged) {
      console.log('开发环境无法同步系统状态');
      return;
    }

    try {
      const settings = app.getLoginItemSettings();

      autoLaunchConfigManager.updateAutoLaunchConfig({
        enabled: settings.openAtLogin,
        // minimized 保持不变，因为系统 API 无法可靠读取此信息
      });

      console.log('✅ 已从系统同步自启动状态:', settings.openAtLogin);
    } catch (error) {
      console.error('从系统同步状态失败:', error);
    }
  }

  /**
   * 获取配置信息（用于调试）
   */
  getConfig() {
    return {
      localConfig: autoLaunchConfigManager.getAutoLaunchConfig(),
      systemState: app.isPackaged ? app.getLoginItemSettings() : null,
      isPackaged: app.isPackaged,
    };
  }

  /**
   * 设置启动模式（开机自启 vs 手动启动）
   * 由主进程在启动时调用
   */
  setStartupMode(wasAutoStarted: boolean): void {
    this.wasAutoStarted = wasAutoStarted;
    console.log(
      `[AutoLaunchManager] 启动模式已设置: ${wasAutoStarted ? '开机自启' : '手动启动'}`,
    );
  }

  /**
   * 获取启动模式
   * @returns true = 开机自启，false = 手动启动
   */
  getStartupMode(): {
    isAutoStart: boolean;
    timestamp: number;
  } {
    return {
      isAutoStart: this.wasAutoStarted,
      timestamp: Date.now(),
    };
  }
}

export default AutoLaunchManager;
