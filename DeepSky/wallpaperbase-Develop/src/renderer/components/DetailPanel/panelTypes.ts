export type DetailPanelType =
  | 'undownloaded'
  | 'non-interactive'
  | 'we'
  | 'interactive';

export interface PanelCapabilities {
  modifyCharacter: boolean;
  editName: boolean;
  modifyVoice: boolean;
  modifySetting: boolean;
  modifyUserSetting: boolean;
  modifyScene: boolean;
  modifyMusic: boolean;
  volumeEnabled: boolean;
  resetEnabled: boolean;
  showDownloadButton: boolean;
}

const CAPABILITIES: Record<DetailPanelType, PanelCapabilities> = {
  undownloaded: {
    modifyCharacter: false,
    editName: false,
    modifyVoice: false,
    modifySetting: false,
    modifyUserSetting: false,
    modifyScene: false,
    modifyMusic: false,
    volumeEnabled: false,
    resetEnabled: false,
    showDownloadButton: true,
  },
  'non-interactive': {
    modifyCharacter: false,
    editName: true,
    modifyVoice: true,
    modifySetting: true,
    modifyUserSetting: true,
    modifyScene: false,
    modifyMusic: false,
    volumeEnabled: true,
    resetEnabled: true,
    showDownloadButton: false,
  },
  we: {
    modifyCharacter: false,
    editName: true,
    modifyVoice: true,
    modifySetting: true,
    modifyUserSetting: true,
    modifyScene: true,
    modifyMusic: true,
    volumeEnabled: true,
    resetEnabled: true,
    showDownloadButton: false,
  },
  interactive: {
    modifyCharacter: true,
    editName: true,
    modifyVoice: true,
    modifySetting: true,
    modifyUserSetting: true,
    modifyScene: true,
    modifyMusic: true,
    volumeEnabled: true,
    resetEnabled: true,
    showDownloadButton: false,
  },
};

export function getCapabilities(type: DetailPanelType): PanelCapabilities {
  return CAPABILITIES[type];
}

export function detectPanelType(
  isLocalReady: boolean,
  wallpaperType?: string,
  switchableAvatar?: boolean,
  tags?: string[],
): DetailPanelType {
  if (!isLocalReady) return 'undownloaded';
  if (wallpaperType === 'we') return 'we';

  const normalizedTags = (tags ?? []).map((tag) => tag.trim().toLowerCase());
  if (switchableAvatar || normalizedTags.includes('可互动')) {
    return 'interactive';
  }
  return 'non-interactive';
}
