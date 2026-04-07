import { createStyles } from 'antd-style';

export const useAIAgentConfigStyles = createStyles(() => ({
  // 容器样式
  container: {
    marginBottom: 24,
  },

  // 头部样式
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // 标题样式
  title: {
    margin: 0,
  },

  titleCreateMode: {
    color: '#fff',
  },

  titleDetailMode: {
    color: '#00d4aa',
  },

  // 内容区域样式
  content: {
    border: '1px solid #555',
    padding: 16,
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.02)',
  },

  // 网格布局样式
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },

  // 表单字段样式
  formField: {
    display: 'flex',
    flexDirection: 'column',
  },

  formFieldFullWidth: {
    gridColumn: 'span 2',
  },

  // 字段标签样式
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    display: 'block',
  },

  fieldLabelCreateMode: {
    color: '#fff',
  },

  fieldLabelDetailMode: {
    color: '#00d4aa',
  },

  fieldLabelRequired: {
    position: 'relative',
  },

  // 必填字段标记样式
  requiredMark: {
    color: '#ff4d4f',
    fontWeight: 'bold',
    marginLeft: 2,
  },

  // 输入框样式
  fieldInput: {
    background: 'rgba(255, 255, 255, 0.05) !important',
    border: '1px solid #555 !important',
    color: '#fff !important',
    borderRadius: 6,

    '&::placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },

    '&.ant-input': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '&.ant-input:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&.ant-input:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },
  },

  // 文本域样式
  fieldTextarea: {
    background: 'rgba(255, 255, 255, 0.05) !important',
    border: '1px solid #555 !important',
    color: '#fff !important',
    borderRadius: 6,

    '&::placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },

    '&.ant-input': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '&.ant-input:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&.ant-input:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },
  },

  // 错误状态样式
  fieldInputError: {
    borderColor: '#ff4d4f !important',
    background: 'rgba(255, 77, 79, 0.1) !important',
  },

  fieldTextareaError: {
    borderColor: '#ff4d4f !important',
    background: 'rgba(255, 77, 79, 0.1) !important',
  },

  // 错误消息样式
  errorMessage: {
    color: '#ff4d4f',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 1.2,
  },

  // URL输入容器样式
  urlInputContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },

  // URL输入框样式
  urlInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.05) !important',
    border: '1px solid #555 !important',
    color: '#fff !important',
    borderRadius: 6,

    '&::placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },

    '&.ant-input': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '&.ant-input:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&.ant-input:focus': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
    },
  },

  // Switch容器样式
  switchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  // Switch标签样式
  switchLabel: {
    color: '#fff',
    fontSize: 14,
  },
}));
