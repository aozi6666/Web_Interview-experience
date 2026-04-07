import { IPCChannels } from '@shared/channels';
import { mainHandle, mainRemoveHandler } from '../../../ipc-events';
import { bgmAudioService } from '../../store/managers/BGMAudioService';
import { bgmManager } from '../../store/managers/StoreManager';
import { getUEStateManager } from '../../ue-state/managers/UEStateManager';
import { WsService } from '../core/ws-service';
import type {
  ActionCommand,
  AppearanceApplyCommand,
  AppearanceCommand,
  ChangeAppearanceStatusCommand,
  ChangeChatModeCommand,
  InterruptCommand,
  MoveCommand,
  OperateMicCommand,
  OperateSpeechInputCommand,
  PlayerStateBody,
  PreTalkCommand,
  PropsDataCommand,
  PropsReactionCommand,
  SelectLevelCommand,
  SoundBody,
  StartRecordingCommand,
  TextMessageCommand,
  UpdateLevelCommand,
} from '../types';

type IpcMapping<T> = {
  channel: string;
  build: (args: T) => any;
};

const MAPPINGS: IpcMapping<any>[] = [
  {
    channel: IPCChannels.UE_SEND_SOUND,
    build: (args: SoundBody) => ({ type: 'sound', sound: { ...args } }),
  },
  {
    channel: IPCChannels.UE_SEND_PLAYER_STATE,
    build: (args: PlayerStateBody) => ({
      type: 'playerState',
      action: args.action,
      expression: args.expression,
    }),
  },
  { channel: IPCChannels.UE_SEND_ACTION, build: (args: ActionCommand) => args },
  {
    channel: IPCChannels.UE_SEND_INTERRUPT,
    build: (args: InterruptCommand) => ({
      type: 'interrupt',
      chat_id: args.chat_id,
    }),
  },
  {
    channel: IPCChannels.UE_SEND_PROPS_REACTION,
    build: (args: PropsReactionCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_PROPS_DATA,
    build: (args: PropsDataCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_CHANGE_LEVEL,
    build: () => ({ type: 'changeLevel' }),
  },
  {
    channel: IPCChannels.UE_SEND_MOVE_COMMAND,
    build: (args: MoveCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_PRE_TALK,
    build: (args: PreTalkCommand) => ({ type: 'preTalk', data: args.data }),
  },
  {
    channel: IPCChannels.UE_SEND_APPEARANCE_COMMAND,
    build: (args: AppearanceCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_CHANGE_CLOTH_COMMAND,
    build: () => ({ type: 'changeCloth', msgSource: 'electron' }),
  },
  {
    channel: IPCChannels.UE_SEND_APPEARANCE_APPLY,
    build: (args: AppearanceApplyCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_TEXT_MESSAGE,
    build: (args: TextMessageCommand) => args,
  },
  {
    channel: IPCChannels.UE_OPERATE_MIC,
    build: (args: OperateMicCommand) => args,
  },
  {
    channel: IPCChannels.UE_OPERATE_SPEECH_INPUT,
    build: (args: OperateSpeechInputCommand) => args,
  },
  {
    channel: IPCChannels.UE_CHANGE_CHAT_MODE,
    build: (args: ChangeChatModeCommand) => args,
  },
  {
    channel: IPCChannels.UE_SEND_START_RECORDING,
    build: (args: StartRecordingCommand) => args,
  },
];

export function registerIpcBridge(wsService: WsService): void {
  MAPPINGS.forEach((mapping) => {
    mainHandle(mapping.channel, (_e, args) =>
      wsService.send(mapping.build(args)),
    );
  });

  mainHandle(
    IPCChannels.UE_SEND_SELECT_LEVEL,
    async (_e, args: SelectLevelCommand) => {
      const sceneId = args.data?.scene || 'unknown';
      const ueStateManager = getUEStateManager();
      console.log('UE_SEND_SELECT_LEVEL', sceneId, args.data);
      return ueStateManager.selectScene(sceneId, args.data);
    },
  );

  mainHandle(
    IPCChannels.UE_SEND_UPDATE_LEVEL,
    async (_e, args: UpdateLevelCommand) => {
      const sceneId = args.data?.scene || 'unknown';
      const ueStateManager = getUEStateManager();
      console.log('UE_SEND_UPDATE_LEVEL', sceneId, args.data);
      return ueStateManager.updateCurrentScene(sceneId, args.data);
    },
  );

  mainHandle(
    IPCChannels.UE_SEND_CHANGE_APPEARANCE_STATUS,
    (_e, args: ChangeAppearanceStatusCommand) => {
      const ueStateManager = getUEStateManager();
      return ueStateManager.changeAppearanceStatus(args);
    },
  );

  mainHandle(IPCChannels.GET_WS_CONNECTION_STATUS, () => ({
    success: true,
    isConnected: wsService.isConnected(),
  }));

  mainHandle(IPCChannels.GET_WS_LATENCY_STATS, () => ({
    success: true,
    stats: null,
  }));

  mainHandle(IPCChannels.UE_GET_CURRENT_SCENE, () => {
    const ueStateManager = getUEStateManager();
    const scene = ueStateManager.getCurrentScene();
    return {
      success: true,
      scene: scene?.name || null,
      data: scene?.data,
      timestamp: Date.now(),
    };
  });

  mainRemoveHandler(IPCChannels.UE_SIMULATE_APPEARANCE_BUTTON_CLICK);
  mainHandle(
    IPCChannels.UE_SIMULATE_APPEARANCE_BUTTON_CLICK,
    (_e, args: { buttonType: string }) => {
      wsService.forwardToRenderer(IPCChannels.UE_FORM_APPEARANCE_BUTTON_CLICK, {
        buttonType: args?.buttonType || 'unknown',
      });
      return { success: true };
    },
  );

  mainHandle(
    IPCChannels.UE_SEND_BGM_VOLUME,
    (_e, args: { volume?: number; data?: { volume?: number } }) => {
      const volume = args?.volume ?? args?.data?.volume;
      if (typeof volume === 'number') {
        bgmManager.setVolume(volume);
        bgmAudioService.syncState();
      }
      return { success: true };
    },
  );
}
