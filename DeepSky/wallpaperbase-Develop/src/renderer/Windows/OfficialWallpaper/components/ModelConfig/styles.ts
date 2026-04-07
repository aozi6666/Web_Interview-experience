import { createStyles } from 'antd-style';

export const useModelConfigStyles = createStyles(() => ({
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
    color: '#fff',
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

  // 一行多个字段的容器
  formFieldRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-end',
  },

  // 行内字段样式
  formFieldInRow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  switch: {
    width: 80,
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

  // 选择器样式
  fieldSelect: {
    background: 'rgba(255, 255, 255, 0.05) !important',
    border: '1px solid #555 !important',
    color: '#fff !important',

    '&:hover': {
      borderColor: '#666 !important',
    },

    '&.ant-select-focused .ant-select-selector': {
      borderColor: '#00d4aa !important',
      boxShadow: '0 0 0 2px rgba(0, 212, 170, 0.2) !important',
    },

    '& .ant-select-selector': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
    },

    '& .ant-select-selection-placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '& .ant-select-selection-item': {
      color: '#fff !important',
    },

    '& .ant-select-arrow': {
      color: 'rgba(255, 255, 255, 0.7) !important',
    },

    '& .ant-select-dropdown': {
      background: '#2a2a2a !important',
      border: '1px solid #555 !important',
    },

    '& .ant-select-dropdown .ant-select-item': {
      color: '#fff !important',
    },

    '& .ant-select-dropdown .ant-select-item:hover': {
      background: 'rgba(255, 255, 255, 0.1) !important',
    },

    '& .ant-select-dropdown .ant-select-item-option-selected': {
      background: 'rgba(0, 212, 170, 0.2) !important',
      color: '#00d4aa !important',
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

  fieldSelectError: {
    '& .ant-select-selector': {
      borderColor: '#ff4d4f !important',
      background: 'rgba(255, 77, 79, 0.1) !important',
    },
  },

  // 错误消息样式
  errorMessage: {
    color: '#ff4d4f',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 1.2,
  },

  // URL项样式
  urlItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: 8,

    '&:last-child': {
      marginBottom: 0,
    },
  },

  // URL选择器样式
  urlSelect: {
    width: 120,
    marginRight: 8,
    background: 'rgba(255, 255, 255, 0.05) !important',
    border: '1px solid #555 !important',
    color: '#fff !important',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#666 !important',
    },

    '&.ant-select-focused .ant-select-selector': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      borderColor: '#00d4aa !important',
      boxShadow: '0 0 0 2px rgba(0, 212, 170, 0.2) !important',
    },

    '& .ant-select-selector': {
      background: 'rgba(255, 255, 255, 0.05) !important',
      border: '1px solid #555 !important',
      color: '#fff !important',
      borderRadius: 6,
    },

    '& .ant-select-selection-placeholder': {
      color: 'rgba(255, 255, 255, 0.5) !important',
    },

    '& .ant-select-selection-item': {
      color: '#fff !important',
    },

    '& .ant-select-arrow': {
      color: 'rgba(255, 255, 255, 0.7) !important',
    },

    '& .ant-select-dropdown': {
      background: '#2a2a2a !important',
      border: '1px solid #555 !important',
    },

    '& .ant-select-dropdown .ant-select-item': {
      color: '#fff !important',
    },

    '& .ant-select-dropdown .ant-select-item:hover': {
      background: 'rgba(255, 255, 255, 0.1) !important',
    },

    '& .ant-select-dropdown .ant-select-item-option-selected': {
      background: 'rgba(0, 212, 170, 0.2) !important',
      color: '#00d4aa !important',
    },
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

  // 标签区域样式
  tagsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  // 标签列表样式
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },

  addTagButton: {
    marginTop: 8,
    width: 100,
  },

  // 标签项样式
  tagItem: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },

  // 标签删除按钮样式
  tagRemove: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    marginLeft: 4,

    '&:hover': {
      color: '#ff4d4f',
    },
  },

  // 新标签输入框样式
  newTagInput: {
    width: 120,
    marginRight: 8,
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

  // 标签输入区域样式
  tagInputSection: {
    display: 'flex',
    alignItems: 'center',
  },

  // 弹窗容器样式
  modalContainer: {
    padding: '16px 0',
    overflowX: 'hidden',
  },

  // 弹窗头部样式
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // 弹窗标题样式
  modalTitle: {
    margin: 0,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // 标签列表容器样式
  tagListContainer: {
    height: 430,
    background: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 16,
    overflowX: 'hidden',
    overflowY: 'auto',
  },

  // 标签选择区域样式
  tagSelectArea: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },

  // 标签选择项样式
  tagSelectItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 4,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #555',
    transition: 'all 0.2s ease',
    cursor: 'pointer',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderColor: '#666',
    },
  },

  // 选中状态的标签选择项样式
  tagSelectItemSelected: {
    background: 'rgba(0, 212, 170, 0.2) !important',
    borderColor: '#00d4aa !important',

    '&:hover': {
      background: 'rgba(0, 212, 170, 0.3) !important',
      borderColor: '#00d4aa !important',
    },

    '& $tagName': {
      color: '#00d4aa !important',
    },
  },

  // 标签名称样式
  tagName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },

  // 管理模式下的删除按钮样式
  tagDeleteBtn: {
    padding: '0 4px',
    fontSize: '12px',
    height: '20px',
    lineHeight: '18px',
  },
}));
