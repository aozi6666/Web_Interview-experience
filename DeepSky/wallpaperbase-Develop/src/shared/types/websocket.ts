/**
 * WebSocket 类型定义 -- 渲染进程需要使用的子集
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

export interface ChangeChatModeCommand {
  type: 'changeChatMode';
  data: {
    mode: 'call' | 'talkback' | 'typewrite' | 'disable';
    isMicOpen: boolean;
  };
}
