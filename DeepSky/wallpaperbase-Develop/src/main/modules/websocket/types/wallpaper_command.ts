/**
 * 所有壁纸命令联合类型
 */

import type { ActionCommand, MoveCommand } from './action';
import type {
  ChatAudioMuteCommand,
  InterruptCommand,
  MuteCommand,
  PlaySoundCommand,
  SoundCommand,
} from './audio';
import type {
  AppearanceApplyCommand,
  AppearanceCommand,
  ChangeAppearanceStatusCommand,
  ChangeClothCommand,
  SetAvatarCommand,
} from './character';
import type {
  ChangeChatModeCommand,
  FacialPlayingTimeCommand,
  OperateMicCommand,
  OperateSpeechInputCommand,
  PlayerStateCommand,
  PreTalkCommand,
  RequestChatModeCommand,
  TextMessageCommand,
  TouchMessageCommand,
} from './chat';
import type { PropsDataCommand, PropsReactionCommand } from './props';
import type {
  ChangeLevelCommand,
  RecordingCallbackCommand,
  SelectLevelCallbackCommand,
  SelectLevelCommand,
  SelectSceneCommand,
  StartRecordingCommand,
  UpdateLevelCallbackCommand,
  UpdateLevelCommand,
} from './scene';
import type { SettingsCommand } from './settings';
import type {
  ChangeUEStateCommand,
  ChatAgentStateCommand,
  RequestChangeUEStateCommand,
  UEStateCommand,
} from './state';
import type { MouseEventCommand } from './system';
import type {
  EnterEnergySavingModeCommand,
  IsHasAppFullScreenCommand,
  OpenTextWindowCommand,
  StartDisplayCommand,
  StartedCommand,
  UEBootReadyCommand,
  UeIsReadyCommand,
} from './window';
import type { CoreCommand } from './core';

export type WallpaperCommand =
  | MouseEventCommand
  | SelectSceneCommand
  | SelectLevelCommand
  | SelectLevelCallbackCommand
  | UpdateLevelCommand
  | UpdateLevelCallbackCommand
  | StartRecordingCommand
  | RecordingCallbackCommand
  | ActionCommand
  | SoundCommand
  | PlayerStateCommand
  | InterruptCommand
  | PropsReactionCommand
  | PropsDataCommand
  | ChangeLevelCommand
  | SetAvatarCommand
  | MoveCommand
  | PreTalkCommand
  | ChangeClothCommand
  | PlaySoundCommand
  | AppearanceCommand
  | AppearanceApplyCommand
  | ChangeAppearanceStatusCommand
  | MuteCommand
  | ChatAudioMuteCommand
  | OperateMicCommand
  | OperateSpeechInputCommand
  | ChangeChatModeCommand
  | RequestChatModeCommand
  | TextMessageCommand
  | TouchMessageCommand
  | FacialPlayingTimeCommand
  | IsHasAppFullScreenCommand
  | OpenTextWindowCommand
  | EnterEnergySavingModeCommand
  | UEBootReadyCommand
  | UeIsReadyCommand
  | StartDisplayCommand
  | StartedCommand
  | ChangeUEStateCommand
  | RequestChangeUEStateCommand
  | UEStateCommand
  | ChatAgentStateCommand
  | SettingsCommand;

export type OutboundWsMessage = WallpaperCommand | CoreCommand;
export type InboundWsMessage = WallpaperCommand | CoreCommand;
