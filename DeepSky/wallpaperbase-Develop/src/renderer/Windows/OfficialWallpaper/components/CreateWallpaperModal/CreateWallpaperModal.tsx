import { api } from '@api';
import { Button, Modal, message } from 'antd';
import { useState } from 'react';
import { useOfficialWallpaperStyles } from '../../styles';
import AIAgentConfig from '../AIAgentConfig/AIAgentConfig';
import ModelConfig from '../ModelConfig/ModelConfig';

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
    type: string;
    bot_id: string;
    url: string;
  };
}

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

interface CreateWallpaperData {
  aiAgentPrompt: AIAgentPrompt;
  modelInfo: ModelInfo;
}

interface CreateWallpaperModalProps {
  visible: boolean;
  onCancel: () => void;
  onRefresh?: () => void;
}

// 默认的 AI Agent Prompt 数据
const DEFAULT_AI_AGENT_PROMPT: AIAgentPrompt = {
  name: '',
  description: '',
  category: 'wallpaper',
  system_prompt: '',
  prompt_extern_json: {
    name: '',
    identity: '',
    background: '',
    personality: '',
    languageStyle: '',
    relationships: '',
    experience: '',
    voice_id: '',
    scene_id: '',
    type: 'wallpaper',
    bot_id: '',
    url: '',
  },
};

// 默认的模型信息数据
const DEFAULT_MODEL_INFO: ModelInfo = {
  name: '',
  description: '',
  model_urls: [{ type: 'thumbnail', url: '' }],
  category: 'wallpaper',
  tags: [],
  metadata: {},
};

function CreateWallpaperModal({
  visible,
  onCancel,
  onRefresh,
}: CreateWallpaperModalProps) {
  const { styles } = useOfficialWallpaperStyles();
  const [creating, setCreating] = useState(false);
  const [createFormValid, setCreateFormValid] = useState(false);
  const [createWallpaperData, setCreateWallpaperData] = useState<CreateWallpaperData>({
    aiAgentPrompt: { ...DEFAULT_AI_AGENT_PROMPT, prompt_extern_json: { ...DEFAULT_AI_AGENT_PROMPT.prompt_extern_json } },
    modelInfo: { ...DEFAULT_MODEL_INFO, model_urls: [...DEFAULT_MODEL_INFO.model_urls], tags: [...DEFAULT_MODEL_INFO.tags] },
  });

  // 延迟辅助函数
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // 处理字段变化
  const handleFieldChange = (
    field: string | number | symbol,
    value: string,
  ) => {
    setCreateWallpaperData(prev => ({
      ...prev,
      aiAgentPrompt: {
        ...prev.aiAgentPrompt,
        [field]: value,
        // 如果修改的是 name 字段，同时更新 prompt_extern_json.name
        ...(field === 'name' && {
          prompt_extern_json: {
            ...prev.aiAgentPrompt.prompt_extern_json,
            name: value,
          },
        }),
      },
    }));
  };

  const handleExternFieldChange = (
    field: string | number | symbol,
    value: string,
  ) => {
    setCreateWallpaperData(prev => ({
      ...prev,
      aiAgentPrompt: {
        ...prev.aiAgentPrompt,
        prompt_extern_json: {
          ...prev.aiAgentPrompt.prompt_extern_json,
          [field]: value,
        },
      },
    }));
  };

  const handleModelInfoChange = (field: string, value: any) => {
    setCreateWallpaperData(prev => ({
      ...prev,
      modelInfo: {
        ...prev.modelInfo,
        [field]: value,
      },
    }));
  };

  const handleTagAdd = (tag: string) => {
    setCreateWallpaperData(prev => ({
      ...prev,
      modelInfo: {
        ...prev.modelInfo,
        tags: prev.modelInfo.tags.includes(tag) ? prev.modelInfo.tags : [...prev.modelInfo.tags, tag],
      },
    }));
  };

  const handleTagRemove = (tag: string) => {
    setCreateWallpaperData(prev => ({
      ...prev,
      modelInfo: {
        ...prev.modelInfo,
        tags: prev.modelInfo.tags.filter(t => t !== tag),
      },
    }));
  };

  // 创建壁纸
  const handleCreate = async () => {
    // 验证数据
    if (!createFormValid) {
      message.error('请填写完整的AI Agent配置');
      return;
    }
    if (!createWallpaperData.modelInfo.name.trim()) {
      message.error('请填写模型名称');
      return;
    }

    setCreating(true);

    try {
      let agentPromptId: string = '';
      let wallpaperId: string = '';

      // 1. 创建AI Agent Prompt
      const createPromptRes = await api.createPrompts(createWallpaperData.aiAgentPrompt);
      if (createPromptRes.code !== 0) {
        throw new Error(`创建AI Agent Prompt失败: ${createPromptRes.message}`);
      }
      agentPromptId = createPromptRes.data.id;
      await delay(500);

      // 发布AI Agent Prompt
      const publishPromptRes = await api.publishPrompts(agentPromptId);
      if (publishPromptRes.code !== 0) {
        throw new Error(`发布AI Agent Prompt失败: ${publishPromptRes.message}`);
      }
      await delay(500);

      // 2. 创建模型
      const createModelRes = await api.createPublicModel('wallpaper', createWallpaperData.modelInfo);
      if (createModelRes.code !== 0) {
        throw new Error(`创建模型失败: ${createModelRes.message}`);
      }
      wallpaperId = createModelRes.data.id;
      await delay(500);

      // 发布模型
      const publishModelRes = await api.publishModels('wallpaper', wallpaperId);
      if (publishModelRes.code !== 0) {
        throw new Error(`发布模型失败: ${publishModelRes.message}`);
      }
      await delay(500);

      // 3. 创建主题
      const thumbnailUrl = createWallpaperData.modelInfo.model_urls.find(
        (url) => url.type === 'thumbnail',
      )?.url || '';

      const createThemeRes = await api.createThemes({
        name: createWallpaperData.modelInfo.name,
        description: createWallpaperData.modelInfo.description || '',
        thumbnail_url: thumbnailUrl,
        category: 'origin',
        tags: createWallpaperData.modelInfo.tags,
        creator_id: 'default_user', // 这里需要从用户状态获取
        wallpaper_id: wallpaperId,
        scene_model_id: null,
        digital_human_id: null,
        extension_ids: [],
        agent_prompt_id: agentPromptId,
        visible: createWallpaperData.modelInfo.metadata?.visible !== false, // 默认可见
        config_params: {
          contrast: 1.0,
          brightness: 1.0,
          gender: createWallpaperData.modelInfo.metadata?.gender || '',
          bodyType: createWallpaperData.modelInfo.metadata?.bodyType || '',
          video: createWallpaperData.modelInfo.metadata?.video || '',
          switchableAvatar: createWallpaperData.modelInfo.metadata?.switchableAvatar || false,
        },
        download_count: 0,
        rating: 0,
        subscription_count: 0,
        status: 'published',
        is_featured: false,
        creator_name: 'Default User', // 这里需要从用户状态获取
      });

      if (createThemeRes.code !== 0) {
        throw new Error(`创建主题失败: ${createThemeRes.message}`);
      }

      message.success('创建壁纸成功');
      onCancel();

      // 重置数据
      setCreateWallpaperData({
        aiAgentPrompt: { ...DEFAULT_AI_AGENT_PROMPT, prompt_extern_json: { ...DEFAULT_AI_AGENT_PROMPT.prompt_extern_json } },
        modelInfo: { ...DEFAULT_MODEL_INFO, model_urls: [...DEFAULT_MODEL_INFO.model_urls], tags: [...DEFAULT_MODEL_INFO.tags] },
      });

      onRefresh?.();
    } catch (error: any) {
      message.error(`创建壁纸失败: ${error.message}`);
      console.error('创建壁纸失败:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      title="创建新壁纸"
      open={visible}
      onCancel={onCancel}
      width={900}
      wrapClassName={styles.modal}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="create"
          type="primary"
          loading={creating}
          onClick={handleCreate}
        >
          创建
        </Button>,
      ]}
    >
      <div className={styles.createWallpaperModalContent}>
        <AIAgentConfig
          aiAgentPrompt={createWallpaperData.aiAgentPrompt}
          onFieldChange={handleFieldChange}
          onExternFieldChange={handleExternFieldChange}
          showEditButton={false}
          mode="create"
          onValidationChange={setCreateFormValid}
        />

        <ModelConfig
          modelInfo={createWallpaperData.modelInfo}
          onModelInfoChange={handleModelInfoChange}
          onTagAdd={handleTagAdd}
          onTagRemove={handleTagRemove}
          showEditButton={false}
          mode="create"
          onValidationChange={(isValid) => {
            // 这里可以根据模型配置的校验状态更新整体表单校验状态
            console.log('模型配置校验状态:', isValid);
          }}
        />
      </div>
    </Modal>
  );
}

export default CreateWallpaperModal;
