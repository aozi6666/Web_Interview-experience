import { api } from '@api';
import { message } from 'antd';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_APPEARANCE_DATA,
  DEFAULT_CHARACTERS,
  getDefaultCharacterDescription,
  getDefaultCharacterName,
  getGenderByChunkId,
} from '../pages/Character/constance';
import { CharacterItem } from '../pages/Character/types';
import { isDefaultCharacter as isDefaultCharacterUtil } from '../utils/appearanceStorage';

// 定义外观数据类型
export interface AppearanceData {
  scene: string;
  chunkId: number;
  gender: string;
  appearanceData: string;
  timestamp: number;
  from: string;
  modelId: string; // 可选的模型ID，用于更新已存在的模型
  originalImages: {
    image_type: string;
    url: string;
  }[];
}

// localStorage 存储的数据类型
export interface StoredAppearanceData {
  chunkId: number;
  gender: string;
  appearanceData: string;
  timestamp: number;
  version: string;
  originalImages?: { image_type: string; url: string }[];
}

// 定义 Context 类型
interface AppearanceContextType {
  // 当前外观数据
  currentAppearance: AppearanceData | null;
  // 处理外观数据的方法（供 Listener 调用）
  processAppearanceData: (data: AppearanceData) => Promise<void>;
  setMakeUpCharacter: (character: CharacterItem) => void;
  // 获取默认角色装扮数据（永远返回有效数据）
  getDefaultAppearance: (gender: 'male' | 'female') => StoredAppearanceData;
}

// 创建 Context
const AppearanceContext = createContext<AppearanceContextType | undefined>(
  undefined,
);

// Provider 组件的 props 类型
interface AppearanceProviderProps {
  children: ReactNode;
}

// LocalStorage 键名（按 chunkId 存储）
const getStorageKey = (chunkId: string) => `appearance_data_${chunkId}`;

// 保存默认角色到 localStorage（按 chunkId 存储）
const saveDefaultAppearanceToLocal = (data: AppearanceData): boolean => {
  const chunkId = data.chunkId.toString();
  const storageKey = getStorageKey(chunkId);
  const storedData: StoredAppearanceData = {
    chunkId: data.chunkId,
    gender: data.gender,
    appearanceData: data.appearanceData,
    timestamp: Date.now(),
    version: '1.0',
    originalImages: data.originalImages,
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(storedData));
    console.log(`✅ 默认角色 ${chunkId} 已保存到本地`);
    return true;
  } catch (error) {
    console.error('❌ 保存到 localStorage 失败:', error);
    return false;
  }
};

// 从 localStorage 获取默认角色数据（不存在则返回 DEFAULT_APPEARANCE_DATA）
const getDefaultAppearanceFromLocal = (
  chunkId: string,
): StoredAppearanceData => {
  const storageKey = getStorageKey(chunkId);

  try {
    const data = localStorage.getItem(storageKey);
    if (data) {
      const parsed = JSON.parse(data);
      console.log(`✅ 从 localStorage 获取默认角色: ${chunkId}`);
      return parsed;
    }
  } catch (error) {
    console.error('❌ 读取 localStorage 失败，使用默认数据:', error);
  }

  // localStorage 无数据或出错，返回默认装扮数据
  console.log(`⚠️ 使用 DEFAULT_APPEARANCE_DATA (chunkId: ${chunkId})`);

  // 根据 chunkId 确定性别（奇数为男性，偶数为女性）
  const gender = getGenderByChunkId(chunkId);

  return {
    chunkId: parseInt(chunkId, 10),
    gender,
    appearanceData: JSON.stringify(DEFAULT_APPEARANCE_DATA),
    timestamp: Date.now(),
    version: '1.0',
    originalImages: [],
  };
};

// 提取公共方法：构建模型信息
const buildModelInfo = (data: AppearanceData) => {
  const appearanceData = JSON.parse(data.appearanceData);
  const chunkId = data.chunkId.toString();

  // 从 DEFAULT_CHARACTERS 动态获取名称和描述
  const name = getDefaultCharacterName(chunkId);
  const description = getDefaultCharacterDescription(chunkId);

  return {
    name,
    description,
    metadata: {
      gender: data.gender,
      chunk_id: data.chunkId,
      appearanceData,
    },
  };
};

const handleAppearanceUpdate = async (data: {
  modelId: string;
  appearanceData: AppearanceData;
  originalImages: {
    image_type: string;
    url: string;
  }[];
}) => {
  let modelInfo;
  const chunkId = data.appearanceData.chunkId.toString();

  // 使用统一的 isDefaultCharacter 判断
  if (isDefaultCharacterUtil(chunkId)) {
    modelInfo = buildModelInfo(data.appearanceData);
  } else {
    const appearanceData = JSON.parse(data.appearanceData.appearanceData);
    modelInfo = {
      metadata: {
        appearanceData,
        chunk_id: data.appearanceData.chunkId,
        gender: data.appearanceData.gender,
        original_images: data.originalImages,
      },
    };
  }

  console.log('appearanceData', data);
  console.log('modelInfo', modelInfo);

  const res = await api.updateModel('digital_human', data.modelId, modelInfo);
  if (res.code === 0) {
    message.success('🎉 外观数据更新成功');
  } else {
    message.error(`🚨 外观数据更新失败: ${res.error}`);
  }
};

// Provider 组件
export function AppearanceProvider({ children }: AppearanceProviderProps) {
  const [currentAppearance, setCurrentAppearance] =
    useState<AppearanceData | null>(null);

  const [makeUpCharacter, setMakeUpCharacter] = useState<CharacterItem | null>(
    null,
  );

  // 🔑 使用 Ref 存储最新的 makeUpCharacter，避免闭包陷阱
  const makeUpCharacterRef = useRef<CharacterItem | null>(null);

  // 🔄 同步 state 到 ref（立即更新，不受渲染周期影响）
  useEffect(() => {
    makeUpCharacterRef.current = makeUpCharacter;
    console.log('🔄 makeUpCharacterRef 已更新:', makeUpCharacter?.name);
  }, [makeUpCharacter]);

  /**
   * 处理外观数据的方法
   * 该方法会被 UEAppearanceListener 调用
   * 不包含壁纸重置逻辑（由 Listener 负责）
   */
  const processAppearanceData = useCallback(
    async (data: AppearanceData) => {
      console.log('💄 AppearanceContext 开始处理外观数据:', data);

      try {
        setCurrentAppearance(data);

        const chunkId = data.chunkId.toString();
        const isDefault = isDefaultCharacterUtil(chunkId);

        if (isDefault) {
          // 默认角色：保存到 localStorage，不创建到数据库
          console.log('📦 检测到默认角色，保存到 localStorage:', chunkId);
          saveDefaultAppearanceToLocal(data);
        } else {
          // 自定义角色：更新到数据库
          console.log('模型已存在，执行更新:', chunkId);
          await handleAppearanceUpdate({
            modelId: data.modelId || '',
            appearanceData: data,
            originalImages: data.originalImages || [],
          });
        }

        console.log('⏰ 等待200ms后通知角色库刷新列表...');
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 200);
        });

        // 发送自定义事件通知角色库页面刷新
        const refreshEvent = new CustomEvent('character-list-refresh', {
          detail: {
            chunkId: data.chunkId,
            reason: 'appearance_updated',
          },
        });
        window.dispatchEvent(refreshEvent);
        console.log('📢 已发送角色列表刷新事件');
      } catch (error) {
        console.error('❌ 处理外观数据时出错:', error);
        throw error; // 重新抛出错误，让调用者处理
      }
    },
    [], // ✨ 依赖数组为空，因为使用 ref 访问最新值
  );

  // 获取默认角色装扮数据（供外部调用）
  const getDefaultAppearance = useCallback(
    (chunkIdOrGender: string | 'male' | 'female') => {
      // 兼容旧的 gender 参数，转换为 chunkId
      let chunkId = chunkIdOrGender;
      if (chunkIdOrGender === 'male') {
        // 默认使用第一个男性角色（奇数 chunkId）
        const maleCharacters = DEFAULT_CHARACTERS.filter(
          (char) => char.metadata.gender === 'male',
        );
        chunkId = maleCharacters[0]?.id || '000001';
      } else if (chunkIdOrGender === 'female') {
        // 默认使用第一个女性角色（偶数 chunkId）
        const femaleCharacters = DEFAULT_CHARACTERS.filter(
          (char) => char.metadata.gender === 'female',
        );
        chunkId = femaleCharacters[0]?.id || '000002';
      }
      return getDefaultAppearanceFromLocal(chunkId);
    },
    [],
  );

  const contextValue: AppearanceContextType = useMemo(() => {
    console.log('🔄 AppearanceContext useMemo 重新计算:', {
      currentAppearance,
      timestamp: new Date().toISOString(),
    });
    return {
      currentAppearance,
      processAppearanceData,
      setMakeUpCharacter,
      getDefaultAppearance,
    };
  }, [currentAppearance, processAppearanceData, getDefaultAppearance]);

  return (
    <AppearanceContext.Provider value={contextValue}>
      {children}
    </AppearanceContext.Provider>
  );
}

// 自定义 Hook 用于使用 Context
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}

// 导出 Context 本身（如果需要）
export { AppearanceContext };
