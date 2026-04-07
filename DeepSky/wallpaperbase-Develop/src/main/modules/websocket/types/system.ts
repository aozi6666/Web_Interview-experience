/**
 * 系统数据命令类型定义
 */

export interface MouseEventCommand {
  type: 'mouseEvent';
  data: {
    type:
      | 'move'
      | 'left_down'
      | 'left_up'
      | 'right_down'
      | 'right_up'
      | 'middle_down'
      | 'middle_up'
      | 'wheel';
    x: number;
    y: number;
    wParam: number;
    timestamp: number;
    wheelDelta?: number;
  };
}
