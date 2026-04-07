import { UploadOutlined } from '@ant-design/icons';
import { api } from '@api';
import { Button, Input, message, Modal, Select, Switch, Upload } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  createTags,
  deleteTags,
  getTagsList,
} from '../../../../api/requests/wallpaper';
import { useOfficialWallpaperStyles } from '../../styles';
import { useModelConfigStyles } from './styles';

const { Option } = Select;

interface ModelInfo {
  name: string;
  description: string;
  model_urls: Array<{
    type: string;
    url: string;
  }>;
  category: string;
  tags: string[];
  metadata: Record<string, any>;
}

interface ValidationErrors {
  name?: string;
  model_urls?: string;
  category?: string;
}

interface ModelConfigProps {
  modelInfo: ModelInfo;
  onModelInfoChange: (field: string, value: any) => void;
  onTagRemove: (tag: string) => void;
  showEditButton?: boolean;
  onEditClick?: () => void;
  mode?: 'create' | 'detail'; // 创建模式或详情模式
  onValidationChange?: (isValid: boolean) => void; // 校验状态变化回调
}

function ModelConfig({
  modelInfo,
  onModelInfoChange,
  onTagRemove,
  showEditButton = true,
  onEditClick,
  mode = 'detail',
  onValidationChange,
}: ModelConfigProps) {
  const { styles } = useModelConfigStyles();
  const { styles: globalStyles } = useOfficialWallpaperStyles();
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [availableTags, setAvailableTags] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isManagementMode, setIsManagementMode] = useState(false);

  // 校验必填字段
  const validateFields = useCallback(() => {
    const newErrors: ValidationErrors = {};

    if (!modelInfo.name?.trim()) {
      newErrors.name = '模型名称不能为空';
    }
    if (!modelInfo.category?.trim()) {
      newErrors.category = '分类不能为空';
    }
    // 检查model_urls是否至少有一个有效的URL（包含type和url）
    const hasValidUrl = modelInfo.model_urls?.some(
      (urlItem) => urlItem.type?.trim() && urlItem.url?.trim(),
    );
    if (!hasValidUrl) {
      newErrors.model_urls = '至少需要一个有效的模型资源URL（包含类型和URL）';
    }

    setErrors(newErrors);

    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange?.(isValid);

    return isValid;
  }, [
    modelInfo.name,
    modelInfo.category,
    modelInfo.model_urls,
    onValidationChange,
  ]);

  // 当数据变化时重新校验
  useEffect(() => {
    if (mode === 'create') {
      validateFields();
    }
  }, [
    modelInfo.name,
    modelInfo.category,
    modelInfo.model_urls,
    mode,
    validateFields,
  ]);

  // 暴露校验方法给父组件
  useEffect(() => {
    if (onValidationChange) {
      const isValid = !errors.name && !errors.category && !errors.model_urls;
      onValidationChange(isValid);
    }
  }, [errors, onValidationChange]);

  const handleTagRemove = (tagToRemove: string) => {
    onTagRemove(tagToRemove);
  };

  // 打开标签选择弹窗
  const handleAddTagClick = () => {
    // 创建模式时不预选任何标签，编辑模式时预选已有的标签
    setSelectedTags(mode === 'create' ? [] : [...modelInfo.tags]);
    loadTagsList();
    setIsTagModalVisible(true);
  };

  // 加载标签列表
  const loadTagsList = async () => {
    try {
      const tags = await getTagsList();
      if (tags.code === 0) {
        console.log('tags:', tags.data);
        // 确保 tags 是数组格式
        const tagList = Array.isArray(tags.data) ? tags.data : [];
        setAvailableTags(tagList);
      }
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error('获取标签列表失败');
      setAvailableTags([]);
    }
  };

  // 处理标签选中状态变化
  const handleTagSelectChange = (
    tag: { id: string; name: string },
    checked: boolean,
  ) => {
    if (checked) {
      setSelectedTags([...selectedTags, tag.name]);
    } else {
      setSelectedTags(selectedTags.filter((t) => t !== tag.name));
    }
  };

  // 创建新标签
  const handleCreateTag = async () => {
    if (newTag.trim()) {
      try {
        await createTags({ name: newTag.trim() });
        setNewTag('');
        loadTagsList(); // 刷新标签列表
        message.success('标签创建成功');
      } catch (error) {
        console.error('创建标签失败:', error);
        message.error('创建标签失败');
      }
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTags(tagId);
      loadTagsList(); // 刷新标签列表
      message.success('标签删除成功');
    } catch (error) {
      console.error('删除标签失败:', error);
      message.error('删除标签失败');
    }
  };

  // 完成标签选择
  const handleTagModalOk = () => {
    onModelInfoChange('tags', selectedTags);
    setIsTagModalVisible(false);
  };

  // 取消标签选择
  const handleTagModalCancel = () => {
    setSelectedTags([...modelInfo.tags]);
    setIsTagModalVisible(false);
  };

  const handleUrlChange = (
    index: number,
    field: 'type' | 'url',
    value: string,
  ) => {
    const newUrls = [...modelInfo.model_urls];
    newUrls[index] = { ...newUrls[index], [field]: value };
    onModelInfoChange('model_urls', newUrls);
  };

  // 处理模型资源URL的上传
  const handleUrlUpload = (index: number) => async (file: File) => {
    try {
      const url = await api.createCharacter.uploadImage(file, `model_${index}`);
      const newUrls = [...modelInfo.model_urls];
      newUrls[index] = { ...newUrls[index], url };
      onModelInfoChange('model_urls', newUrls);
      message.success('资源上传成功');
      console.log('上传成功，URL:', url, '更新后的URLs:', newUrls);
    } catch (error) {
      message.error('资源上传失败');
      console.error('Upload error:', error);
    }
  };

  // 处理视频上传
  const handleVideoUpload = async (file: File) => {
    try {
      const url = await api.createCharacter.uploadImage(file, 'video');
      onModelInfoChange('metadata', {
        ...modelInfo.metadata,
        video: url,
      });
      message.success('视频上传成功');
      console.log('视频上传成功，URL:', url);
    } catch (error) {
      message.error('视频上传失败');
      console.error('视频上传错误:', error);
    }
  };

  // 处理视频URL输入变化
  const handleVideoUrlChange = (value: string) => {
    onModelInfoChange('metadata', {
      ...modelInfo.metadata,
      video: value,
    });
  };

  // 处理性别变化
  const handleGenderChange = (value: string) => {
    onModelInfoChange('metadata', {
      ...modelInfo.metadata,
      gender: value,
    });
  };

  // 处理体型变化
  const handleBodyTypeChange = (value: string) => {
    onModelInfoChange('metadata', {
      ...modelInfo.metadata,
      bodyType: value,
    });
  };

  // 处理是否可切换头像变化
  const handleSwitchableAvatarChange = (checked: boolean) => {
    onModelInfoChange('metadata', {
      ...modelInfo.metadata,
      switchableAvatar: checked,
    });
  };

  // 处理是否可见变化
  const handleVisibleChange = (checked: boolean) => {
    onModelInfoChange('metadata', {
      ...modelInfo.metadata,
      visible: checked,
    });
  };

  console.log('ModelConfig render, model_urls:', modelInfo.model_urls);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>模型配置</h3>
        {showEditButton && mode === 'detail' && (
          <Button type="primary" size="small" onClick={onEditClick}>
            修改配置
          </Button>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.grid}>
          {/* 基本信息 */}
          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? `${styles.fieldLabelCreateMode} ${styles.fieldLabelRequired}`
                  : `${styles.fieldLabelDetailMode} ${styles.fieldLabelRequired}`
              }
            >
              模型名称 <span className={styles.requiredMark}>*</span>
            </label>
            <Input
              value={modelInfo.name}
              onChange={(e) => onModelInfoChange('name', e.target.value)}
              placeholder="请输入模型名称"
              className={styles.fieldInput}
              status={errors.name ? 'error' : undefined}
            />
            {errors.name && (
              <div className={styles.errorMessage}>{errors.name}</div>
            )}
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? `${styles.fieldLabelCreateMode} ${styles.fieldLabelRequired}`
                  : `${styles.fieldLabelDetailMode} ${styles.fieldLabelRequired}`
              }
            >
              分类 <span className={styles.requiredMark}>*</span>
            </label>
            <Select
              value={modelInfo.category}
              onChange={(value) => onModelInfoChange('category', value)}
              className={styles.fieldSelect}
              status={errors.category ? 'error' : undefined}
            >
              <Option value="wallpaper">壁纸</Option>
              <Option value="scene">场景</Option>
              <Option value="character">角色</Option>
            </Select>
            {errors.category && (
              <div className={styles.errorMessage}>{errors.category}</div>
            )}
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              描述
            </label>
            <Input.TextArea
              value={modelInfo.description}
              onChange={(e) => onModelInfoChange('description', e.target.value)}
              rows={3}
              placeholder="请输入模型描述"
              className={styles.fieldTextarea}
            />
          </div>

          {/* 模型URLs */}
          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? `${styles.fieldLabelCreateMode} ${styles.fieldLabelRequired}`
                  : `${styles.fieldLabelDetailMode} ${styles.fieldLabelRequired}`
              }
            >
              模型资源URL <span className={styles.requiredMark}>*</span>
            </label>
            {modelInfo.model_urls.map((urlItem, index) => {
              console.log(`URL item ${index}:`, urlItem);
              return (
                <div
                  key={`url-item-${index}-${urlItem.type}`}
                  className={styles.urlItem}
                >
                  <Select
                    value={urlItem.type}
                    onChange={(value) => handleUrlChange(index, 'type', value)}
                    className={styles.urlSelect}
                  >
                    <Option value="thumbnail">缩略图</Option>
                    <Option value="model">模型文件</Option>
                    <Option value="preview">预览图</Option>
                  </Select>
                  <Input
                    value={urlItem.url}
                    onChange={(e) =>
                      handleUrlChange(index, 'url', e.target.value)
                    }
                    placeholder="请输入URL或点击上传"
                    className={styles.urlInput}
                    style={{ flex: 1 }}
                  />
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleUrlUpload(index)(file);
                      return false; // 阻止默认上传行为
                    }}
                  >
                    <Button icon={<UploadOutlined />}>上传</Button>
                  </Upload>
                </div>
              );
            })}
            {errors.model_urls && (
              <div className={styles.errorMessage}>{errors.model_urls}</div>
            )}
          </div>

          {/* 标签 */}
          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              标签
            </label>
            <div className={styles.tagsSection}>
              <div className={styles.tagsList}>
                {modelInfo.tags.map((tag, index) => (
                  <span key={index} className={styles.tagItem}>
                    {tag}
                    {(mode === 'create' || mode === 'detail') && (
                      <button
                        type="button"
                        className={styles.tagRemove}
                        onClick={() => handleTagRemove(tag)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <Button
                onClick={handleAddTagClick}
                size="small"
                className={styles.addTagButton}
              >
                添加标签
              </Button>
            </div>
          </div>

          {/* Metadata 字段 - 性别、是否可切换头像、是否可见在一行 */}
          <div className={styles.formFieldFullWidth}>
            <div className={styles.formFieldRow}>
              <div className={styles.formFieldInRow}>
                <label
                  className={
                    mode === 'create'
                      ? styles.fieldLabelCreateMode
                      : styles.fieldLabelDetailMode
                  }
                >
                  性别
                </label>
                <Select
                  value={modelInfo.metadata?.gender || ''}
                  onChange={handleGenderChange}
                  className={styles.fieldSelect}
                  placeholder="请选择性别"
                >
                  <Option value="male">男</Option>
                  <Option value="female">女</Option>
                  <Option value="other">其他</Option>
                </Select>
              </div>

              <div className={styles.formFieldInRow}>
                <label
                  className={
                    mode === 'create'
                      ? styles.fieldLabelCreateMode
                      : styles.fieldLabelDetailMode
                  }
                >
                  体型
                </label>
                <Input
                  value={modelInfo.metadata?.bodyType || ''}
                  onChange={(e) => handleBodyTypeChange(e.target.value)}
                  placeholder="请输入体型"
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.formFieldInRow}>
                <label
                  className={
                    mode === 'create'
                      ? styles.fieldLabelCreateMode
                      : styles.fieldLabelDetailMode
                  }
                >
                  是否可切换头像
                </label>
                <Switch
                  className={styles.switch}
                  checked={modelInfo.metadata?.switchableAvatar || false}
                  onChange={handleSwitchableAvatarChange}
                />
              </div>

              <div className={styles.formFieldInRow}>
                <label
                  className={
                    mode === 'create'
                      ? styles.fieldLabelCreateMode
                      : styles.fieldLabelDetailMode
                  }
                >
                  是否可见
                </label>
                <Switch
                  className={styles.switch}
                  checked={modelInfo.metadata?.visible !== false} // 默认可见
                  onChange={handleVisibleChange}
                />
              </div>
            </div>
          </div>

          {/* 视频字段 - 单独一行并添加上传功能 */}
          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              视频
            </label>
            <div className={styles.urlItem}>
              <Input
                value={modelInfo.metadata?.video || ''}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="请输入视频URL或点击上传"
                className={styles.urlInput}
                style={{ flex: 1 }}
              />
              <Upload
                accept="video/*"
                showUploadList={false}
                beforeUpload={async (file) => {
                  await handleVideoUpload(file);
                  return false; // 阻止默认上传行为
                }}
              >
                <Button icon={<UploadOutlined />}>上传视频</Button>
              </Upload>
            </div>
          </div>
        </div>
      </div>

      {/* 标签选择弹窗 */}
      <Modal
        title="选择标签"
        open={isTagModalVisible}
        onOk={handleTagModalOk}
        onCancel={handleTagModalCancel}
        width={600}
        footer={[
          <Button key="cancel" onClick={handleTagModalCancel}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={handleTagModalOk}>
            完成
          </Button>,
        ]}
        wrapClassName={globalStyles.modal}
      >
        <div className={styles.modalContainer}>
          {/* 第一部分：标题和右侧管理按钮 */}
          <div className={styles.modalHeader}>
            <h4 className={styles.modalTitle}>我的标签</h4>
            <Button
              type={isManagementMode ? 'primary' : 'default'}
              size="small"
              onClick={() => setIsManagementMode(!isManagementMode)}
            >
              {isManagementMode ? '取消管理' : '管理'}
            </Button>
          </div>

          {/* 第二部分：标签列表 */}
          <div className={styles.tagListContainer}>
            <div className={styles.tagSelectArea}>
              {Array.isArray(availableTags) &&
                availableTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={`${styles.tagSelectItem} ${
                      selectedTags.includes(tag.name)
                        ? styles.tagSelectItemSelected
                        : ''
                    }`}
                    onClick={() =>
                      handleTagSelectChange(
                        tag,
                        !selectedTags.includes(tag.name),
                      )
                    }
                  >
                    <span className={styles.tagName}>{tag.name}</span>
                    {isManagementMode && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTag(tag.id);
                        }}
                        className={styles.tagDeleteBtn}
                      >
                        删除
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* 第三部分：新建标签输入框 */}
          <div className={styles.tagInputSection}>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="新建标签"
              onPressEnter={handleCreateTag}
              className={styles.newTagInput}
            />
            <Button onClick={handleCreateTag} size="small">
              新建
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ModelConfig;
