import { proxy } from 'valtio';

// 预览模态框状态接口
interface PreviewStoreState {
  // 是否显示预览模态框
  isVisible: boolean;
  // 预览图片URL
  imageUrl: string;
  // 图片标题
  title: string;
  // 占位符文本
  placeholder: string;
}

// 创建全局预览状态
export const previewStore = proxy<PreviewStoreState>({
  isVisible: false,
  imageUrl: '',
  title: '',
  placeholder: '暂无图片',
});

// 预览操作方法
export const previewActions = {
  /**
   * 显示预览模态框
   */
  showPreview: (imageUrl: string, title?: string, placeholder?: string) => {
    console.log('🖼️ PreviewStore: 显示预览', {
      imageUrl: imageUrl.substring(0, 50) + '...',
      title,
    });

    previewStore.isVisible = true;
    previewStore.imageUrl = imageUrl;
    previewStore.title = title || '';
    previewStore.placeholder = placeholder || '暂无图片';
  },

  /**
   * 隐藏预览模态框
   */
  hidePreview: () => {
    console.log('🖼️ PreviewStore: 隐藏预览');

    previewStore.isVisible = false;
    previewStore.imageUrl = '';
    previewStore.title = '';
    previewStore.placeholder = '暂无图片';
  },

  /**
   * 更新预览信息
   */
  updatePreview: (updates: Partial<Omit<PreviewStoreState, 'isVisible'>>) => {
    console.log('🔄 PreviewStore: 更新预览信息', updates);

    if (updates.imageUrl !== undefined) {
      previewStore.imageUrl = updates.imageUrl;
    }
    if (updates.title !== undefined) {
      previewStore.title = updates.title;
    }
    if (updates.placeholder !== undefined) {
      previewStore.placeholder = updates.placeholder;
    }
  },

  /**
   * 获取当前预览状态
   */
  getPreviewState: () => {
    return {
      isVisible: previewStore.isVisible,
      imageUrl: previewStore.imageUrl,
      title: previewStore.title,
      placeholder: previewStore.placeholder,
    };
  },
};
