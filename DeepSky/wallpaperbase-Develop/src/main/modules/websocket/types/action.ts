/**
 * 动作相关命令类型定义
 */

export interface ActionCommand {
  type: 'action';
  data: {
    action: string;
    name?: string;
    data?: any;
  };
  msgSource?: 'doubao' | 'electron';
}

export interface MoveCommand {
  type: 'moveCommand';
  data: {
    name: string;
  };
  name?: string;
  msgSource?: 'doubao' | 'electron';
}
