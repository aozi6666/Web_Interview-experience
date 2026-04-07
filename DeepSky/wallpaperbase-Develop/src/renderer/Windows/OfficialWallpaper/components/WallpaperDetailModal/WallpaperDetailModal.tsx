import { Button, Modal, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '@api';
import AIAgentConfig from '../AIAgentConfig/AIAgentConfig';
import ModelConfig from '../ModelConfig/ModelConfig';
import WallpaperInfo from '../WallpaperInfo/WallpaperInfo';
import { useOfficialWallpaperStyles } from '../../styles';

interface WallpaperItem {
  id: string;
  title: string;
  thumbnail: string;
  preview: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  author?: string;
  isUsing?: boolean;
  agent_prompt_id?: string;
}

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

interface WallpaperDetail {
  id: string;
  aiAgentPrompt: AIAgentPrompt;
  modelInfo: ModelInfo;
  agent_prompt_id: string;
  model_id?: string;
  config_params?: Record<string, any>;
}

interface WallpaperDetailModalProps {
  visible: boolean;
  onCancel: () => void;
  onRefresh?: () => void;
  wallpaperId: string | null;
  wallpaper: WallpaperItem | null;
}

function WallpaperDetailModal({
  visible,
  onCancel,
  onRefresh,
  wallpaperId,
  wallpaper,
}: WallpaperDetailModalProps) {
  const { styles } = useOfficialWallpaperStyles();
  const [selectedWallpaper, setSelectedWallpaper] = useState<WallpaperItem | null>(wallpaper);
  const [currentWallpaperDetail, setCurrentWallpaperDetail] = useState<WallpaperDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiAgentConfigSaved, setAiAgentConfigSaved] = useState(false);
  const [modelConfigSaved, setModelConfigSaved] = useState(false);

  // 获取壁纸详情
  const fetchWallpaperDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.getThemesInfo(id);
      if (res.code === 0) {
        setCurrentWallpaperDetail({
          id,
          agent_prompt_id: res.data.agent_prompt_detail.id,
          model_id: res.data.wallpaper_detail?.id || id,
          aiAgentPrompt: {
            name: res.data.agent_prompt_detail.name,
            description: res.data.agent_prompt_detail.description,
            category: res.data.agent_prompt_detail.category,
            system_prompt: res.data.agent_prompt_detail.system_prompt,
            prompt_extern_json: res.data.agent_prompt_detail.prompt_extern_json,
          },
          modelInfo: res.data.wallpaper_detail,
          config_params: res.data.config_params,
        });
      }
    } catch (error) {
      console.error('获取壁纸详情失败:', error);
      message.error('获取壁纸详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 当 wallpaper prop 改变时更新 selectedWallpaper
  useEffect(() => {
    setSelectedWallpaper(wallpaper);
  }, [wallpaper]);

  // 当弹窗打开时获取数据
  useEffect(() => {
    if (visible && wallpaperId) {
      fetchWallpaperDetail(wallpaperId);
      // 重置保存状态
      setAiAgentConfigSaved(false);
      setModelConfigSaved(false);
    }
  }, [visible, wallpaperId]);

  // 处理字段变化
  const handleFieldChange = (field: string | number | symbol, value: string) => {
    if (!currentWallpaperDetail) return;
    setCurrentWallpaperDetail({
      ...currentWallpaperDetail,
      aiAgentPrompt: {
        ...currentWallpaperDetail.aiAgentPrompt,
        [field]: value,
      },
    });
  };

  const handleExternFieldChange = (field: string | number | symbol, value: string) => {
    if (!currentWallpaperDetail) return;
    setCurrentWallpaperDetail({
      ...currentWallpaperDetail,
      aiAgentPrompt: {
        ...currentWallpaperDetail.aiAgentPrompt,
        prompt_extern_json: {
          ...currentWallpaperDetail.aiAgentPrompt.prompt_extern_json,
          [field]: value,
        },
      },
    });
  };

  const handleModelInfoChange = (field: string, value: any) => {
    if (!currentWallpaperDetail) return;
    setCurrentWallpaperDetail({
      ...currentWallpaperDetail,
      modelInfo: {
        ...currentWallpaperDetail.modelInfo,
        [field]: value,
      },
    });
  };

  const handleTagAdd = (tag: string) => {
    if (!currentWallpaperDetail) return;
    const newTags = [...currentWallpaperDetail.modelInfo.tags];
    if (!newTags.includes(tag)) {
      newTags.push(tag);
      handleModelInfoChange('tags', newTags);
    }
  };

  const handleTagRemove = (tag: string) => {
    if (!currentWallpaperDetail) return;
    const newTags = currentWallpaperDetail.modelInfo.tags.filter(t => t !== tag);
    handleModelInfoChange('tags', newTags);
  };

  // 更新AI Agent配置
  const handleUpdateAIAgentConfig = async () => {
    if (!currentWallpaperDetail) {
      message.error('没有找到壁纸详情数据');
      return;
    }

    try {
      const res = await api.updatePrompts(
        currentWallpaperDetail.agent_prompt_id,
        currentWallpaperDetail.aiAgentPrompt,
      );

      if (res.code === 0) {
        message.success('AI Agent配置更新成功');
        setAiAgentConfigSaved(true);
      } else {
        message.error(res.message || '更新AI Agent配置失败');
      }
    } catch (error) {
      console.error('更新AI Agent配置失败:', error);
      message.error('更新AI Agent配置失败');
    }
  };

  // 更新模型配置
  const handleUpdateModelConfig = async () => {
    if (!currentWallpaperDetail) {
      message.error('没有找到壁纸详情数据');
      return;
    }

    if (!currentWallpaperDetail.model_id) {
      message.error('没有找到模型ID');
      return;
    }

    try {
      const res = await api.updateModel(
        'wallpaper',
        currentWallpaperDetail.model_id,
        currentWallpaperDetail.modelInfo,
      );

      if (res.code === 0) {
        message.success('模型配置更新成功');
        setModelConfigSaved(true);
      } else {
        message.error(res.message || '更新模型配置失败');
      }
    } catch (error) {
      console.error('更新模型配置失败:', error);
      message.error('更新模型配置失败');
    }
  };

  // 保存壁纸详情修改
  const handleSave = async () => {
    if (!currentWallpaperDetail) return;

    setSaving(true);
    try {
      // 1. 检查AI Agent配置是否已保存，如果没有则先保存
      if (!aiAgentConfigSaved) {
        await handleUpdateAIAgentConfig();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 2. 检查模型配置是否已保存，如果没有则先保存
      if (!modelConfigSaved) {
        await handleUpdateModelConfig();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 3. 更新壁纸信息（主题）
      const thumbnailUrl = currentWallpaperDetail.modelInfo.model_urls.find(
        (url) => url.type === 'thumbnail',
      )?.url || '';

      const updateData = {
        name: currentWallpaperDetail.modelInfo.name,
        description: currentWallpaperDetail.modelInfo.description,
        thumbnail_url: thumbnailUrl,
        category: currentWallpaperDetail.modelInfo.category,
        tags: currentWallpaperDetail.modelInfo.tags,
        agent_prompt_id: currentWallpaperDetail.agent_prompt_id,
        wallpaper_id: currentWallpaperDetail.model_id,
        visible: currentWallpaperDetail.modelInfo.metadata?.visible !== false, // 默认可见
        config_params: {
          ...(currentWallpaperDetail.config_params || {}),
          gender: currentWallpaperDetail.modelInfo.metadata?.gender || '',
          bodyType: currentWallpaperDetail.modelInfo.metadata?.bodyType || '',
          video: currentWallpaperDetail.modelInfo.metadata?.video || '',
          switchableAvatar: currentWallpaperDetail.modelInfo.metadata?.switchableAvatar || false,
        },
      };

      const res = await api.updateThemes(currentWallpaperDetail.id, updateData);

      if (res.code === 0) {
        message.success('壁纸配置保存成功');
        onCancel();
        onRefresh?.();
      } else {
        message.error(res.message || '保存壁纸配置失败');
      }
    } catch (error) {
      message.error('保存失败');
      console.error('保存壁纸详情失败:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="壁纸详情与AI配置"
      open={visible}
      onCancel={onCancel}
      width={1000}
      className={styles.modal}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          保存壁纸配置
        </Button>,
      ]}
    >
      {detailLoading ? (
        <div>加载中...</div>
      ) : (
        selectedWallpaper &&
        currentWallpaperDetail && (
          <div className={styles.createWallpaperModalContent}>
            {/* 壁纸基本信息 */}
            <WallpaperInfo wallpaper={selectedWallpaper} />

            {/* AI Agent Prompt 分块 */}
            <AIAgentConfig
              aiAgentPrompt={currentWallpaperDetail.aiAgentPrompt}
              onFieldChange={handleFieldChange}
              onExternFieldChange={handleExternFieldChange}
              showEditButton
              onEditClick={handleUpdateAIAgentConfig}
              mode="detail"
              onValidationChange={() => {}} // 可以在这里处理验证状态
            />

            {/* 模型配置分块 */}
            <ModelConfig
              modelInfo={currentWallpaperDetail.modelInfo}
              onModelInfoChange={handleModelInfoChange}
              onTagAdd={handleTagAdd}
              onTagRemove={handleTagRemove}
              showEditButton
              onEditClick={handleUpdateModelConfig}
              mode="detail"
            />
          </div>
        )
      )}
      {!detailLoading && !(selectedWallpaper && currentWallpaperDetail) && (
        <div style={{ textAlign: 'center', color: '#999' }}>暂无数据</div>
      )}
    </Modal>
  );
}

export default WallpaperDetailModal;
