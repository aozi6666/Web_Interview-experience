/**
 * 窗口相关命令类型定义
 */

export interface IsHasAppFullScreenCommand {
  type: 'isHasAppFullScreen';
  data: {
    status: boolean;
  };
}

export interface OpenTextWindowCommand {
  type: 'openTextWindow';
  data: {
    operation: 'open' | 'close';
    status?: 'opened' | 'closed';
  };
}

export interface EnterEnergySavingModeCommand {
  type: 'enterEnergySavingMode';
}

export interface UeIsReadyCommand {
  type: 'ueIsReady';
}

export interface UEBootReadyCommand {
  type: 'ueBootReady';
  data: {
    sceneType: 'empty' | 'subLevel';
    hasSubLevelLoaded: boolean;
    levelName?: string;
  };
}

export interface StartDisplayCommand {
  type: 'startDisplay';
}

export interface StartedCommand {
  type: 'ueHasStarted';
}
