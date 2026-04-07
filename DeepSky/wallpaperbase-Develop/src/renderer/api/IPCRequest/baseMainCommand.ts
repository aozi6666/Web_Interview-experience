import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

export const IPC_OpenDevTools = () => {
  ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.OPEN_DEVTOOLS);
};

/**
 * [测试用] 模拟装扮页按钮点击，用于验证埋点链路（UE 未接入时）
 * 在控制台可调用：window.__simulateAppearanceButtonClick?.('compare')
 */
export const simulateAppearanceButtonClick = (buttonType: string) => {
  return ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_SIMULATE_APPEARANCE_BUTTON_CLICK,
    {
      buttonType,
    },
  );
};
