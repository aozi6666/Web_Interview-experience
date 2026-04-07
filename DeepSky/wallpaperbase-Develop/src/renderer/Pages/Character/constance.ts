import defaultFemale_1 from '$assets/img/default_female_1.png';
import defaultFemale_2 from '$assets/img/default_female_2.png';
import defaultFemale_3 from '$assets/img/default_female_3.png';
import defaultFemale_4 from '$assets/img/default_female_4.png';
import defaultFemale_5 from '$assets/img/default_female_5.jpg';
import defaultMale_1 from '$assets/img/default_male_1.png';
import defaultMale_2 from '$assets/img/default_male_2.png';
import defaultMale_3 from '$assets/img/default_male_3.png';
import defaultMale_4 from '$assets/img/default_male_4.png';
import { CharacterItem } from './types';

// 常量定义
export const PAGE_SIZE = 12;
export const DEFAULT_APPEARANCE_DATA = {
  MakeUp: {
    MakeUpSettings: {
      AllMakeUpGroup: ['AllMakeUp_0000'],
      ContourGroup: ['Contour_0000'],
      FoundationGroup: ['Skin_0000'],
      BlusherGroup: ['Blusher_0000'],
      EyeShadowGroup: ['Eyeshadow_0000'],
      EyeShadowIntensity: 100,
      EyeLineGroup: ['Eyeliner_0000'],
      EyeLineIntensity: 100,
      LipStickGroup: ['Lipstick_0000'],
      LipStickIntensity: 100,
      ContourIntensity: 100,
      BlusherIntensity: 100,
      IrisGroup: ['Iris_0000'],
      EyelashGroup: ['Eyelash_0000'],
    },
    FaceShapeSettings: {
      FaceShape: {
        Face: {
          Top: {
            FaceShapeTopOverallWidthIntensity: 0,
            FaceShapeTopOverallHeightIntensity: 0,
            FaceShapeTopOverallDepthIntensity: 0,
          },
          Middle: {
            Left: {
              FaceShapeMiddleLeftWidthIntensity: 0,
              FaceShapeMiddleLeftHeightIntensity: 0,
              FaceShapeMiddleLeftDepthIntensity: 0,
            },
            Overall: {
              FaceShapeMiddleOverallWidthIntensity: 0,
              FaceShapeMiddleOverallHeightIntensity: 0,
              FaceShapeMiddleOverallDepthIntensity: 0,
            },
            Right: {
              FaceShapeMiddleRightWidthIntensity: 0,
              FaceShapeMiddleRightHeightIntensity: 0,
              FaceShapeMiddleRightDepthIntensity: 0,
            },
          },
          Bottom: {
            FaceShapeBottomOverallWidthIntensity: 0,
            FaceShapeBottomOverallHeightIntensity: 0,
            FaceShapeBottomOverallDepthIntensity: 0,
          },
          DoubleChin: {
            FaceShapeDoubleChinHeightIntensity: 0,
          },
        },
        Eyes: {
          Left: {
            FaceEyeBallLeftHeightIntensity: 0,
            FaceEyeBallLeftWidthIntensity: 0,
            FaceEyeBallLeftDepthIntensity: 0,
            FaceEyeBallLeftRotIntensity: 0,
            FaceEyeBallLeftScaleLengthIntensity: 0,
            FaceEyeBallLeftScaleSizeIntensity: 0,
            FaceEyeBallLeftScaleOpenIntensity: 0,
            FaceEyeBallLeftPupilIntensity: 0,
          },
          Overall: {
            FaceEyeBallOverallHeightIntensity: 0,
            FaceEyeBallOverallWidthIntensity: 0,
            FaceEyeBallOverallDepthIntensity: 0,
            FaceEyeBallOverallRotIntensity: 0,
            FaceEyeBallOverallScaleLengthIntensity: 0,
            FaceEyeBallOverallScaleSizeIntensity: 0,
            FaceEyeBallOverallScaleOpenIntensity: 0,
            FaceEyeBallOverallPupilIntensity: 0,
          },
          Right: {
            FaceEyeBallRightHeightIntensity: 0,
            FaceEyeBallRightWidthIntensity: 0,
            FaceEyeBallRightDepthIntensity: 0,
            FaceEyeBallRightRotIntensity: 0,
            FaceEyeBallRightScaleLengthIntensity: 0,
            FaceEyeBallRightScaleSizeIntensity: 0,
            FaceEyeBallRightScaleOpenIntensity: 0,
            FaceEyeBallRightPupilIntensity: 0,
          },
        },
        Nose: {
          Overall: {
            FaceNoseOverallDepthIntensity: 0,
            FaceNoseOverallScaleLengthIntensity: 0,
            FaceNoseOverallScaleSizeIntensity: 0,
          },
          Angle: {
            FaceNoseOverallAngleTipIntensity: 0,
          },
          Bridge: {
            FaceNoseOverallBridgeWidthIntensity: 0,
            FaceNoseOverallBridgeDepthIntensity: 0,
          },
          Root: {
            FaceNoseOverallRootWidthIntensity: 0,
            FaceNoseOverallRootDepthIntensity: 0,
          },
          Head: {
            FaceNoseHeadBeautyIntensity: 0,
            FaceNoseHeadMiddleIntensity: 0,
            FaceNoseHeadTipWidthIntensity: 0,
            FaceNoseHeadTipDepthIntensity: 0,
          },
          Nostril: {
            Left: {
              FaceNoseHoleLeftScaleWidthIntensity: 0,
            },
            Overall: {
              FaceNoseHoleOverallScaleWidthIntensity: 0,
            },
            Right: {
              FaceNoseHoleRightScaleWidthIntensity: 0,
            },
          },
          Wing: {
            Left: {
              FaceNoseWingLeftDepthIntensity: 0,
              FaceNoseWingLeftHeightIntensity: 0,
              FaceNoseWingLeftScaleLengthIntensity: 0,
              FaceNoseWingLeftScaleWidthIntensity: 0,
            },
            Overall: {
              FaceNoseWingOverallDepthIntensity: 0,
              FaceNoseWingOverallHeightIntensity: 0,
              FaceNoseWingOverallScaleLengthIntensity: 0,
              FaceNoseWingOverallScaleWidthIntensity: 0,
            },
            Right: {
              FaceNoseWingRightDepthIntensity: 0,
              FaceNoseWingRightHeightIntensity: 0,
              FaceNoseWingRightScaleLengthIntensity: 0,
              FaceNoseWingRightScaleWidthIntensity: 0,
            },
          },
        },
        Mouth: {
          FaceShapeMouthPosHeightIntensity: 0,
          FaceShapeMouthPosDepthIntensity: 0,
          FaceShapeMouthScaleWidthIntensity: 0,
          FaceShapeMouthScaleHeightIntensity: 0,
          FaceShapeMouthScaleSizeIntensity: 0,
          FaceShapeMouthTransCornerIntensity: 0,
        },
        Ears: {
          Left: {
            FaceEarsLeftHeightIntensity: 0,
            FaceEarsLeftDepthIntensity: 0,
            FaceEarsLeftScaleWidthIntensity: 0,
            FaceEarsLeftScaleSizeIntensity: 0,
          },
          Overall: {
            FaceEarsOverallHeightIntensity: 0,
            FaceEarsOverallDepthIntensity: 0,
            FaceEarsOverallScaleWidthIntensity: 0,
            FaceEarsOverallScaleSizeIntensity: 0,
          },
          Right: {
            FaceEarsRightHeightIntensity: 0,
            FaceEarsRightDepthIntensity: 0,
            FaceEarsRightScaleWidthIntensity: 0,
            FaceEarsRightScaleSizeIntensity: 0,
          },
        },
      },
    },
  },
  Costume: {
    AppearInfo: [
      {
        ItemID: 0,
        BodyAppearances: 12,
      },
      {
        ItemID: 1,
        BodyAppearances: 5,
      },
      {
        ItemID: -1,
        BodyAppearances: 9,
      },
    ],
  },
};

// 默认角色数据
export const DEFAULT_CHARACTERS: CharacterItem[] = [
  {
    id: '000001',
    name: '男角色1',
    avatar: defaultMale_1,
    description: '系统默认男性角色1',
    tags: ['默认', '男性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'male',
      chunk_id: '000001',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000002',
    name: '女角色1',
    avatar: defaultFemale_1,
    description: '系统默认女性角色1',
    tags: ['默认', '女性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'female',
      chunk_id: '000002',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000003',
    name: '男角色2',
    avatar: defaultMale_2,
    description: '系统默认男性角色2',
    tags: ['默认', '男性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'male',
      chunk_id: '000003',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000004',
    name: '女角色2',
    avatar: defaultFemale_2,
    description: '系统默认女性角色2',
    tags: ['默认', '女性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'female',
      chunk_id: '000004',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000007',
    name: '男角色3',
    avatar: defaultMale_3,
    description: '系统默认男性角色3',
    tags: ['默认', '男性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'male',
      chunk_id: '000007',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000008',
    name: '女角色3',
    avatar: defaultFemale_3,
    description: '系统默认女性角色3',
    tags: ['默认', '女性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'female',
      chunk_id: '000008',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000013',
    name: '男角色4',
    avatar: defaultMale_4,
    description: '系统默认男性角色4',
    tags: ['默认', '男性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'male',
      chunk_id: '000013',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: '000010',
    name: '女角色4',
    avatar: defaultFemale_4,
    description: '系统默认女性角色4',
    tags: ['默认', '女性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'female',
      chunk_id: '000010',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
  {
    id: 'PreviewShowHead_001',
    name: '女角色5',
    avatar: defaultFemale_5,
    description: '系统默认女性角色5',
    tags: ['默认', '女性'],
    createdAt: new Date().toLocaleDateString('zh-CN'),
    author: '系统',
    isUsing: false,
    metadata: {
      gender: 'female',
      chunk_id: 'PreviewShowHead_001',
      appearanceData: DEFAULT_APPEARANCE_DATA,
    },
  },
];

/**
 * 获取所有默认角色的 chunkId 列表
 */
export const getDefaultCharacterIds = (): string[] => {
  return DEFAULT_CHARACTERS.map((char) => char.id);
};

/**
 * 根据 chunkId 判断是否为默认角色
 */
export const isDefaultCharacterId = (chunkId: string | number): boolean => {
  const id = chunkId.toString().padStart(6, '0');
  return getDefaultCharacterIds().includes(id);
};

/**
 * 根据 chunkId 判断性别（奇数为男性，偶数为女性）
 */
export const getGenderByChunkId = (
  chunkId: string | number,
): 'male' | 'female' => {
  const id = parseInt(chunkId.toString(), 10);
  return id % 2 === 1 ? 'male' : 'female';
};

/**
 * 根据 chunkId 获取角色名称（从 DEFAULT_CHARACTERS 中查找）
 */
export const getDefaultCharacterName = (chunkId: string | number): string => {
  const id = chunkId.toString().padStart(6, '0');
  const character = DEFAULT_CHARACTERS.find((char) => char.id === id);
  return (
    character?.name ||
    `默认角色（${getGenderByChunkId(chunkId) === 'male' ? '男性' : '女性'}）`
  );
};

/**
 * 根据 chunkId 获取角色描述（从 DEFAULT_CHARACTERS 中查找）
 */
export const getDefaultCharacterDescription = (
  chunkId: string | number,
): string => {
  const id = chunkId.toString().padStart(6, '0');
  const character = DEFAULT_CHARACTERS.find((char) => char.id === id);
  return (
    character?.description ||
    `系统默认${getGenderByChunkId(chunkId) === 'male' ? '男性' : '女性'}角色`
  );
};

/**
 * 获取默认角色的名称映射表（动态生成）
 */
export const getDefaultCharacterNameMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  DEFAULT_CHARACTERS.forEach((char) => {
    map[char.id] = char.name;
  });
  return map;
};

/**
 * 获取默认角色的描述映射表（动态生成）
 */
export const getDefaultCharacterDescriptionMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  DEFAULT_CHARACTERS.forEach((char) => {
    map[char.id] = char.description;
  });
  return map;
};

/**
 * 获取默认角色的最大 chunkId 数字（用于判断范围）
 */
export const getMaxDefaultCharacterId = (): number => {
  const ids = DEFAULT_CHARACTERS.map((char) => parseInt(char.id, 10));
  return Math.max(...ids);
};
