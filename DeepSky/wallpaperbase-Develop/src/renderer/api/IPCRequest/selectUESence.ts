import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { recordAppearanceStartTime } from '@utils/appearanceAnalytics';
import { logRenderer } from '@utils/logRenderer';

const ipcEvents = getIpcEvents();

/**
 * 展示白模
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UESence_AppearShowBlank = () => {
  logRenderer.info('[UE] 展示白模');
  ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_SELECT_LEVEL, {
    data: {
      scene: 'char_appear_edit_level',
      subLevelData: {
        head: '',
        action: 'showBlank',
        bodyType: 'defaultmale',
        gender: 'male',
        appearanceData: '',
      },
    },
  });
};

/**
 * 展示静态资源
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UESence_AppearEditStatic = (chunkId: number, gender: string) => {
  // 记录装扮开始时间
  recordAppearanceStartTime(chunkId);

  logRenderer.info('[UE] 展示静态资源');
  ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_SELECT_LEVEL, {
    data: {
      scene: 'char_appear_edit_level',
      subLevelData: {
        head: chunkId,
        action: 'editStatic',
        bodyType: gender === 'male' ? 'defaultmale' : 'defaultfemale',
        gender: gender,
        appearanceData: '',
      },
    },
  });
};

/**
 * 编辑动态资源
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UESence_AppearEditDynamic = (data: {
  chunkId: number | string;
  gender: string;
  appearanceData: any;
  modelId: string;
  originalImages: {
    image_type: string;
    url: string;
  }[];
}) => {
  // 记录装扮开始时间
  recordAppearanceStartTime(data.chunkId);

  logRenderer.info('[UE] 编辑动态资源', { chunkId: data.chunkId });
  ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_SELECT_LEVEL, {
    data: {
      scene: 'char_appear_edit_level',
      subLevelData: {
        head: data.chunkId,
        action: 'editAppear',
        bodyType: data.gender === 'male' ? 'defaultmale' : 'defaultfemale',
        gender: data.gender,
        appearanceData: data.appearanceData || '',
        modelId: data.modelId || '',
        originalImages: data.originalImages || '',
      },
    },
  });
};

// ========================= 改变外观状态,不变化场景 =========================

/**
 * 改变外观状态为白模
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UEAppearanceChange_AppearShowBlank = () => {
  logRenderer.info('[UE] 改变外观状态为白模');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: '',
          action: 'showBlank',
          bodyType: 'defaultmale',
          gender: 'male',
          appearanceData: '',
        },
      },
    },
  );
};

/**
 * 改变外观状态为静态资源生成
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UEAppearanceChange_AppearBuildStatic = (
  chunkId: number,
  gender: string,
) => {
  logRenderer.info('[UE] 改变外观状态为静态资源生成');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: chunkId,
          action: 'buildStatic',
          bodyType: gender === 'male' ? 'defaultmale' : 'defaultfemale',
          gender: gender,
          appearanceData: '',
        },
      },
    },
  );
};

/**
 * 改变外观状态为静态资源编辑
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UEAppearanceChange_AppearEditStatic = (
  chunkId: number,
  gender: string,
) => {
  // 记录装扮开始时间
  recordAppearanceStartTime(chunkId);

  logRenderer.info('[UE] 改变外观状态为静态资源编辑');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: chunkId,
          action: 'editStatic',
          bodyType: gender === 'male' ? 'defaultmale' : 'defaultfemale',
          gender: gender,
          appearanceData: '',
        },
      },
    },
  );
};

/**
 * 改变外观状态为动态资源生成
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UEAppearanceChange_AppearBuildDynamic = (
  chunkId: number,
  gender: string,
) => {
  logRenderer.info('[UE] 改变外观状态为动态资源生成');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: chunkId,
          action: 'buildDynamic',
          bodyType: gender === 'male' ? 'defaultmale' : 'defaultfemale',
          gender: gender,
          appearanceData: '',
        },
      },
    },
  );
};

/**
 * 改变外观状态为动态资源生成
 * @param chunkId 角色ID
 * @param gender 性别
 * @returns
 */
export const UEAppearanceChange_AppearShowDynamic = (
  chunkId: number,
  gender: string,
) => {
  logRenderer.info('[UE] 改变外观状态为展示动态资源');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: chunkId,
          action: 'showDynamic',
          bodyType: gender === 'male' ? 'defaultmale' : 'defaultfemale',
          gender: gender,
          appearanceData: '',
        },
      },
    },
  );
};

/**
 * 改变外观状态为动态资源编辑
 * @param chunkId 角色ID
 * @param gender 性别
 * @param appearanceData 外观数据
 * @param isBuilding 是否正在生成动态资源
 * @returns
 */
export const UEAppearanceChange_AppearEditDynamic = (data: {
  chunkId: number;
  gender: string;
  appearanceData: any;
  modelId: string;
  originalImages: {
    image_type: string;
    url: string;
  }[];
}) => {
  // 记录装扮开始时间
  recordAppearanceStartTime(data.chunkId);

  logRenderer.info('[UE] 改变外观状态为动态资源编辑');
  ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    {
      data: {
        subLevelData: {
          head: data.chunkId,
          action: 'editDynamic',
          bodyType: data.gender === 'male' ? 'defaultmale' : 'defaultfemale',
          gender: data.gender,
          appearanceData: data.appearanceData,
          modelId: data.modelId,
          originalImages: data.originalImages,
        },
      },
    },
  );
};
