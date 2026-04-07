/**
 * 核心命令类型定义
 */

export interface HelloCommand {
  type: 'hello';
  from: string;
}

export interface PingCommand {
  type: 'ping';
  from: string;
  timestamp: number; // 发送时间戳（必填，客户端发送时记录）
  clientId?: string; // 可选：客户端唯一标识
  version?: string; // 可选：客户端版本号
}

export interface PongCommand {
  type: 'pong';
  from: string;
  timestamp: number; // 原始ping的时间戳（必填，用于客户端计算RTT）
  serverTime: number; // 服务端当前时间（必填，用于计算时钟偏移）
  serverVersion?: string; // 可选：服务端版本号
}

export type CoreCommand = HelloCommand | PingCommand | PongCommand;
