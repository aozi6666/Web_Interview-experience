/**
 * 场景相关命令类型定义
 */

export interface InteractiveDescriptBody {
  name: string;
  description: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  direction: {
    x: number;
    y: number;
    z: number;
  };
}

export interface SelectSceneCommand {
  type: 'select_scene';
  scene: string;
  interactionPointData: InteractiveDescriptBody[];
}

export interface SelectLevelCommand {
  type: 'selectLevel';
  data: {
    scene: string;
    subLevelData?: any;
  };
}

export interface SelectLevelCallbackCommand {
  type: 'selectLevelCallback';
  result?: 'accept' | 'success' | string;
  levelName?: string;
  // 兼容旧格式
  data?: {
    scene?: string;
    subLevelData?: any;
  };
}

export interface UpdateLevelCommand {
  type: 'updateLevel';
  data: {
    scene: string;
    subLevelData?: any;
  };
  msgSource?: 'doubao' | 'electron';
}

export interface UpdateLevelCallbackCommand {
  type: 'updateLevelCallback';
  result: string;
  levelName: string;
}

export interface ChangeLevelCommand {
  type: 'changeLevel';
}

export interface StartRecordingCommand {
  type: 'startRecording';
  data: {
    duration: number;
    outputPath?: string;
  };
}

export interface RecordingCallbackCommand {
  type: 'recordingCallback';
  result: 'success' | 'failed';
  data: {
    filePath: string;
    duration: number;
    error?: string;
  };
}
