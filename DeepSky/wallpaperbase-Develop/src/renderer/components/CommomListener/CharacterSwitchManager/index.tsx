import { useCallback, useEffect, useRef } from 'react';
import allDefaultCharacters from '../../../constants/defaultCharacters';
import { useCharacter } from '../../../contexts/CharacterContext';
import {
  characterState,
  setSelectedCharacter,
} from '../../../stores/CharacterStore';

/**
 * 人设切换管理器
 *
 * 职责：
 * 1. 从 localStorage 和默认人设加载所有人设数据
 * 2. 将 switchToCharacter 方法挂载到 characterSelectRef
 * 3. 确保在应用的任何页面都能通过 ref 切换人设
 *
 * 这是一个无UI组件，类似于 UESenceListener
 */
export function CharacterSwitchManager() {
  const { characterSelectRef, handleCharacterSelect } = useCharacter();

  // 使用 ref 缓存人设列表，避免频繁重新加载
  const charactersRef = useRef<any[]>([]);

  /**
   * 加载所有人设数据（默认 + 用户自定义）
   */
  const loadAllCharacters = () => {
    console.log('🔄 CharacterSwitchManager: 加载人设列表');

    // 1. 准备默认人设（带ID）
    const defaultCharsWithIds = allDefaultCharacters.map(
      (char: any, index: number) => ({
        ...char,
        id: `default_${index}`,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
    );

    // 2. 从 localStorage 加载用户自定义人设
    const savedCharacters = localStorage.getItem('characters');
    if (savedCharacters) {
      try {
        const userCharacters = JSON.parse(savedCharacters);

        // 分离默认人设的修改版本和用户自定义人设
        const modifiedDefaults = userCharacters.filter((char: any) =>
          char.id.startsWith('default_'),
        );
        const customCharacters = userCharacters.filter(
          (char: any) => !char.id.startsWith('default_'),
        );

        // 合并：优先使用 localStorage 中的修改版本
        const finalDefaultCharacters = defaultCharsWithIds.map(
          (defaultChar) => {
            const modifiedVersion = modifiedDefaults.find(
              (char: any) => char.id === defaultChar.id,
            );
            return modifiedVersion || defaultChar;
          },
        );

        charactersRef.current = [
          ...finalDefaultCharacters,
          ...customCharacters,
        ];
      } catch (error) {
        console.error('❌ 解析用户人设数据失败:', error);
        charactersRef.current = defaultCharsWithIds;
      }
    } else {
      charactersRef.current = defaultCharsWithIds;
    }

    console.log(
      `✅ CharacterSwitchManager: 已加载 ${charactersRef.current.length} 个人设`,
    );
  };

  /**
   * 根据人设名称切换人设
   * 使用 useCallback 确保函数引用稳定，避免闭包陈旧问题
   */
  const switchToCharacter = useCallback(
    (name: string) => {
      console.log('🎭 CharacterSwitchManager: 切换人设 ->', name);

      // 从缓存的人设列表中查找
      const character = charactersRef.current.find(
        (char) => char.name === name,
      );

      if (character) {
        console.log('🔍 找到人设:', character);

        // 保存到 localStorage
        localStorage.setItem('selectedCharacter', JSON.stringify(character.id));

        // 同步到全局 store（Valtio - 唯一状态源）
        setSelectedCharacter(character);
        console.log('🔍 [CharacterSwitchManager] 已更新 valtio store');
        console.log(
          '🔍 [CharacterSwitchManager] 验证更新:',
          characterState.selectedCharacter?.name,
        );

        // 通知 Context（仅用于日志和副作用）
        if (handleCharacterSelect) {
          handleCharacterSelect(character);
        }

        console.log('✅ CharacterSwitchManager: 人设切换成功 ->', name);
      } else {
        console.warn(`⚠️ CharacterSwitchManager: 未找到名为 "${name}" 的人设`);
        console.log(
          '📋 当前可用人设列表:',
          charactersRef.current.map((c) => c.name),
        );
      }
    },
    [handleCharacterSelect],
  );

  // 初始化：加载人设并挂载方法到 ref
  useEffect(() => {
    console.log('🎯 CharacterSwitchManager: 初始化');

    // 加载所有人设
    loadAllCharacters();

    // 监听 localStorage 变化，重新加载人设列表
    const handleStorageChange = () => {
      console.log(
        '🔄 CharacterSwitchManager: 检测到 storage 变化，重新加载人设',
      );
      loadAllCharacters();
    };

    window.addEventListener('storage', handleStorageChange);

    // 清理函数
    return () => {
      console.log('🧹 CharacterSwitchManager: 清理');
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 单独的 useEffect 用于更新 characterSelectRef，依赖 switchToCharacter
  useEffect(() => {
    if (characterSelectRef) {
      characterSelectRef.current = {
        switchToCharacter,
      };
      console.log(
        '✅ CharacterSwitchManager: switchToCharacter 方法已挂载/更新',
      );
    }

    return () => {
      if (characterSelectRef) {
        characterSelectRef.current = null;
      }
    };
  }, [characterSelectRef, switchToCharacter]);

  // 这是一个纯管理组件，不渲染任何 UI
  return null;
}

export default CharacterSwitchManager;
