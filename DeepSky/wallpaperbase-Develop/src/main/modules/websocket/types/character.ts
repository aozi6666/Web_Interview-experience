/**
 * 角色相关命令类型定义
 */

export interface SetAvatarCommand {
  type: 'setAvatar';
  data: {
    avatarId: string;
  };
}

export interface ChangeClothCommand {
  type: 'changeCloth';
  msgSource?: 'doubao' | 'electron';
}

export interface AppearanceCommand {
  type: 'appearanceSave';
  data: {
    scene: string;
    subLevelData: {
      modelId: string;
      head: string;
      bodyType: string;
      gender: string;
      appearanceData: string;
      originalImages: {
        image_type: string;
        url: string;
      }[];
    };
  };
}

export type AppearanceStatus =
  | 'showBlank' // 白模
  | 'buildStatic' // 静态资源生成
  | 'editStatic' // 静态资源编辑
  | 'buildDynamic' // 动态资源生成
  | 'showDynamic' // 动态资源生成
  | 'editDynamic'; // 动态资源编辑

export interface ChangeAppearanceStatusCommand {
  type: 'charAppearance';
  data: {
    subLevelData: {
      head: string;
      action: AppearanceStatus;
      bodyType: string;
      gender: string;
      appearanceData: any;
    };
  };
}

/**
 * 应用外观(临时)
 */
export interface AppearanceApplyCommand {
  type: 'appearanceApply';
  data: {
    scene: string;
    subLevelData: {
      modelId: string;
      head: string;
      bodyType: string;
      gender: string;
      appearanceData: string;
    };
  };
}

export interface AppearanceReturnCommand {
  type: 'appearanceReturn';
  data: {
    scene: string;
    subLevelData: {
      modelId: string;
      head: string;
      bodyType: string;
      gender: string;
      appearanceData: string;
    };
  };
}

/** 装扮页按钮点击：UE 发送按钮类型用于埋点 */
export interface AppearanceButtonClickCommand {
  type: 'appearanceButtonClick';
  data: {
    buttonType: string;
  };
}
