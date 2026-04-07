/**
 * AlertDialog 使用示例
 * 此文件展示了如何在渲染进程中创建和使用AlertDialog窗口
 */

import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


// AlertDialog配置接口
export interface AlertDialogConfig {
  message: string;           // 提示消息
  confirmText?: string;      // 确定按钮文本（默认："确定"）
  cancelText?: string;       // 取消按钮文本（默认："取消"）
  title?: string;           // 对话框标题（默认："提示"）
}

/**
 * 显示AlertDialog提示窗口 (Promise版本 - 推荐使用)
 * @param config 对话框配置
 * @returns Promise<'confirm' | 'cancel'> 用户选择的结果
 *
 * 使用示例:
 * const result = await showAlertDialog({
 *   message: '确定要删除吗？',
 *   confirmText: '删除',
 *   cancelText: '取消'
 * });
 *
 * if (result === 'confirm') {
 *   // 执行删除操作
 * }
 */
export async function showAlertDialog(config: AlertDialogConfig): Promise<'confirm' | 'cancel'> {
  try {
    const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_ALERT_DIALOG, config);
    return result;
  } catch (error) {
    console.error('显示AlertDialog失败:', error);
    throw error;
  }
}

/**
 * 显示确认对话框
 * @param message 提示消息
 * @param options 其他配置选项
 * @returns Promise<boolean> true表示确认，false表示取消
 */
export async function showConfirmDialog(
  message: string,
  options: Omit<AlertDialogConfig, 'message'> = {}
): Promise<boolean> {
  const result = await showAlertDialog({
    message,
    confirmText: '确定',
    cancelText: '取消',
    title: '确认',
    ...options,
  });

  return result === 'confirm';
}

/**
 * 显示错误提示对话框
 * @param message 错误消息
 * @param options 其他配置选项
 */
export async function showErrorDialog(
  message: string,
  options: Omit<AlertDialogConfig, 'message'> = {}
): Promise<void> {
  await showAlertDialog({
    message,
    confirmText: '知道了',
    title: '错误',
    ...options,
  });
}

/**
 * 显示成功提示对话框
 * @param message 成功消息
 * @param options 其他配置选项
 */
export async function showSuccessDialog(
  message: string,
  options: Omit<AlertDialogConfig, 'message'> = {}
): Promise<void> {
  await showAlertDialog({
    message,
    confirmText: '确定',
    title: '成功',
    ...options,
  });
}

// 使用示例
export const examples = {
  // 基本使用
  basic: async () => {
    const result = await showAlertDialog({
      message: '确定要执行此操作吗？',
    });

    if (result === 'confirm') {
      console.log('用户点击了确定');
    } else {
      console.log('用户点击了取消');
    }
  },

  // 自定义按钮文本
  customButtons: async () => {
    const result = await showAlertDialog({
      message: '文件已修改，是否保存？',
      confirmText: '保存',
      cancelText: '不保存',
      title: '保存确认',
    });

    if (result === 'confirm') {
      console.log('保存文件');
    } else {
      console.log('不保存文件');
    }
  },

  // 使用便捷函数
  convenienceFunctions: async () => {
    // 确认对话框
    const confirmed = await showConfirmDialog('确定要删除这个文件吗？');
    if (confirmed) {
      console.log('用户确认删除');
    }

    // 错误提示
    await showErrorDialog('操作失败，请重试！');

    // 成功提示
    await showSuccessDialog('操作成功完成！');
  },
};

// 导出默认函数
export default showAlertDialog;
