/**
 * UE状态相关命令类型定义
 */

// 我发送给UE的命令 （请求改变UE状态）
export interface ChangeUEStateCommand {
  type: 'changeUEState';
  data: {
    state: '3D' | 'EnergySaving';
  };
}

// UE发送给我的命令（请求改变UE状态）
export interface RequestChangeUEStateCommand {
  type: 'requestChangeUEState';
  data: {
    state: '3D' | 'EnergySaving';
  };
}

// UE发送给我的命令（获取UE当前状态）
export interface UEStateCommand {
  type: 'UEState';
  data: {
    state: '3D' | 'EnergySaving';
  };
}

// UE发送给我的命令（AI连接状态）
export interface ChatAgentStateCommand {
  type: 'chatAgentConnectionStatus';
  data: {
    status: 'connected' | 'connecting' | 'disconnected';
  };
}
