/**
 * 道具相关命令类型定义
 */

export interface PropsDataCommand {
  type: 'propsData';
  data: {
    propsName: string;
  };
}

export interface PropsReactionCommand {
  type: 'propsReaction';
  data: {
    hitBodyPart: string;
  };
}
