import { createStyles } from 'antd-style';

export const useWallPaperCardStyles = createStyles(() => ({
  // 卡片样式
  card: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#1a1a1a',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    width: '100%',
    display: 'block',

    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
    },

    '&:focus': {
      outline: '2px solid #00d4aa',
      outlineOffset: 2,
    },
  },

  // 图片容器样式
  imageContainer: {
    position: 'relative',
    paddingBottom: '56.25%', // 16:9 aspect ratio
    width: '100%',
    height: 0,
    overflow: 'hidden',
  },

  // 图片样式
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0,
    transition: 'opacity 0.3s',
  },

  imageLoaded: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 1,
    transition: 'opacity 0.3s',
  },

  // 加载占位符样式
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(45deg, #2a2a2a, #3a3a3a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: 14,
  },

  // 渐变遮罩样式
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
  },

  // 状态指示器样式
  statusIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(0, 212, 170, 0.9)',
    borderRadius: '50%',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    zIndex: 1,
  },

  // 菜单容器样式
  menuContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },

  // 菜单按钮样式
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 0.2s ease, background-color 0.2s ease',

    '&:hover': {
      background: 'rgba(0, 0, 0, 0.8)',
    },
  },

  // 菜单按钮显示样式（当卡片hover时）
  menuButtonVisible: {
    opacity: 1,
  },

  // 菜单下拉框样式
  menuDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'rgba(58, 58, 58, 0.95)',
    borderRadius: 8,
    padding: 4,
    minWidth: 80,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    backdropFilter: 'blur(10px)',
  },

  // 菜单项样式
  menuItem: {
    padding: '8px 12px',
    color: 'white',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 0.2s ease',
    borderRadius: 4,
    userSelect: 'none',

    '&:hover': {
      background: 'rgba(89, 89, 89, 0.8)',
    },
  },

  menuItemDelete: {
    color: '#FFFFFF',
    padding: 5,
    textAlign: 'center',
    '&:hover': {
      background: 'rgba(89, 89, 89, 0.6)',
    },
  },

  // 内容区域样式
  content: {
    padding: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    color: 'white',
  },

  // 标题样式
  title: {
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // 作者样式
  author: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}));
