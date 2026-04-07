import { proxy } from 'valtio';

/**
 * 全局进度提示组件使用说明：
 *
 * 1. 显示进度提示：
 *    globalProgressActions.show('正在加载...', 'loading');
 *
 * 2. 更新进度：
 *    globalProgressActions.updateProgress(50);
 *
 * 3. 设置成功状态：
 *    globalProgressActions.success('加载完成');
 *
 * 4. 设置失败状态：
 *    globalProgressActions.error('加载失败');
 *
 * 5. 手动隐藏：
 *    globalProgressActions.hide();
 *
 * 6. 重置状态：
 *    globalProgressActions.reset();
 */

export type ProgressStatus = 'loading' | 'success' | 'error';

export interface GlobalProgressInfo {
  /** 是否显示 */
  visible: boolean;
  /** 状态类型 */
  status: ProgressStatus;
  /** 提示文字 */
  message: string;
  /** 当前进度 (0-100) */
  progress: number;
  /** 是否自动消失 */
  autoHide: boolean;
  /** 自动消失延迟时间(毫秒) */
  autoHideDelay: number;
}

// 全局进度状态
export const globalProgressStore = proxy<GlobalProgressInfo>({
  visible: false,
  status: 'loading',
  message: '',
  progress: 0,
  autoHide: true,
  autoHideDelay: 1000,
});

// 全局进度操作方法
export const globalProgressActions = {
  /**
   * 显示进度提示
   */
  show: (message: string, status: ProgressStatus = 'loading', autoHide: boolean = true, autoHideDelay: number = 1000) => {
    globalProgressStore.visible = true;
    globalProgressStore.status = status;
    globalProgressStore.message = message;
    globalProgressStore.progress = 0;
    globalProgressStore.autoHide = autoHide;
    globalProgressStore.autoHideDelay = autoHideDelay;
  },

  /**
   * 隐藏进度提示
   */
  hide: () => {
    globalProgressStore.visible = false;
  },

  /**
   * 设置成功状态
   */
  success: (message?: string, autoHideDelay: number = 1000) => {
    globalProgressStore.status = 'success';
    globalProgressStore.progress = 100;
    if (message) {
      globalProgressStore.message = message;
    }
    globalProgressStore.autoHide = true;
    globalProgressStore.autoHideDelay = autoHideDelay;
  },

  /**
   * 设置失败状态
   */
  error: (message?: string, autoHideDelay: number = 1000) => {
    globalProgressStore.status = 'error';
    if (message) {
      globalProgressStore.message = message;
    }
    globalProgressStore.autoHide = true;
    globalProgressStore.autoHideDelay = autoHideDelay;
  },

  /**
   * 更新进度
   */
  updateProgress: (progress: number) => {
    globalProgressStore.progress = Math.max(0, Math.min(100, progress));
  },

  /**
   * 更新消息
   */
  updateMessage: (message: string) => {
    globalProgressStore.message = message;
  },

  /**
   * 重置状态
   */
  reset: () => {
    globalProgressStore.visible = false;
    globalProgressStore.status = 'loading';
    globalProgressStore.message = '';
    globalProgressStore.progress = 0;
    globalProgressStore.autoHide = true;
    globalProgressStore.autoHideDelay = 1000;
  },
};
