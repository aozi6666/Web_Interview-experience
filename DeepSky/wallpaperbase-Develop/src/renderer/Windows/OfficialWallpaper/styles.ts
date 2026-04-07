import { createStyles } from 'antd-style';

export const useOfficialWallpaperStyles = createStyles(({ css, token }) => ({
  // 全局样式重置
  globalReset: css`
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
    }
  `,

  // 主容器
  container: {
    width: '100%',
    height: 'calc(100vh - 32px)', // 减去WindowHeader的高度
    background: 'rgba(15, 15, 15, 1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 16,
    boxSizing: 'border-box',
  },

  // 推荐标题
  recommendTitle: {
    color: '#FFFFFF',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottom: '1px solid rgba(64, 64, 64, 0.8)',
  },

  // 壁纸网格容器
  wallpaperGrid: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 10,

    '&::-webkit-scrollbar': {
      width: 6,
    },

    '&::-webkit-scrollbar-track': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 3,
    },

    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 3,
    },

    '&::-webkit-scrollbar-thumb:hover': {
      background: 'rgba(255, 255, 255, 0.5)',
    },
  },

  // 网格容器
  gridContainer: {
    display: 'grid',
    gap: 8,
    paddingTop: 8,
    paddingLeft: 5,
    paddingRight: 5,
    minHeight: 0,
    width: '100%',
  },

  // 分页容器
  paginationContainer: {
    marginBottom: 20,
  },

  // 空状态
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,

    p: {
      marginBottom: 16,
    },

    button: {
      background: 'linear-gradient(135deg, #667eea, #764ba2) !important',
      border: 'none !important',
      color: 'white !important',
    },

    'button:hover': {
      background: 'linear-gradient(135deg, #5a6fd8, #6a4190) !important',
    },
  },

  // 壁纸卡片
  wallpaperCard: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#1a1a1a',
    cursor: 'pointer',

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      background: '#1a1a1a',
      transition: 'box-shadow 0.2s ease',
      pointerEvents: 'none',
      zIndex: -1,
    },

    '&:hover::before': {
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
    },
  },

  // 弹窗相关样式
  modal: {
    // 通用暗黑主题弹窗样式
    '.ant-modal-container': {
      background: '#2a2a2a !important',
    },

    '.ant-modal-content': {
      background: '#2a2a2a',
      border: '1px solid #333',
      color: '#fff',
    },

    '.ant-modal-header': {
     /* background: 'rgba(0, 0, 0, 0.2)',
      borderBottom: '1px solid #333',*/
    },

    '.ant-modal-title': {
      color: '#00d4aa',
      fontWeight: 600,
    },

    '.ant-modal-body': {
      background: '#2a2a2a',
      color: '#fff',
      maxHeight: '70vh',
      overflowY: 'auto',


    },

    '.ant-modal-footer': {
  /*    background: 'rgba(0, 0, 0, 0.2)',
      borderTop: '1px solid #333',*/
    },

    '.ant-modal-footer .ant-btn': {
      borderColor: '#555',
      background: '#444',
      color: '#fff',
    },

    '.ant-modal-footer .ant-btn:hover': {
      background: '#555',
      borderColor: '#666',
    },

    '.ant-modal-footer .ant-btn-primary': {
      background: '#00d4aa',
      borderColor: '#00d4aa',
    },

    '.ant-modal-footer .ant-btn-primary:hover': {
      background: '#00c499',
      borderColor: '#00c499',
    },

    '.ant-modal-close': {
      color: 'rgba(255, 255, 255, 0.8)',
    },

    '.ant-modal-close:hover': {
      color: '#fff',
    },

  },

  // 壁纸详情弹窗
  wallpaperDetailModal: {
    // 分块标题样式
    h3: {
      color: '#00d4aa',
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0, 212, 170, 0.3)',
      paddingBottom: 8,
    },

    // 输入框样式
    '.ant-input': {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid #555',
      color: '#fff',
    },

    '.ant-input:focus, .ant-input:hover': {
      borderColor: '#00d4aa',
    },

    '.ant-input::placeholder': {
      color: '#999',
    },

    // 标签样式
    tagItem: {
      background: 'rgba(0, 212, 170, 0.2)',
      color: '#00d4aa',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      marginRight: 8,
      marginBottom: 4,
      display: 'inline-block',
    },

    // 表单标签样式
    label: {
      color: '#00d4aa !important',
      fontSize: '12px !important',
      fontWeight: 'bold !important',
      marginBottom: '4px !important',
      display: 'block !important',
    },
  },

  // AI Agent配置区域样式
  aiAgentConfigGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,

    '.ant-input, .ant-input-affix-wrapper': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '.ant-input:focus, .ant-input:hover, .ant-input-affix-wrapper:focus, .ant-input-affix-wrapper:hover': {
      borderColor: '#00d4aa !important',
    },

    '.ant-input::placeholder': {
      color: '#999 !important',
    },
  },

  // ModelConfig 组件样式覆盖
  modelConfigContent: {
    '.ant-input, .ant-input-affix-wrapper, .ant-select-selector': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '.ant-input:focus, .ant-input:hover, .ant-input-affix-wrapper:focus, .ant-input-affix-wrapper:hover, .ant-select-selector:hover, .ant-select-focused .ant-select-selector': {
      borderColor: '#00d4aa !important',
    },

    '.ant-input::placeholder, .ant-select-selection-placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '.ant-select-selection-item': {
      color: '#fff !important',
    },

    '.ant-select-arrow': {
      color: 'rgba(255, 255, 255, 0.7) !important',
    },

    '.ant-select-dropdown': {
      background: '#2a2a2a !important',
      border: '1px solid #555 !important',
    },

    '.ant-select-dropdown .ant-select-item': {
      color: '#fff !important',
    },

    '.ant-select-dropdown .ant-select-item:hover': {
      background: 'rgba(255, 255, 255, 0.1) !important',
    },

    '.ant-select-dropdown .ant-select-item-option-selected': {
      background: 'rgba(0, 212, 170, 0.2) !important',
      color: '#00d4aa !important',
    },
  },

  // 创建壁纸弹窗内容样式
  createWallpaperModalContent: {
    maxHeight: '70vh',
    overflowY: 'auto',
    background: '#2a2a2a',
    color: '#fff',
    // 滚动条样式美化
    '&::-webkit-scrollbar': {
      width: 6,
    },

    '&::-webkit-scrollbar-track': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 3,
    },

    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 3,
    },

    '&::-webkit-scrollbar-thumb:hover': {
      background: 'rgba(255, 255, 255, 0.5)',
    },
  },

  // 全宽度字段
  fullWidthField: {
    gridColumn: '1 / -1',
  },
}));
