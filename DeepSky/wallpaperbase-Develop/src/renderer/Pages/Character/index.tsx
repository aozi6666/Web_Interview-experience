import addIcon from '$assets/icons/WallPaper/add-plus.svg';
import { api, roleRename } from '@api';
import { UESence_AppearEditDynamic } from '@api/IPCRequest/selectUESence';
import { ModelItem } from '@api/types/wallpaper';
import { validateAssetFile } from '@api/validateAsset';
import { loadWallpaperConfig } from '@api/wallpaperConfig';
import { useAppearance } from '@contexts/AppearanceContext';
import { useUser } from '@contexts/UserContext';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Input, message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultDownloadPath } from '../../api/download';
import CommonLayout from '../../components/CommonLayout';
import CommonPagination from '../../components/CommonPagination';
import { useEnsureInteractiveMode } from '../../components/DetailPanel/hooks/useEnsureInteractiveMode';
import { previewActions } from '../../stores/PreviewStore';
import {
  getDefaultAppearanceData,
  isDefaultCharacter,
} from '../../utils/appearanceStorage';
import { openCreateCharacterWindow } from '../../utils/createCharacter';
import { ensureWallpaperBabyRunning } from '../../utils/ensureWallpaperBabyRunning';
import { analytics } from '../../utils/Weblogger/analyticsAPI';
import { getVisitorId } from '../../utils/Weblogger/weblogger';
import { AnalyticsEvent } from '../../utils/Weblogger/webloggerConstance';
import Chat from '../Chat';
import CharacterCard from './CharacterCard';
import { DEFAULT_CHARACTERS, PAGE_SIZE } from './constance';
import { useStyles } from './styles';
import TaskCardList from './TaskCardList';
import { CharacterItem, GenderType } from './types';

const ipcEvents = getIpcEvents();

// 将 ModelItem 转换为 CharacterItem
const convertModelToCharacter = async (
  model: ModelItem,
  currentUsingId?: string,
  basePath?: string | null,
): Promise<CharacterItem> => {
  // 获取 chunk_id
  const chunkId = model.metadata?.chunk_id;
  // 获取头像路径
  const getAvatar = async (): Promise<string> => {
    // 🆕 所有角色（包括默认角色）都优先使用本地截图路径
    if (chunkId) {
      const chunkIdStr = chunkId.toString();
      const previewPath = basePath
        ? `${basePath}/RebuildData/${chunkIdStr}/Capture/preview.png`
        : `./Windows-Pak-WallpaperMate/WallpaperBaby/RebuildData/${chunkIdStr}/Capture/preview.png`;
      // 检查文件是否存在
      const exists = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.CHECK_FILE_EXISTS,
        previewPath,
      );
      if (exists) {
        console.log(`✅ 使用本地截图: ${previewPath}`);
        // 🆕 添加时间戳参数强制刷新图片（避免浏览器缓存）
        // 注意：这里的时间戳会在每次 loadCharacters 调用时重新生成
        return `${previewPath}?t=${Date.now()}`;
      }
    }
    // 如果本地截图不存在，使用原来的逻辑（默认角色使用 original_images，其他角色也使用 original_images）
    return model.metadata?.original_images?.[0]?.url || '';
  };

  // 确保 metadata 是可序列化的（通过 JSON 序列化/反序列化清理）
  const serializableMetadata = JSON.parse(JSON.stringify(model.metadata || {}));

  return {
    id: model.id,
    name: model.name,
    avatar: await getAvatar(),
    description: model.description,
    tags: model.tags,
    createdAt: new Date(model.created_at).toLocaleDateString('zh-CN'),
    author: model.creator_id,
    isUsing: model.id === currentUsingId,
    metadata: serializableMetadata, // 使用可序列化的 metadata
    model_urls: model.model_urls, // 保留模型文件 URL
    additional_files: model.additional_files, // 保留额外文件列表
  };
};

function Character() {
  const { styles } = useStyles();

  const { setMakeUpCharacter } = useAppearance();
  const { isLoggedIn } = useUser();
  const { ensureInteractiveMode } = useEnsureInteractiveMode();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] =
    useState<CharacterItem[]>(DEFAULT_CHARACTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(DEFAULT_CHARACTERS.length);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [selectedGender, setSelectedGender] = useState<GenderType>('all');
  const [isShowCreateCharacter, setIsShowCreateCharacter] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentUEWallpaperGender, setCurrentUEWallpaperGender] =
    useState<GenderType | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [wallpaperConfigParams, setWallpaperConfigParams] = useState<
    Record<string, any>
  >({});
  const [isInitialized, setIsInitialized] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedCharacterIdRef = useRef<string | null>(null);

  // 同步 selectedCharacterId 到 ref
  useEffect(() => {
    selectedCharacterIdRef.current = selectedCharacterId;
    console.log('🔄 更新 selectedCharacterIdRef:', selectedCharacterId);
  }, [selectedCharacterId]);

  /**
   * 检查角色资源完整性
   */
  const checkCharacterResources = useCallback(
    async (character: CharacterItem): Promise<CharacterItem> => {
      const chunkId = character.metadata?.chunk_id;

      // 默认角色不需要检查资源，不显示下载按钮
      if (!chunkId || isDefaultCharacter(chunkId)) {
        return {
          ...character,
          resourceStatus: {
            hasStaticAssets: true,
            hasDynamicAssets: true,
            needsDownload: false,
          },
        };
      }

      try {
        // 检查静态资源
        const staticCheck = await validateAssetFile({
          chunkId,
          type: 'static',
        });

        // 检查动态资源
        const dynamicCheck = await validateAssetFile({
          chunkId,
          type: 'dynamic',
        });

        const hasStaticAssets = staticCheck.success;
        const hasDynamicAssets = dynamicCheck.success;
        const needsDownload = !hasStaticAssets || !hasDynamicAssets;

        console.log(`🔍 角色 ${character.name} (${chunkId}) 资源检查:`, {
          hasStaticAssets,
          hasDynamicAssets,
          needsDownload,
        });

        return {
          ...character,
          resourceStatus: {
            hasStaticAssets,
            hasDynamicAssets,
            needsDownload,
          },
        };
      } catch (error) {
        console.error(`❌ 检查角色 ${character.name} 资源失败:`, error);
        return {
          ...character,
          resourceStatus: {
            hasStaticAssets: false,
            hasDynamicAssets: false,
            needsDownload: true,
          },
        };
      }
    },
    [],
  );

  // 根据选中的性别过滤角色列表
  const filteredCharacters = useMemo(() => {
    let filtered: CharacterItem[];
    if (selectedGender === 'all') {
      filtered = characters;
    } else {
      filtered = characters.filter(
        (char) => char.metadata.gender === selectedGender,
      );
    }

    // 排序：将选中的角色（isUsing: true）排在最前面
    // 使用扩展运算符复制数组，避免修改原数组
    return [...filtered].sort((a, b) => {
      if (a.isUsing && !b.isUsing) return -1; // a 选中，b 未选中，a 排在前面
      if (!a.isUsing && b.isUsing) return 1; // b 选中，a 未选中，b 排在前面
      return 0; // 其他情况保持原顺序
    });
  }, [characters, selectedGender]);

  // 监听容器大小变化
  useEffect(() => {
    const updateContainerWidth = () => {
      if (gridRef.current) {
        // 减去滚动条宽度(8px)和padding(8px)，得到实际可用宽度
        const scrollbarWidth = 8;
        const paddingRight = 8;
        const availableWidth =
          gridRef.current.offsetWidth - scrollbarWidth - paddingRight;
        setContainerWidth(availableWidth);
      }
    };

    // 初始设置
    updateContainerWidth();

    // 监听窗口大小变化
    window.addEventListener('resize', updateContainerWidth);

    // 使用ResizeObserver监听容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (gridRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateContainerWidth();
      });
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateContainerWidth);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // 计算网格列数
  const gridColumns = useMemo(() => {
    const characterCount = filteredCharacters.length;
    const minCardWidth = 180; // 最小卡片宽度
    const gap = 7; // 网格间距

    if (characterCount < 5) {
      // 小于5个时，根据容器宽度计算合适的列数，保证内容不超出容器
      const availableWidth = containerWidth - gap; // 减去最后一个gap
      const maxPossibleColumns = Math.floor(
        (availableWidth + gap) / (minCardWidth + gap),
      );
      return Math.min(6, Math.max(2, maxPossibleColumns));
    }
    // 大于等于5个时，使用最小宽度来计算，确保内容适应容器
    const availableWidth = containerWidth - gap;
    const columns = Math.floor((availableWidth + gap) / (minCardWidth + gap));
    return Math.max(2, columns);
  }, [filteredCharacters.length, containerWidth]);

  // 根据场景ID判断适用的性别
  const getGenderFromSceneId = useCallback(
    (sceneId: string | null): GenderType | null => {
      if (!sceneId) return null;

      // 男性场景
      const maleScenes = ['level_lizi_ppt'];
      // 女性场景
      const femaleScenes = [
        'level_03',
        'level_liquidMetal',
        'level_auroraPolaris',
        'level_classicBar',
        'level_infinityPool',
        'level_trainCarriage',
        'level_waterReflection',
        'level_lamp',
        'level_sakura',
        'level_resort',
        'level_goldenEra',
        'level_ad_airship',
      ];

      if (maleScenes.includes(sceneId)) {
        return 'male';
      }
      if (femaleScenes.includes(sceneId)) {
        return 'female';
      }
      // 不在举例中的场景，返回null表示不适用
      return null;
    },
    [],
  );

  // 获取当前正在使用的壁纸角色的性别
  const currentWallpaperGender = useMemo(() => {
    if (currentUEWallpaperGender) {
      console.log('🎭 使用UE实时性别信息:', currentUEWallpaperGender);
      return currentUEWallpaperGender;
    }

    // 最后降级到本地角色列表的逻辑
    const currentCharacter = characters.find((char) => char.isUsing);
    console.log(
      '📋 使用本地角色性别信息:',
      currentCharacter?.metadata?.gender || 'male',
    );
    return currentCharacter?.metadata?.gender || 'male';
  }, [
    characters,
    currentUEWallpaperGender,
    currentSceneId,
    getGenderFromSceneId,
  ]);

  // 加载角色列表
  const loadCharacters = useCallback(async () => {
    console.log('🔄 开始加载角色列表，当前页码:', currentPage);
    setLoading(true);
    try {
      // 获取默认下载路径作为基础路径
      const basePath = await getDefaultDownloadPath();
      // 🆕 生成刷新时间戳，确保每次刷新都使用新的时间戳
      const refreshTimestamp = Date.now();

      // 使用 ref 获取最新的 selectedCharacterId，避免闭包问题
      const currentSelectedId = selectedCharacterIdRef.current;
      console.log(
        '📋 loadCharacters 使用的 selectedCharacterId:',
        currentSelectedId,
      );

      // 只在第一页处理默认角色
      let defaultCharsWithState: CharacterItem[] = [];
      const defaultCharactersCount = DEFAULT_CHARACTERS.length;

      if (currentPage === 1) {
        defaultCharsWithState = await Promise.all(
          DEFAULT_CHARACTERS.map(async (char) => {
            const chunkId = char.metadata?.chunk_id;
            let { avatar } = char; // 默认使用原来的图片

            // 🆕 检查是否存在本地截图，如果存在则使用
            if (chunkId) {
              const chunkIdStr = chunkId.toString();
              const previewPath = basePath
                ? `${basePath}/RebuildData/${chunkIdStr}/Capture/preview.png`
                : `./Windows-Pak-WallpaperMate/WallpaperBaby/RebuildData/${chunkIdStr}/Capture/preview.png`;

              const exists = await ipcEvents.invokeTo(
                IpcTarget.MAIN,
                IPCChannels.CHECK_FILE_EXISTS,
                previewPath,
              );

              if (exists) {
                console.log(
                  `✅ 默认角色 ${chunkIdStr} 使用本地截图: ${previewPath}`,
                );
                // 🆕 添加刷新时间戳参数强制刷新图片（避免浏览器缓存）
                avatar = `${previewPath}?t=${refreshTimestamp}`;
              }
            }

            const isSelected = char.id === currentSelectedId;
            console.log(
              `🎯 角色 ${char.id} (${char.name}) isUsing: ${isSelected}`,
            );

            return {
              ...char,
              avatar,
              isUsing: isSelected,
            };
          }),
        );

        // 检查默认角色的资源完整性
        const defaultCharsWithResources = await Promise.all(
          defaultCharsWithState.map((char) => checkCharacterResources(char)),
        );

        defaultCharsWithState = defaultCharsWithResources;
        console.log(
          '✅ 第一页：默认角色处理完成（包含资源检测），数量:',
          defaultCharsWithState.length,
        );
      } else {
        console.log('📄 非第一页，跳过默认角色处理');
      }

      // 计算API分页参数
      // 策略：保持每次都获取完整的 PAGE_SIZE 条数据
      // 第1页：显示 8个默认 + 12条API = 20条（第一页会比其他页多）
      // 第2页：显示 12条API（page=2）
      // 第3页：显示 12条API（page=3）
      // 这样可以避免数据跳跃，虽然第一页会多一些数据
      const apiPage = currentPage;
      const apiPageSize = PAGE_SIZE;

      console.log(
        `📊 第${currentPage}页API请求: page=${apiPage}, page_size=${apiPageSize}`,
      );

      const response = await api.getPrivateModelList({
        page: apiPage,
        page_size: apiPageSize,
        model_type: 'digital_human',
        gender: selectedGender === 'all' ? '' : selectedGender,
      });

      if (response.code === 0 && response.data) {
        // 转换所有模型为角色（异步）
        const apiCharacterList = await Promise.all(
          response.data.items.map((model) =>
            convertModelToCharacter(
              model,
              currentSelectedId || undefined,
              basePath,
            ),
          ),
        );

        console.log('✅ API角色处理完成，数量:', apiCharacterList.length);

        // 检查API角色的资源完整性
        const apiCharsWithResources = await Promise.all(
          apiCharacterList.map((char) => checkCharacterResources(char)),
        );
        console.log('✅ API角色资源检测完成');

        // 只在第一页添加默认角色，并按优先级排序
        let finalCharacterList: CharacterItem[];
        if (currentPage === 1) {
          // 第1页：资源完整的API角色 > 默认角色 > 本地无资源API角色
          const completeApiChars = apiCharsWithResources.filter(
            (char) => char.resourceStatus && !char.resourceStatus.needsDownload,
          );
          const incompleteApiChars = apiCharsWithResources.filter(
            (char) => char.resourceStatus && char.resourceStatus.needsDownload,
          );

          console.log('📊 第1页角色排序:', {
            completeApiChars: completeApiChars.length,
            defaultChars: defaultCharsWithState.length,
            incompleteApiChars: incompleteApiChars.length,
          });

          finalCharacterList = [
            ...completeApiChars,
            ...defaultCharsWithState,
            ...incompleteApiChars,
          ];
        } else {
          finalCharacterList = apiCharsWithResources;
        }

        console.log('📋 设置角色列表，总数:', finalCharacterList.length);
        setCharacters(finalCharacterList);

        // 总数 = API总数 + 默认角色数量
        setTotal(response.data.total + DEFAULT_CHARACTERS.length);
      } else {
        // API 调用失败时
        if (currentPage === 1 && defaultCharsWithState.length > 0) {
          // 第一页：至少保留默认角色
          console.warn('⚠️ API 调用失败，第一页仅显示默认角色');
          setCharacters(defaultCharsWithState);
          setTotal(DEFAULT_CHARACTERS.length);
        } else {
          // 其他页：显示空列表
          console.warn('⚠️ API 调用失败，非第一页显示空列表');
          setCharacters([]);
          setTotal(DEFAULT_CHARACTERS.length); // 保持总数，以便分页器正常工作
        }
        message.error(response.message || '加载角色列表失败');
      }
    } catch (error) {
      console.error('❌ 加载角色列表异常:', error);

      // 发生异常时
      try {
        if (currentPage === 1) {
          // 第一页：至少保留默认角色（带资源检测）
          const currentSelectedId = selectedCharacterIdRef.current;
          const fallbackChars = DEFAULT_CHARACTERS.map((char) => ({
            ...char,
            isUsing: char.id === currentSelectedId,
          }));

          // 尝试检测资源
          try {
            const fallbackCharsWithResources = await Promise.all(
              fallbackChars.map((char) => checkCharacterResources(char)),
            );
            console.log(
              '🔄 第一页使用备用默认角色列表（含资源检测），数量:',
              fallbackCharsWithResources.length,
            );
            setCharacters(fallbackCharsWithResources);
          } catch (resourceError) {
            console.warn(
              '⚠️ 资源检测失败，使用无资源状态的角色列表',
              resourceError,
            );
            setCharacters(fallbackChars);
          }

          setTotal(DEFAULT_CHARACTERS.length);
        } else {
          // 其他页：显示空列表
          console.log('🔄 非第一页异常，显示空列表');
          setCharacters([]);
          setTotal(DEFAULT_CHARACTERS.length); // 保持总数
        }
      } catch (fallbackError) {
        console.error('❌ 设置备用角色列表也失败:', fallbackError);
      }

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('加载角色列表失败:', error);
      }
      message.error('加载角色列表失败，请稍候重试');
    } finally {
      setLoading(false);
      console.log('✅ loadCharacters 执行完成');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, checkCharacterResources]); // 添加 checkCharacterResources 依赖

  // 监听页码和创建状态变化（等待初始化完成后再加载角色列表）
  useEffect(() => {
    if (!isShowCreateCharacter && isInitialized) {
      loadCharacters();
    }
  }, [isShowCreateCharacter, loadCharacters, isInitialized]);

  // 监听角色生成完成事件，自动刷新列表
  useEffect(() => {
    const handleCharacterListRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔄 收到角色列表刷新事件:', customEvent.detail);

      // 🆕 延迟一下，确保截图文件已生成
      setTimeout(() => {
        // 刷新角色列表
        loadCharacters();
        message.success('角色列表已更新', 2);
      }, 300);
    };

    // 添加事件监听
    window.addEventListener(
      'character-list-refresh',
      handleCharacterListRefresh,
    );

    // 清理监听器
    return () => {
      window.removeEventListener(
        'character-list-refresh',
        handleCharacterListRefresh,
      );
    };
  }, [loadCharacters]);

  // 解析 defaultHeaderData 字符串，获取 head 字段
  const parseDefaultHeaderData = (defaultHeaderData: string): string | null => {
    try {
      // defaultHeaderData 格式示例：
      // head: "000004",
      // bodyType: "defaultfemale",
      // appearanceData: {...}
      const headMatch = defaultHeaderData.match(/head:\s*"([^"]+)"/);
      if (headMatch && headMatch[1]) {
        return headMatch[1];
      }
      return null;
    } catch (error) {
      console.error('解析 defaultHeaderData 失败:', error);
      return null;
    }
  };

  // 页面初始化时获取当前壁纸信息（提前执行，在 loadCharacters 之前）
  useEffect(() => {
    const loadInitialWallpaperInfo = async () => {
      try {
        console.log('🏁 页面初始化：获取当前壁纸信息...');
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.LOAD_WALLPAPER_CONFIG,
        );

        if (result.success && result.config) {
          const { config } = result;
          const sceneId = config.sceneId || config.levelId;
          const promptExtern = config.libs?.agents?.[0]?.prompt_extern_json;
          const detailSource =
            promptExtern && typeof promptExtern === 'object'
              ? promptExtern
              : config;
          console.log('🎬 页面初始化获取场景:', config);
          console.log('🎬 页面初始化获取场景ID:', sceneId);
          setCurrentSceneId(sceneId);

          // 存储壁纸配置参数
          if (detailSource?.config_params) {
            console.log('📋 存储壁纸配置参数:', detailSource.config_params);
            setWallpaperConfigParams(detailSource.config_params);
          }

          // 从 defaultHeaderData 中获取 head 字段并设置 selectedCharacterId
          if (detailSource?.defaultHeaderData) {
            const { defaultHeaderData } = detailSource;
            console.log('📋 原始 defaultHeaderData:', defaultHeaderData);

            const headValue = parseDefaultHeaderData(defaultHeaderData);
            if (headValue) {
              console.log('✅ 解析到 head 值:', headValue);
              setSelectedCharacterId(headValue);
              console.log('🔄 设置选中角色ID为:', headValue);
            } else {
              console.warn('⚠️ 未能从 defaultHeaderData 中解析出 head 字段');
            }
          } else {
            console.log('⚠️ 配置中没有 defaultHeaderData 字段');
          }
        } else {
          console.warn('⚠️ 页面初始化获取壁纸配置失败');
        }
      } catch (error) {
        console.error('页面初始化获取壁纸信息失败:', error);
      } finally {
        // 无论成功还是失败，都标记为已初始化，允许 loadCharacters 执行
        setIsInitialized(true);
      }
    };

    // 立即执行，确保在 loadCharacters 之前设置好 selectedCharacterId
    loadInitialWallpaperInfo();
  }, []);

  // 从本地配置获取当前壁纸信息，根据壁纸性别设置是否可更换角色
  useEffect(() => {
    const loadCurrentWallpaperGender = async () => {
      try {
        // 🆕 从配置文件读取壁纸ID
        const configResult = await loadWallpaperConfig();

        if (!configResult.success || !configResult.config?.levelId) {
          console.log('📝 没有找到应用的壁纸ID（配置文件）');
          setCurrentUEWallpaperGender(null);
          return;
        }

        const { levelId } = configResult.config;
        console.log('🖼️ 获取当前壁纸性别信息，壁纸ID:', levelId);

        // 获取壁纸详情
        const res = await api.getThemesInfo(levelId);
        if (res.code === 0 && res.data?.wallpaper_detail?.metadata?.gender) {
          const gender = res.data.wallpaper_detail.metadata
            .gender as GenderType;
          console.log('🎭 设置当前壁纸性别为:', gender);
          setCurrentUEWallpaperGender(gender);
        } else {
          console.log('⚠️ 获取壁纸性别信息失败');
          setCurrentUEWallpaperGender(null);
        }
      } catch (error) {
        console.error('❌ 获取壁纸性别信息失败:', error);
        setCurrentUEWallpaperGender(null);
      }
    };

    loadCurrentWallpaperGender();
  }, []); // 🆕 不再依赖 getAppliedWallpaperId

  // 发送角色数据到 UE
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sendCharacterToUE = useCallback((character: CharacterItem) => {
    console.log('sendCharacterToUE', character);

    // 🆕 判断是否为默认角色
    const chunkId = character.metadata.chunk_id;
    let { appearanceData } = character.metadata;

    if (isDefaultCharacter(chunkId)) {
      // 从 localStorage 读取最新的外观数据（不存在时自动使用 DEFAULT_APPEARANCE_DATA）
      appearanceData = getDefaultAppearanceData(chunkId.toString());
    }

    UESence_AppearEditDynamic({
      chunkId: character.metadata.chunk_id,
      gender: character.metadata.gender,
      appearanceData,
      modelId: character.id,
      originalImages: character.metadata.original_images,
    });

    ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.DESKTOP_EMBEDDER_RESTORE_FULLSCREEN,
      'wallpaper-baby',
    );
  }, []);

  // 处理角色选择
  const handleSelectCharacter = (character: CharacterItem) => {
    console.log('handleSelectCharacter', character);
    if (character.isUsing) return; // 已选中的不重复处理

    // 验证性别匹配：只有相同性别的角色才能切换
    if (character.metadata?.gender !== currentWallpaperGender) {
      console.warn('⚠️ 尝试切换不同性别的角色，已阻止', {
        characterGender: character.metadata?.gender,
        currentWallpaperGender,
        characterName: character.name,
      });
      return;
    }

    console.log('handleSelectCharacter', character);
    // 更新本地状态：所有角色的 isUsing 状态
    setCharacters((prev) =>
      prev.map((c) => ({
        ...c,
        isUsing: c.id === character.id,
      })),
    );

    setSelectedCharacterId(character.id);

    // 🆕 判断是否为默认角色
    const chunkId = character.metadata.chunk_id;
    let { appearanceData } = character.metadata;

    if (isDefaultCharacter(chunkId)) {
      // 从 localStorage 读取最新的外观数据（不存在时自动使用 DEFAULT_APPEARANCE_DATA）
      appearanceData = getDefaultAppearanceData(chunkId.toString());
    }

    console.log('UE_SEND_APPEARANCE_APPLY', character);
    ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_APPEARANCE_APPLY, {
      type: 'appearanceApply',
      data: {
        scene:
          character.metadata.gender === 'male'
            ? 'live_level_01'
            : 'live_level_03',
        subLevelData: {
          modelId: character.metadata.chunk_id,
          head: character.metadata.chunk_id,
          bodyType:
            character.metadata.gender === 'male'
              ? 'defaultmale'
              : 'defaultfemale',
          gender: character.metadata.gender,
          appearanceData, // 🆕 使用从 localStorage 读取的数据（如果有）
        },
      },
    });
  };

  // 处理角色预览
  const handlePreview = useCallback(
    (character: CharacterItem) => {
      previewActions.showPreview(
        character.avatar,
        character.name,
        '头像加载失败',
      );
      setSelectedCharacterId(character.id);
    },
    [], // setSelectedCharacterId 是稳定的，不需要加入依赖
  );

  const handleRedownload = useCallback(
    async (
      character: CharacterItem,
      source: 'no-resource' | 'menu' = 'no-resource',
    ) => {
      const downloadEvent =
        source === 'menu'
          ? AnalyticsEvent.MY_ROLES_REDOWNLOAD_CLICK
          : AnalyticsEvent.MY_ROLES_DOWNLOAD_CLICK;
      const basePayload = {
        visitor_id: getVisitorId() || 'unknown',
        chunk_id: character.metadata?.chunk_id,
      };

      // 检查是否有 model_urls
      if (!character.model_urls || character.model_urls.length === 0) {
        message.warning('该角色没有可下载的资源');
        analytics
          .track(downloadEvent, {
            ...basePayload,
            download_success: false,
          })
          .catch(() => {});
        return;
      }

      // 获取 chunk_id 并转换为 number
      const chunkId = Number(character.metadata.chunk_id);
      if (isNaN(chunkId)) {
        message.error('角色 ID 无效，无法下载');
        analytics
          .track(downloadEvent, {
            ...basePayload,
            download_success: false,
          })
          .catch(() => {});
        return;
      }

      // 显示开始下载提示
      const hideLoading = message.loading('开始下载资源...', 0);

      try {
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // 遍历所有 model_urls 并下载
        for (const modelUrl of character.model_urls) {
          try {
            // 从 URL 中提取文件名，如果没有则使用 type 字段
            let fileName = modelUrl.type || 'resource';
            const urlPath = modelUrl.url.split('/').pop();
            if (urlPath && urlPath.includes('.')) {
              // 如果 URL 包含文件扩展名，使用 URL 中的文件名
              fileName = urlPath;
            } else {
              // 否则使用 type 作为文件名，并添加默认扩展名
              fileName = `${modelUrl.type || 'resource'}.zip`;
            }

            console.log(`开始下载: ${fileName} (${modelUrl.url})`);

            const result = await api.createCharacter.downloadBinaryFile(
              modelUrl.url,
              fileName,
              chunkId,
            );

            if (result.success) {
              successCount++;
              console.log(`✅ 下载成功: ${fileName}`);
            } else {
              failCount++;
              const errorMsg = `${fileName}: ${result.error || '下载失败'}`;
              errors.push(errorMsg);
              console.error(`❌ 下载失败: ${errorMsg}`);
            }
          } catch (error) {
            failCount++;
            const errorMsg = `${modelUrl.type || '未知文件'}: ${
              error instanceof Error ? error.message : '下载失败'
            }`;
            errors.push(errorMsg);
            console.error(`❌ 下载异常: ${errorMsg}`, error);
          }
        }

        // 显示下载结果
        const downloadSuccess = failCount === 0;
        if (failCount === 0) {
          message.success(`🎉 所有资源下载成功！共 ${successCount} 个文件`, 3);
        } else if (successCount > 0) {
          message.warning(
            `部分资源下载失败：成功 ${successCount} 个，失败 ${failCount} 个`,
            5,
          );
          console.error('下载失败的资源:', errors);
        } else {
          message.error(`所有资源下载失败`, 5);
          console.error('下载失败的资源:', errors);
        }

        // 📊 我的角色页：下载埋点（含是否下载成功）
        analytics
          .track(downloadEvent, {
            ...basePayload,
            download_success: downloadSuccess,
          })
          .catch(() => {});

        // 🆕 下载完成后，重新检查该角色的资源状态
        if (successCount > 0) {
          console.log('🔄 下载完成，重新检查角色资源状态...');

          // 等待一小段时间确保文件写入完成
          await new Promise((resolve) => setTimeout(resolve, 500));

          // 重新检查该角色的资源状态
          const updatedCharacter = await checkCharacterResources(character);

          // 更新角色列表中该角色的状态
          setCharacters((prev) =>
            prev.map((c) => (c.id === character.id ? updatedCharacter : c)),
          );

          console.log(
            '✅ 角色资源状态已更新:',
            updatedCharacter.resourceStatus,
          );

          // 🆕 刷新整个角色列表以重新排序（资源状态变化可能影响排序位置）
          console.log('🔄 刷新角色列表以重新排序...');
          loadCharacters();
        }
      } catch (error) {
        message.error(
          `下载过程中发生错误: ${
            error instanceof Error ? error.message : '未知错误'
          }`,
        );
        console.error('下载角色资源失败:', error);
        // 📊 下载异常时也记录埋点（download_success: false）
        analytics
          .track(downloadEvent, {
            ...basePayload,
            download_success: false,
          })
          .catch(() => {});
      } finally {
        // 确保在所有情况下都隐藏加载提示
        hideLoading();
      }
    },
    [checkCharacterResources, loadCharacters],
  );

  // 处理角色删除
  const handleDeleteCharacter = useCallback(
    async (character: CharacterItem) => {
      console.log('删除角色:', character);
      const modelId = character.id;
      const chunkId = character.metadata?.chunk_id;

      // 发送删除角色埋点
      const visitorId = getVisitorId();
      analytics
        .track(AnalyticsEvent.DELECT_CHARACTER, {
          chunk_id: chunkId || null,
          visitor_id: visitorId || 'unknown',
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('删除角色埋点失败:', err);
        });

      const res = await api.deleteModel('digital_human', modelId);
      if (res.code === 0) {
        message.success('🎉 角色删除成功');
        // 删除成功后刷新列表
        loadCharacters();
      } else {
        message.error(`🚨 角色删除失败: ${res.data || res.message}`);
      }
    },
    [loadCharacters],
  );

  // 处理性别选择
  const handleClickGender = useCallback((gender: GenderType) => {
    // 📊 我的角色页：顶部筛选按钮埋点
    const eventMap = {
      all: AnalyticsEvent.MY_ROLES_ALL_CLICK,
      male: AnalyticsEvent.MY_ROLES_MALE_CLICK,
      female: AnalyticsEvent.MY_ROLES_FEMALE_CLICK,
    } as const;
    analytics
      .track(eventMap[gender], { visitor_id: getVisitorId() || 'unknown' })
      .catch(() => {});

    setSelectedGender(gender);
    setCurrentPage(1);
  }, []);

  const handleClickCardBtn = useCallback(
    async (character: CharacterItem) => {
      const ready = await ensureInteractiveMode();
      if (!ready) return;

      try {
        ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.BGM_PAUSE, {
          reason: 'appearance',
        });
      } catch (error) {
        console.error('请求暂停背景音乐失败:', error);
      }

      setTimeout(() => {
        sendCharacterToUE(character);
        setMakeUpCharacter(character);
      }, 1000);
    },
    [ensureInteractiveMode, sendCharacterToUE, setMakeUpCharacter],
  );

  // 处理角色重命名
  const handleRenameCharacter = useCallback(
    async (character: CharacterItem) => {
      // 获取 chunk_id
      const chunkId = Number(character.metadata.chunk_id);
      if (isNaN(chunkId)) {
        message.error('角色 ID 无效，无法重命名');
        return;
      }

      let newName = character.name;

      // 使用 Ant Design Modal 替代 prompt
      Modal.confirm({
        title: '重命名角色',
        content: (
          <div style={{ marginTop: 16 }}>
            <Input
              defaultValue={character.name}
              maxLength={6}
              placeholder="请输入角色名称"
              autoFocus
              onClick={() => {
                analytics
                  .track(AnalyticsEvent.MY_ROLES_RENAME_CLICK, {
                    visitor_id: getVisitorId() || 'unknown',
                  })
                  .catch(() => {});
              }}
              onChange={(e) => {
                newName = e.target.value;
              }}
              onPressEnter={() => {
                // 按回车键确认
                const modal = document.querySelector('.ant-modal-confirm');
                if (modal) {
                  const okButton = modal.querySelector(
                    '.ant-btn-primary',
                  ) as HTMLButtonElement;
                  if (okButton) {
                    okButton.click();
                  }
                }
              }}
            />
          </div>
        ),
        okText: '确认',
        cancelText: '取消',
        onCancel: () => {
          analytics
            .track(AnalyticsEvent.MY_ROLES_RENAME_CANCLE_CLICK, {
              visitor_id: getVisitorId() || 'unknown',
            })
            .catch(() => {});
        },
        onOk: async () => {
          analytics
            .track(AnalyticsEvent.MY_ROLES_RENAME_CONFIRM_CLICK, {
              visitor_id: getVisitorId() || 'unknown',
            })
            .catch(() => {});
          try {
            if (!newName || newName.trim() === '') {
              message.warning('角色名称不能为空');
              return false; // 返回 false 阻止 Modal 关闭
            }

            // 验证长度
            if (newName.trim().length > 6) {
              message.warning('角色名称不能超过6个字符');
              return false; // 返回 false 阻止 Modal 关闭
            }

            // 如果名称没有变化，直接关闭 Modal
            if (newName.trim() === character.name) {
              return true;
            }

            // 同时更新角色名称和模型名称
            // 1. 更新角色名称（role）
            await roleRename(chunkId, newName.trim());

            // 2. 更新模型名称（model）- 列表显示的是模型名称
            try {
              await api.updateModel('digital_human', character.id, {
                name: newName.trim(),
              });
            } catch (modelError) {
              // 如果模型更新失败，记录错误但不阻止流程
              console.warn('更新模型名称失败（角色名称已更新）:', modelError);
            }

            // 📊 发送角色重命名埋点
            const visitorId = getVisitorId();
            const eventData = {
              chunk_id: chunkId.toString(),
              old_name: character.name,
              new_name: newName.trim(),
              visitor_id: visitorId || 'unknown',
            };

            // eslint-disable-next-line no-console
            console.log('📊 [Character] 准备发送 change_character_name 埋点:', {
              event: AnalyticsEvent.CHANGE_CHARACTER_NAME,
              data: eventData,
            });

            analytics
              .track(AnalyticsEvent.CHANGE_CHARACTER_NAME, eventData)
              .then((success) => {
                if (success) {
                  // eslint-disable-next-line no-console
                  console.log(
                    '✅ [Character] change_character_name 埋点发送成功',
                  );
                  if (window.electron?.logRenderer) {
                    window.electron.logRenderer
                      .info(
                        '[Character] change_character_name 埋点发送成功',
                        eventData,
                      )
                      .catch(() => {});
                  }
                } else {
                  // eslint-disable-next-line no-console
                  console.warn(
                    '⚠️ [Character] change_character_name 埋点发送返回失败',
                  );
                  if (window.electron?.logRenderer) {
                    window.electron.logRenderer
                      .warn(
                        '[Character] change_character_name 埋点发送返回失败',
                        eventData,
                      )
                      .catch(() => {});
                  }
                }
                return success;
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error(
                  '❌ [Character] change_character_name 埋点发送失败:',
                  err,
                );
                if (window.electron?.logRenderer) {
                  window.electron.logRenderer
                    .error('[Character] change_character_name 埋点发送失败', {
                      error: err,
                      data: eventData,
                    })
                    .catch(() => {});
                }
              });

            message.success('✅ 角色重命名成功');
            // 刷新角色列表
            loadCharacters();
            return true; // 返回 true 允许 Modal 关闭
          } catch (error) {
            console.error('重命名失败:', error);
            message.error(
              `重命名失败: ${
                error instanceof Error ? error.message : '未知错误'
              }`,
            );
            // 返回 false 阻止 Modal 关闭，让用户重试或取消
            return false;
          }
        },
      });
    },
    [loadCharacters],
  );

  // 处理创建角色
  const handleCreateCharacter = useCallback(async () => {
    // 📊 我的角色页：点击创建角色按钮埋点
    analytics
      .track(AnalyticsEvent.MY_ROLES_CREAT_CLICK, {
        visitor_id: getVisitorId() || 'unknown',
      })
      .catch(() => {});

    // 📊 发送创建角色入口埋点（角色库）
    const visitorId = getVisitorId();
    const eventData = {
      visitor_id: visitorId || 'unknown',
    };

    // eslint-disable-next-line no-console
    console.log('📊 [Character] 准备发送 creat_entry_lib 埋点:', {
      event: AnalyticsEvent.CREAT_ENTRY_LIB,
      data: eventData,
    });

    analytics
      .track(AnalyticsEvent.CREAT_ENTRY_LIB, eventData)
      .then((success) => {
        if (success) {
          // eslint-disable-next-line no-console
          console.log('✅ [Character] creat_entry_lib 埋点发送成功');
          if (window.electron?.logRenderer) {
            window.electron.logRenderer
              .info('[Character] creat_entry_lib 埋点发送成功', eventData)
              .catch(() => {});
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('⚠️ [Character] creat_entry_lib 埋点发送返回失败');
          if (window.electron?.logRenderer) {
            window.electron.logRenderer
              .warn('[Character] creat_entry_lib 埋点发送返回失败', eventData)
              .catch(() => {});
          }
        }
        return success;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('❌ [Character] creat_entry_lib 埋点发送失败:', err);
        if (window.electron?.logRenderer) {
          window.electron.logRenderer
            .error('[Character] creat_entry_lib 埋点发送失败', {
              error: err,
              data: eventData,
            })
            .catch(() => {});
        }
      });

    // 检查是否已登录
    if (!isLoggedIn) {
      message.warning('游客无法使用此功能，请先登录');
      return;
    }

    try {
      // ⭐ 确保 WallpaperBaby 正在运行
      const loadingMessage = message.loading('准备创建角色环境...', 0);
      const ensureResult = await ensureWallpaperBabyRunning();
      loadingMessage(); // 关闭 loading

      if (!ensureResult.success) {
        message.error(ensureResult.error || '启动 WallpaperBaby 失败');
        return;
      }

      // 如果是本次启动的，给用户一个提示
      if (ensureResult.wasStarted) {
        message.success('WallpaperBaby 已启动');
      }

      // 隐藏主窗口
      const hideMainResult = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.HIDE_MAIN_WINDOW,
      );
      if (!hideMainResult.success) {
        console.warn('隐藏主窗口失败:', hideMainResult.error);
      }

      // 隐藏Live窗口
      const hideLiveResult = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.HIDE_LIVE_WINDOW,
      );
      if (!hideLiveResult.success) {
        console.warn('隐藏Live窗口失败:', hideLiveResult.error);
      }

      // 打开创建角色窗口
      await openCreateCharacterWindow();
    } catch (error) {
      console.error('创建角色时发生错误:', error);
      message.error('创建角色失败');
    }
  }, [isLoggedIn]);

  return (
    <CommonLayout
      showRightPanel
      rightPanel={<Chat showResetButton={false} />}
      rightPanelWidth={400}
      rightPanelMinHeight={228}
      rightPanelMaxHeight={560}
    >
      <>
        {/* 性别选择区域 */}
        <div className={styles.characterTypeContainer}>
          <div className={styles.characterType}>
            <div
              className={`${styles.characterTypeItem} ${
                selectedGender === 'all' ? 'active' : ''
              }`}
              onClick={() => handleClickGender('all')}
              role="button"
              tabIndex={0}
              aria-pressed={selectedGender === 'all'}
            >
              所有
            </div>
            <div
              className={`${styles.characterTypeItem} ${
                selectedGender === 'male' ? 'active' : ''
              }`}
              onClick={() => handleClickGender('male')}
              role="button"
              tabIndex={0}
              aria-pressed={selectedGender === 'male'}
            >
              男
            </div>
            <div
              className={`${styles.characterTypeItem} ${
                selectedGender === 'female' ? 'active' : ''
              }`}
              onClick={() => handleClickGender('female')}
              role="button"
              tabIndex={0}
              aria-pressed={selectedGender === 'female'}
            >
              女
            </div>
          </div>
          {/* <div className={styles.characterType}>
            <div
              onClick={handleCreateCharacter}
              className={styles.characterTypeItem}
            >
              创建角色
            </div>
          </div> */}
        </div>

        {/* 角色网格 - 根据性别过滤显示 */}
        <div className={styles.wallpaperGrid}>
          <Spin spinning={loading} size="large">
            <div
              ref={gridRef}
              className={styles.wallpaperGridContainer}
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, minmax(175px, 1fr))`,
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                className={styles.createCharacter}
                role="button"
                tabIndex={0}
                onClick={handleCreateCharacter}
              >
                {/* <div clsassName={styles.createCharacterIcon}> */}
                <img src={addIcon} alt="createCharacter" />
                {/* </div> */}
                创建角色
              </div>
              {/* 角色生成任务列表 - 根据性别过滤显示 */}
              <TaskCardList selectedGender={selectedGender} />

              {filteredCharacters.map((character) => (
                <CharacterCard
                  key={`${character.id}-${character.avatar}`}
                  character={character}
                  currentWallpaperGender={currentWallpaperGender}
                  wallpaperConfigParams={wallpaperConfigParams}
                  onSelect={handleSelectCharacter}
                  onPreview={handlePreview}
                  onRedownload={handleRedownload}
                  onDelete={handleDeleteCharacter}
                  onRename={handleRenameCharacter}
                  onCardBtnClick={handleClickCardBtn}
                  allCharacters={filteredCharacters}
                  showNavigation={false}
                />
              ))}
            </div>
          </Spin>
        </div>

        {/* 分页器 */}
        {!loading && total > 0 && (
          <CommonPagination
            current={currentPage}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(page) => {
              analytics
                .track(AnalyticsEvent.MY_ROLES_PAGE_TURN_CLICK, {
                  visitor_id: getVisitorId() || 'unknown',
                  page,
                })
                .catch(() => {});
              setCurrentPage(page);
            }}
          />
        )}
      </>
    </CommonLayout>
  );
}

export default Character;
