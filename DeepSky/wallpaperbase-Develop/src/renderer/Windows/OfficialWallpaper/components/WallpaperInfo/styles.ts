import { createStyles } from 'antd-style';

export const useWallpaperInfoStyles = createStyles(() => ({
  // 容器样式
  container: {
    marginBottom: 24,
  },

  // 标题样式
  title: {
    color: '#fff',
    marginBottom: 16,
  },

  // 内容区域样式
  content: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 8,
  },

  // 信息项样式
  infoItem: {
    marginBottom: 12,

    '&:last-child': {
      marginBottom: 0,
    },
  },

  // 标签样式
  infoLabel: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // 值样式
  infoValue: {
    color: '#ccc',
  },

  // 标签区域样式
  infoTags: {
    marginTop: 8,
    display: 'inline',
  },

  // 标签项样式
  tagItem: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    marginRight: 8,
    marginBottom: 4,
    display: 'inline-block',
  },
}));
