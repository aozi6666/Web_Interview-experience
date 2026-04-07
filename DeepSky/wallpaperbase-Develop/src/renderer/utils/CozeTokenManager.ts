import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { getCozeToken } from '../api/requests/wallpaper';

const ipcEvents = getIpcEvents();

/**
 * Coze Token 管理器 (渲染进程)
 * 负责在渲染进程中获取和管理 Coze Token，并同步给主进程
 */
class CozeTokenManager {
  private cozeToken: string | null = null;
  private isFetching = false;
  private fetchPromise: Promise<string | null> | null = null;

  /**
   * 获取 Coze Token
   * @param forceRefresh 是否强制刷新，即使本地有 token
   * @returns Token 字符串或 null
   */
  async getToken(forceRefresh = false): Promise<string | null> {
    // 如果正在获取中，返回同一个 Promise
    if (this.isFetching && this.fetchPromise) {
      console.log('Token 正在获取中，等待现有请求完成...');
      return this.fetchPromise;
    }

    // 如果不强制刷新，先检查内存中是否有 token
    if (!forceRefresh && this.cozeToken) {
      console.log('使用内存中缓存的 Coze Token');
      return this.cozeToken;
    }

    // 开始新的获取请求
    this.isFetching = true;
    this.fetchPromise = this.doFetchToken();

    try {
      const token = await this.fetchPromise;
      return token;
    } finally {
      this.isFetching = false;
      this.fetchPromise = null;
    }
  }

  /**
   * 实际执行 token 获取的内部方法
   */
  private async doFetchToken(): Promise<string | null> {
    try {
      console.log('正在从服务器获取 Coze Token...');

      const response = await getCozeToken();

      // 检查响应是否有效
      if (response && response.code !== -1 && response.data) {
        const cozeToken = response.data.token || response.data;
        console.log('成功获取 Coze Token');

        // 保存到内存
        this.cozeToken = cozeToken;

        // 同步给主进程
        await this.syncToMainProcess(cozeToken);

        return cozeToken;
      }

      console.warn('服务器返回的数据无效或获取失败:', response);
      // 如果获取失败，返回内存中的 token（如果有的话）
      if (this.cozeToken) {
        console.log('使用内存中的 Token 作为降级方案');
        return this.cozeToken;
      }
      return null;
    } catch (error: any) {
      console.error('获取 Coze Token 失败:', error?.message || error);
      // 如果获取失败，返回内存中的 token（即使可能过期）
      if (this.cozeToken) {
        console.log('使用内存中的 Token 作为降级方案');
        return this.cozeToken;
      }
      return null;
    }
  }

  /**
   * 同步 Token 到主进程
   */
  private async syncToMainProcess(token: string): Promise<void> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_SET_COZE_TOKEN,
        token,
      );
      if (result.success) {
        console.log('Coze Token 已同步到主进程');
      } else {
        console.warn('同步 Coze Token 到主进程失败:', result.error);
      }
    } catch (error) {
      console.error('同步 Coze Token 到主进程异常:', error);
    }
  }

  /**
   * 初始化 Token
   * 在应用启动时调用，确保有可用的 token
   * 此方法不会抛出错误，确保不会影响应用启动
   */
  async initialize(): Promise<void> {
    console.log('初始化 Coze Token 管理器...');

    try {
      const token = await this.getToken();
      if (token) {
        console.log('Coze Token 初始化成功');
      } else {
        console.warn(
          'Coze Token 初始化失败，部分功能可能受限，但应用可正常使用',
        );
      }
    } catch (error) {
      console.error('Coze Token 管理器初始化异常:', error);
      // 静默处理错误，不影响应用启动
    }
  }

  /**
   * 清除 Token（用于登出等场景）
   */
  async clearToken(): Promise<void> {
    this.cozeToken = null;
    console.log('Coze Token 已清除（渲染进程）');

    // 同时清除主进程的 token
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_CLEAR_COZE_TOKEN,
      );
      console.log('Coze Token 已清除（主进程）');
    } catch (error) {
      console.error('清除主进程 Coze Token 失败:', error);
    }
  }

  /**
   * 获取当前 Token（同步方法）
   * 如果没有，返回 null
   */
  getCurrentToken(): string | null {
    return this.cozeToken;
  }
}

// 创建全局单例实例
const cozeTokenManager = new CozeTokenManager();

export default cozeTokenManager;
export { CozeTokenManager };
