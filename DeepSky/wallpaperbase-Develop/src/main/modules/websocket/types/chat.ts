/**
 * 聊天相关命令类型定义
 */

export interface PlayerStateBody {
  action: {
    type: string;
  };
  expression: {
    type: string;
  };
}

export interface PlayerStateCommand {
  type: 'playerState';
  action: {
    type: string;
  };
  expression: {
    type: string;
  };
  msgSource?: 'doubao' | 'electron';
}

export interface PreTalkCommand {
  type: 'preTalk';
  data: {
    status: 'listening' | 'thinking' | 'thinkFail' | 'thinkingSuccess';
  };
}

// AI状态消息命令
export interface AiStatusCommand {
  type: 'aiStatus';
  data: {
    status: 'listening' | 'thinking' | 'thinkFail' | 'thinkingSuccess';
  };
}

// 麦克风操作命令
export interface OperateMicCommand {
  type: 'operateMic';
  data: {
    operation: 'open' | 'close';
  };
}

// 语音输入操作命令
export interface OperateSpeechInputCommand {
  type: 'operateSpeechInput';
  data: {
    operation: 'open' | 'close';
  };
}

// 聊天模式切换命令
export interface ChangeChatModeCommand {
  type: 'changeChatMode';
  data: {
    mode: 'call' | 'talkback' | 'typewrite' | 'disable';
    isMicOpen: boolean;
  };
}

// 请求聊天模式命令（UE发送给客户端）
export interface RequestChatModeCommand {
  type: 'requestChatMode';
}

// 文字消息收发统一格式
export interface TextMessageCommand {
  type: 'textMessage';
  data: {
    speaker?: string;
    message: string;
    isFull: boolean;
    isBegin: boolean;
    isEnd: boolean;
    levelName: string;
  };
}

export interface TouchMessageCommand {
  type: 'touchMessage';
  data: {
    message: string;
  };
}

export interface FacialPlayingTimeCommand {
  type: 'facialPlayingTime';
  seq_id: string;
  time: number;
}
