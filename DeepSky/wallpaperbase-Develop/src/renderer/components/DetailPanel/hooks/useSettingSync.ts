import { updatePrivateAssetDetail } from '@api/requests/wallpaper';
import { Character, setSelectedCharacter } from '@renderer/stores/CharacterStore';
import type { MutableRefObject } from 'react';

interface UseSettingSyncParams {
  agentIdRef: MutableRefObject<string>;
  agentData: MutableRefObject<any>;
  libsData: MutableRefObject<any>;
  selectedVoiceIdRef: MutableRefObject<string>;
  setIsEditingName: (value: boolean) => void;
  setPersonality: (value: string) => void;
  setUserPersonality: (value: string) => void;
  setIsSetVoiceSettingOpen: (value: boolean) => void;
  updateWallpaperJson: (
    data: Record<string, unknown>,
    shouldSyncToUe?: boolean,
  ) => Promise<void>;
  wallpaperId: string;
  wallpaperIsUsing?: boolean;
}

export const useSettingSync = ({
  agentIdRef,
  agentData,
  libsData,
  selectedVoiceIdRef,
  setIsEditingName,
  setPersonality,
  setUserPersonality,
  setIsSetVoiceSettingOpen,
  updateWallpaperJson,
  wallpaperId,
  wallpaperIsUsing = false,
}: UseSettingSyncParams) => {
  const syncAgentAndWallpaperJson = async () => {
    await updatePrivateAssetDetail(
      agentIdRef.current,
      agentData.current,
      'agent-prompts',
    );
    libsData.current.agents = [agentData.current];
    await updateWallpaperJson({ libs: libsData.current }, true);

    if (!wallpaperIsUsing || !wallpaperId) {
      return;
    }

    const promptJson = agentData.current?.prompt_extern_json ?? {};
    const character: Character = {
      id: `wallpaper_${wallpaperId}`,
      name: agentData.current?.name || '',
      personality: promptJson.personality || '',
      identity: promptJson.identity || '',
      languageStyle: promptJson.languageStyle || '',
      relationships: promptJson.relationships || '',
      experience: promptJson.experience || '',
      background: promptJson.background || '',
      voice_id: promptJson.voice_id || '',
      ResourceType: promptJson.ResourceType || '',
      ResourceVersion: promptJson.ResourceVersion || '',
      bot_id: promptJson.bot_id || '',
      activeReplyRules: promptJson.activeReplyRules || '',
      actions: promptJson.actions || '',
      expressions: promptJson.expressions || '',
      enable_memory: promptJson.bEnableMemory ?? true,
      accessible_agent_ids: promptJson.accessible_agent_ids,
      agent_id: agentData.current?.id || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSelectedCharacter(character);
    window.dispatchEvent(
      new CustomEvent('wallpaper-character-changed', {
        detail: { character, shouldConnectRTC: true },
      }),
    );
  };

  const handleSaveName = async (editingName: string) => {
    setIsEditingName(false);
    agentData.current.name = editingName;
    agentData.current.prompt_extern_json.name = editingName;
    await syncAgentAndWallpaperJson();
  };

  const handleRoleTextChange = async (
    currentPersonality: string,
    updatedText: string,
    options?: {
      syncPromptPersonality?: boolean;
    },
  ) => {
    setPersonality(updatedText);
    if (currentPersonality !== updatedText) {
      if (options?.syncPromptPersonality !== false) {
        agentData.current.prompt_extern_json.personality = updatedText;
      }
      await syncAgentAndWallpaperJson();
    }
  };

  const handleUserTextChange = async (
    currentUserPersonality: string,
    updatedText: string,
  ) => {
    setUserPersonality(updatedText);
    if (currentUserPersonality !== updatedText) {
      agentData.current.prompt_extern_json.user_defined_personality = updatedText;
      await syncAgentAndWallpaperJson();
    }
  };

  const handleVoiceSettingClose = async () => {
    setIsSetVoiceSettingOpen(false);
    agentData.current.prompt_extern_json.voice_id = selectedVoiceIdRef.current;
    await syncAgentAndWallpaperJson();
  };

  return {
    syncAgentAndWallpaperJson,
    handleSaveName,
    handleRoleTextChange,
    handleUserTextChange,
    handleVoiceSettingClose,
  };
};
