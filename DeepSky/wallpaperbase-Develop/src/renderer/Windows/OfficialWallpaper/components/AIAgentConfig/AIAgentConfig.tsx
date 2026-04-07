/* eslint-disable jsx-a11y/label-has-associated-control */
import { UploadOutlined } from '@ant-design/icons';
import { api } from '@api';
import { Button, Input, message, Switch, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { useAIAgentConfigStyles } from './styles';

interface AIAgentPrompt {
  name: string;
  description?: string;
  category: string;
  system_prompt: string;
  prompt_extern_json: {
    name: string;
    identity: string;
    background: string;
    personality: string;
    languageStyle: string;
    relationships: string;
    experience: string;
    voice_id: string;
    scene_id: string;
    ResourceType: string;
    ResourceVersion: string;
    type: string;
    bot_id: string;
    url: string;
    activeReplyRules: string;
    bEnableMemory: boolean;
    interactiveDesc: string;
    expressions: string;
    actions: string;
    defaultHeaderData: string;
  };
}

interface ValidationErrors {
  name?: string;
  category?: string;
  system_prompt?: string;
}

interface AIAgentConfigProps {
  aiAgentPrompt: AIAgentPrompt;
  onFieldChange: (field: string | number | symbol, value: string) => void;
  onExternFieldChange: (field: string | number | symbol, value: string) => void;
  showEditButton?: boolean;
  onEditClick?: () => void;
  mode?: 'create' | 'detail'; // 创建模式或详情模式
  onValidationChange?: (isValid: boolean) => void; // 校验状态变化回调
}

function AIAgentConfig({
  aiAgentPrompt,
  onFieldChange,
  onExternFieldChange,
  showEditButton = true,
  onEditClick,
  mode = 'detail',
  onValidationChange,
}: AIAgentConfigProps) {
  const { styles } = useAIAgentConfigStyles();
  const [errors, setErrors] = useState<ValidationErrors>({});

  // 校验必填字段
  const validateFields = () => {
    const newErrors: ValidationErrors = {};

    if (!aiAgentPrompt.name?.trim()) {
      newErrors.name = '角色名称不能为空';
    }
    if (!aiAgentPrompt.category?.trim()) {
      newErrors.category = '分类不能为空';
    }
    if (!aiAgentPrompt.system_prompt?.trim()) {
      newErrors.system_prompt = '系统提示词不能为空';
    }

    setErrors(newErrors);

    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange?.(isValid);

    return isValid;
  };

  // 当数据变化时重新校验
  useEffect(() => {
    if (mode === 'create') {
      validateFields();
    }
  }, [
    aiAgentPrompt.name,
    aiAgentPrompt.category,
    aiAgentPrompt.system_prompt,
    mode,
  ]);

  // 暴露校验方法给父组件
  useEffect(() => {
    if (onValidationChange) {
      // 将校验方法通过 ref 暴露出去，或者通过回调
      const isValid = !errors.name && !errors.category && !errors.system_prompt;
      onValidationChange(isValid);
    }
  }, [errors, onValidationChange]);

  // 处理图片上传
  const handleImageUpload = async (
    file: File,
    callback: (url: string) => void,
  ) => {
    try {
      const url = await api.createCharacter.uploadImage(file, 'avatar');
      callback(url);
      message.success('图片上传成功');
      console.log('头像上传成功，URL:', url);
    } catch (error) {
      message.error('图片上传失败');
      console.error('Upload error:', error);
    }
  };
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3
          className={
            mode === 'create' ? styles.titleCreateMode : styles.titleDetailMode
          }
        >
          AI Agent {mode === 'create' ? 'Prompt' : '配置'}
        </h3>
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
              角色名称-name <span className={styles.requiredMark}>*</span>
            </label>
            <Input
              value={aiAgentPrompt?.name || ''}
              onChange={(e) => onFieldChange('name', e.target.value)}
              placeholder="请输入角色名称"
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
              分类-category <span className={styles.requiredMark}>*</span>
            </label>
            <Input
              value={aiAgentPrompt?.category || ''}
              onChange={(e) => onFieldChange('category', e.target.value)}
              placeholder="wallpaper"
              className={styles.fieldInput}
              status={errors.category ? 'error' : undefined}
            />
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
              描述-description
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.description || ''}
              onChange={(e) => onFieldChange('description', e.target.value)}
              rows={2}
              placeholder="请输入描述"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? `${styles.fieldLabelCreateMode} ${styles.fieldLabelRequired}`
                  : `${styles.fieldLabelDetailMode} ${styles.fieldLabelRequired}`
              }
            >
              系统提示词-system_prompt{' '}
              <span className={styles.requiredMark}>*</span>
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.system_prompt || ''}
              onChange={(e) => onFieldChange('system_prompt', e.target.value)}
              rows={3}
              placeholder="请输入系统提示词"
              className={styles.fieldTextarea}
              status={errors.system_prompt ? 'error' : undefined}
            />
            {errors.system_prompt && (
              <div className={styles.errorMessage}>{errors.system_prompt}</div>
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
              身份描述-identity
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.identity || ''}
              onChange={(e) => onExternFieldChange('identity', e.target.value)}
              rows={3}
              placeholder="请输入角色身份描述"
              className={styles.fieldTextarea}
            />
          </div>
          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              背景故事-background
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.background || ''}
              onChange={(e) =>
                onExternFieldChange('background', e.target.value)
              }
              rows={4}
              placeholder="请输入角色背景故事"
              className={styles.fieldTextarea}
            />
          </div>
          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              性格特点-personality
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.personality || ''}
              onChange={(e) =>
                onExternFieldChange('personality', e.target.value)
              }
              rows={3}
              placeholder="请输入性格特点"
              className={styles.fieldTextarea}
            />
          </div>
          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              语言风格-languageStyle
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.languageStyle || ''}
              onChange={(e) =>
                onExternFieldChange('languageStyle', e.target.value)
              }
              rows={3}
              placeholder="请输入语言风格"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              人际关系-relationships
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.relationships || ''}
              onChange={(e) =>
                onExternFieldChange('relationships', e.target.value)
              }
              rows={3}
              placeholder="请输入人际关系"
              className={styles.fieldTextarea}
            />
          </div>
          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              经历-experience
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.experience || ''}
              onChange={(e) =>
                onExternFieldChange('experience', e.target.value)
              }
              rows={3}
              placeholder="请输入角色经历"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              回复规则-activeReplyRules
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.activeReplyRules || ''}
              onChange={(e) =>
                onExternFieldChange('activeReplyRules', e.target.value)
              }
              rows={3}
              placeholder="请输入回复规则"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              是否启用记忆-bEnableMemory
            </label>
            <div className={styles.switchContainer}>
              <Switch
                checked={
                  aiAgentPrompt?.prompt_extern_json?.bEnableMemory === true ||
                  String(aiAgentPrompt?.prompt_extern_json?.bEnableMemory) ===
                    'true'
                }
                onChange={(checked) =>
                  onExternFieldChange('bEnableMemory', checked.toString())
                }
              />
              <span className={styles.switchLabel}>
                {aiAgentPrompt?.prompt_extern_json?.bEnableMemory === true ||
                String(aiAgentPrompt?.prompt_extern_json?.bEnableMemory) ===
                  'true'
                  ? '启用'
                  : '禁用'}
              </span>
            </div>
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              特殊交互行为描述-interactiveDesc
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.interactiveDesc || ''}
              onChange={(e) =>
                onExternFieldChange('interactiveDesc', e.target.value)
              }
              rows={3}
              placeholder="请输入特殊交互行为描述"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              表情-expressions
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.expressions || ''}
              onChange={(e) =>
                onExternFieldChange('expressions', e.target.value)
              }
              rows={3}
              placeholder="请输入表情描述"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              动作-actions
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.actions || ''}
              onChange={(e) => onExternFieldChange('actions', e.target.value)}
              rows={3}
              placeholder="请输入动作描述"
              className={styles.fieldTextarea}
            />
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              默认头部数据-defaultHeaderData
            </label>
            <Input.TextArea
              value={aiAgentPrompt?.prompt_extern_json?.defaultHeaderData || ''}
              onChange={(e) =>
                onExternFieldChange('defaultHeaderData', e.target.value)
              }
              rows={4}
              placeholder="请输入默认头部数据"
              className={styles.fieldTextarea}
            />
          </div>

          {/* ID字段 */}
          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              语音ID-voice_id
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.voice_id || ''}
              onChange={(e) => onExternFieldChange('voice_id', e.target.value)}
              placeholder="请输入语音ID"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              场景ID-scene_id
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.scene_id || ''}
              onChange={(e) => onExternFieldChange('scene_id', e.target.value)}
              placeholder="请输入场景ID"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              音色类型-ResourceType
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.ResourceType || ''}
              onChange={(e) =>
                onExternFieldChange('ResourceType', e.target.value)
              }
              placeholder="请输入音色类型"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              音色版本-ResourceVersion
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.ResourceVersion || ''}
              onChange={(e) =>
                onExternFieldChange('ResourceVersion', e.target.value)
              }
              placeholder="请输入音色版本"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              类型-type
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.type || ''}
              onChange={(e) => onExternFieldChange('type', e.target.value)}
              placeholder="wallpaper"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formField}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              机器人ID-bot_id
            </label>
            <Input
              value={aiAgentPrompt?.prompt_extern_json?.bot_id || ''}
              onChange={(e) => onExternFieldChange('bot_id', e.target.value)}
              placeholder="请输入机器人ID"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.formFieldFullWidth}>
            <label
              className={
                mode === 'create'
                  ? styles.fieldLabelCreateMode
                  : styles.fieldLabelDetailMode
              }
            >
              头像URL-url
            </label>
            <div className={styles.urlInputContainer}>
              <Input
                value={aiAgentPrompt?.prompt_extern_json?.url || ''}
                onChange={(e) => onExternFieldChange('url', e.target.value)}
                placeholder="请输入头像URL或点击上传"
                className={styles.fieldInput}
                style={{ flex: 1 }}
              />
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  handleImageUpload(file, (url) => {
                    onExternFieldChange('url', url);
                  });
                  return false; // 阻止默认上传行为
                }}
              >
                <Button icon={<UploadOutlined />}>上传</Button>
              </Upload>
            </div>
          </div>
          {/* {mode === 'detail' && <></>} */}
        </div>
      </div>
    </div>
  );
}

export default AIAgentConfig;
