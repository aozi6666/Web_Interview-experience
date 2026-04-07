import { simulateAppearanceButtonClick } from '@api/IPCRequest/baseMainCommand';
import storeManagerAPI from '@api/storeManager';
import { CommonListener } from '@components/CommomListener';
import ConversationModal from '@components/ConversationModal';
import LoadInAppOnce from '@components/LoadInAppOnce';
import PreviewModal from '@components/PreviewModal';
import ProgressToast from '@components/ProgressToast';
import { UserProvider } from '@contexts/UserContext';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { getWallpaperPromptExtern } from '@shared/types';
import { logRenderer } from '@utils/logRenderer';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { App as AntdApp } from 'antd';
import { type ReactNode, useEffect } from 'react';
import {
  MemoryRouter as Router,
  useNavigate,
  useRoutes,
} from 'react-router-dom';
import { loadWallpaperConfig } from './api/wallpaperConfig';
import { useAppStyles } from './AppStyles';
import NavBar from './components/NavBar';
import RouteTracker from './components/RouteTracker';
import WindowHeader from './components/WindowHeader';
import { AppearanceProvider } from './contexts/AppearanceContext';
import { CharacterProvider } from './contexts/CharacterContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
import { RTCContextProvider } from './contexts/RTCContext';
import { SystemStatusProvider } from './contexts/SystemStatusContext';
import { TaskPollingProvider } from './contexts/TaskPollingContext';
import { VersionCheckProvider } from './contexts/VersionCheckContext';
import routes from './router/routes';
import { fetchAndCacheWECharacter } from './pages/WEWallpaper/weCharacter';
import { composeProviders } from './utils/composeProviders';
import cozeTokenManager from './utils/CozeTokenManager';
import {
  isUeAutoStartDisabledForDebug,
} from './utils/ensureWallpaperBabyRunning';

const ipcEvents = getIpcEvents();
const OwnerRTCProvider = ({ children }: { children: ReactNode }) => (
  <RTCContextProvider mode="owner">{children}</RTCContextProvider>
);

const AppProviders = composeProviders(
  AntdApp,
  UserProvider,
  FullscreenProvider,
  SystemStatusProvider,
  CharacterProvider,
  TaskPollingProvider,
  OwnerRTCProvider,
  AppearanceProvider,
);

function AppRoutes() {
  const navigate = useNavigate();

  // 监听路由导航消息
  useEffect(() => {
    if (!window.electron) {
      return;
    }

    const handleNavigateToRoute = (data: any) => {
      console.log('收到路由导航消息:', data);
      if (data?.route) {
        console.log('导航到路由:', data.route);
        navigate(data.route);
      }
    };

    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.NAVIGATE_TO_ROUTE,
      handleNavigateToRoute,
    );

    // 也监听强制导航事件
    const handleForceNavigate = (event: any) => {
      console.log('收到强制导航事件:', event.detail);
      if (event.detail?.route) {
        console.log('通过强制事件导航到路由:', event.detail.route);
        navigate(event.detail.route);
      }
    };

    window.addEventListener('force-navigate', handleForceNavigate);

    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.NAVIGATE_TO_ROUTE,
        handleNavigateToRoute,
      );
      window.removeEventListener('force-navigate', handleForceNavigate);
    };
  }, [navigate]);

  const element = useRoutes(routes);
  return element;
}

export default function App() {
  const { styles } = useAppStyles();
  // 初始化各项服务
  useEffect(() => {
    // 恢复默认行为：自动启动 UE/we_backend。
    // 兼容旧调试版本留下的禁用开关（仅迁移一次）。
    try {
      const disableKey = 'rtc_debug_disable_ue_autostart';
      const migratedKey = 'rtc_debug_disable_ue_autostart_migrated_v2';
      if (
        localStorage.getItem(disableKey) === '1' &&
        localStorage.getItem(migratedKey) !== '1'
      ) {
        localStorage.removeItem(disableKey);
        localStorage.setItem(migratedKey, '1');
        console.warn(
          '🔁 [RTC调试] 已清理旧版自动禁用开关，恢复 UE/we_backend 自动启动',
        );
      }
    } catch (error) {
      console.warn('迁移 RTC 调试开关失败:', error);
    }
    // 记录渲染进程启动日志
    logRenderer.info('渲染进程启动');

    // [测试用] 暴露装扮页埋点模拟，控制台可调用：__simulateAppearanceButtonClick('compare') 或 _simulateAppearanceButtonClick('compare')
    (window as any).__simulateAppearanceButtonClick =
      simulateAppearanceButtonClick;
    (window as any)._simulateAppearanceButtonClick =
      simulateAppearanceButtonClick;

    // 发送应用启动埋点
    analytics
      .track(AnalyticsEvent.APP_LAUNCH, {
        app_name: 'DeepSpace-WallPaper',
        app_version: '1.0.0',
        platform: 'electron',
        environment: process.env.NODE_ENV || 'production',
        launch_time: new Date().toISOString(),
      })
      .catch((error) => {
        console.error('应用启动埋点失败:', error);
      });

    // 发送应用启动时的页面访问追踪（重要：用于 Umami Overview 数据）
    analytics
      .trackPageView('应用启动', {
        previous_page: '直接访问',
        current_page_path: window.location.pathname || '/',
      })
      .catch((error) => {
        console.error('应用启动页面访问埋点失败:', error);
      });

    // 发送消息收集埋点（包含设备名、处理器、内存、显卡信息）
    const sendMessageCollectEvent = async () => {
      try {
        // 获取设备名
        let deviceName = 'unknown';
        try {
          const deviceResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_DEVICE_NAME,
          );
          if (deviceResult?.success && deviceResult?.data) {
            deviceName = deviceResult.data;
          }
        } catch (error) {
          console.warn('获取设备名失败，使用默认值:', error);
        }

        // 获取处理器信息
        let cpuInfo = 'Unknown CPU';
        try {
          const cpuResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_CPU_INFO,
          );
          if (cpuResult?.success && cpuResult?.data) {
            cpuInfo = cpuResult.data;
          }
        } catch (error) {
          console.warn('获取处理器信息失败，使用默认值:', error);
        }

        // 获取内存信息
        let memoryInfo = 'Unknown Memory';
        try {
          const memoryResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_MEMORY_INFO,
          );
          if (memoryResult?.success && memoryResult?.data) {
            memoryInfo = memoryResult.data;
          }
        } catch (error) {
          console.warn('获取内存信息失败，使用默认值:', error);
        }

        // 获取显卡信息
        let gpuInfo = 'Unknown GPU';
        try {
          const gpuResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_GPU_INFO,
          );
          if (gpuResult?.success && gpuResult?.data) {
            gpuInfo = gpuResult.data;
          }
        } catch (error) {
          console.warn('获取显卡信息失败，使用默认值:', error);
        }

        // 获取存储信息
        let storageInfo = 'Unknown Storage';
        try {
          const storageResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_STORAGE_INFO,
          );
          if (storageResult?.success && storageResult?.data) {
            storageInfo = storageResult.data;
          }
        } catch (error) {
          console.warn('获取存储信息失败，使用默认值:', error);
        }

        // 获取设备 ID
        let deviceId = 'Unknown Device ID';
        try {
          const deviceIdResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_DEVICE_ID,
          );
          if (deviceIdResult?.success && deviceIdResult?.data) {
            deviceId = deviceIdResult.data;
          }
        } catch (error) {
          console.warn('获取设备 ID 失败，使用默认值:', error);
        }

        // 获取产品 ID
        let productId = 'N/A';
        try {
          const productIdResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_PRODUCT_ID,
          );
          if (productIdResult?.success && productIdResult?.data) {
            productId = productIdResult.data;
          }
        } catch (error) {
          console.warn('获取产品 ID 失败，使用默认值:', error);
        }

        // 获取系统类型
        let systemType = 'Unknown System Type';
        try {
          const systemTypeResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_SYSTEM_TYPE,
          );
          if (systemTypeResult?.success && systemTypeResult?.data) {
            systemType = systemTypeResult.data;
          }
        } catch (error) {
          console.warn('获取系统类型失败，使用默认值:', error);
        }

        // 获取触控支持信息
        let touchInfo = '无法检测触控支持';
        try {
          const touchResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.GET_TOUCH_INFO,
          );
          if (touchResult?.success && touchResult?.data) {
            touchInfo = touchResult.data;
          }
        } catch (error) {
          console.warn('获取触控信息失败，使用默认值:', error);
        }

        // 发送消息收集埋点
        await analytics.track(AnalyticsEvent.MESSAGE_COLLECT, {
          device_name: deviceName,
          processor: cpuInfo, // 处理器信息
          memory: memoryInfo, // 内存信息
          graphics_card: gpuInfo, // 显卡信息
          storage: storageInfo, // 存储信息
          device_id: deviceId, // 设备 ID
          product_id: productId, // 产品 ID
          system_type: systemType, // 系统类型
          pen_and_touch: touchInfo, // 笔和触控信息
        });
      } catch (error) {
        console.error('消息收集埋点失败:', error);
      }
    };

    sendMessageCollectEvent();

    // 初始化 Coze Token 管理器
    cozeTokenManager.initialize().catch((error) => {
      console.error('Coze Token 管理器初始化失败:', error);
    });

    fetchAndCacheWECharacter().catch((error) => {
      console.warn('[App] WE 人设缓存刷新失败:', error);
    });

    // 初始化 RTC 连接
    // eslint-disable-next-line no-console
    const initializeRTC = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('🔄 [App] 开始初始化 RTC...');

        // 短暂延迟，等待 Provider 树挂载完成
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });

        // 1. 从配置文件读取当前壁纸
        const configResult = await loadWallpaperConfig();

        if (configResult.success && configResult.config) {
          const { config } = configResult;
          const promptExtern = getWallpaperPromptExtern(config);
          const firstAgent = config.libs?.agents?.[0];
          const accessibleAgentIds = Array.isArray(
            promptExtern?.accessible_agent_ids,
          )
            ? promptExtern.accessible_agent_ids.filter(
                (id): id is string => typeof id === 'string' && id.length > 0,
              )
            : undefined;

          // eslint-disable-next-line no-console
          console.log('📋 [App] 读取壁纸配置成功:', {
            levelId: config.levelId,
            hasCharacterData: !!promptExtern?.name,
          });

          // 2. 从配置中恢复角色信息
          if (promptExtern?.name) {
            // 构建 Character 对象
            const character = {
              id: `wallpaper_${config.levelId}`,
              name: promptExtern.name,
              identity: (promptExtern.identity as string) || '',
              personality: (promptExtern.personality as string) || '',
              languageStyle: (promptExtern.languageStyle as string) || '',
              relationships: (promptExtern.relationships as string) || '',
              experience: (promptExtern.experience as string) || '',
              background: (promptExtern.background as string) || '',
              voice_id: (promptExtern.voice_id as string) || '',
              ResourceType:
                (promptExtern.ResourceType as string) || '',
              ResourceVersion:
                (promptExtern.ResourceVersion as string) || '',
              bot_id: (promptExtern.bot_id as string) || '',
              activeReplyRules: (promptExtern.activeReplyRules as string) || '',
              enable_memory: config.bEnableMemory === true,
              accessible_agent_ids: accessibleAgentIds,
              agent_id:
                typeof firstAgent?.id === 'string' ? firstAgent.id : undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // eslint-disable-next-line no-console
            console.log('👤 [App] 恢复角色信息:', character.name);

            // 3. 发送初始化事件到 RTCContext
            window.dispatchEvent(
              new CustomEvent('app-initialize-rtc', {
                detail: { character },
              }),
            );
          } else {
            // eslint-disable-next-line no-console
            console.log('⚠️ [App] 配置中无角色信息，跳过 RTC 初始化');
          }
        } else {
          // eslint-disable-next-line no-console
          console.log('⚠️ [App] 未找到壁纸配置，跳过 RTC 初始化');
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ [App] 初始化 RTC 失败:', error);
      }
    };

    initializeRTC();

    // 自动启动 WallpaperBaby 动态壁纸（仅 Windows）
    const autoStartWallpaperBaby = async () => {
      try {
        if (navigator.platform !== 'Win32') {
          return;
        }

        if (isUeAutoStartDisabledForDebug()) {
          console.warn(
            '🧪 [RTC调试] 已禁用 WallpaperBaby 自动启动，跳过 autoStartWallpaperBaby',
          );
          return;
        }

        // 0. 检查用户是否已登录
        const tokenResult = await storeManagerAPI.getUserToken();
        if (!tokenResult.success || !tokenResult.data) {
          console.log('❌ 用户未登录，跳过 WallpaperBaby 自动启动');
          return;
        }

        // 1. 查询启动模式（开机自启/手动启动）
        let isAutoStart = false;
        let delaySeconds = 0;

        try {
          const startupMode = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.CHECK_STARTUP_MODE,
          );
          isAutoStart = startupMode?.isAutoStart || false;

          console.log('📊 启动模式查询结果:', startupMode);

          // 2. 如果是开机自启，延迟 20 秒启动 UE
          if (isAutoStart) {
            delaySeconds = 20;
            console.log(
              `⏰ 检测到开机自启，将在 ${delaySeconds} 秒后启动 WallpaperBaby`,
            );
          } else {
            console.log('🖱️ 检测到手动启动，立即启动 WallpaperBaby');
          }
        } catch (error) {
          console.error('❌ 查询启动模式失败，默认立即启动:', error);
        }

        // 3. 应用延迟（静默延迟）
        if (delaySeconds > 0) {
          console.log(`⏳ 开始延迟倒计时: ${delaySeconds} 秒...`);

          // 倒计时日志（每 5 秒输出一次）
          for (let i = delaySeconds; i > 0; i -= 5) {
            if (i === delaySeconds || i <= 5) {
              console.log(`⏳ 还有 ${i} 秒启动 WallpaperBaby...`);
            }
            const waitTime = Math.min(5000, i * 1000);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }

          console.log('✅ 延迟结束，开始启动 WallpaperBaby');
        }

        // 4. 检查自动启动配置
        const isDev = process.env.NODE_ENV === 'development';
        const configResult = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.WALLPAPER_BABY_GET_CONFIG,
        );

        // 开发环境：即使未配置自动启动也尝试启动
        const autoStart = isDev || configResult.data?.autoStart;
        if (!autoStart) {
          console.log('❌ WallpaperBaby 自动启动已禁用');
          return;
        }

        // EnergySaving 默认不需要拉起 UE，用户进入互动模式时再按需启动。
        console.log(
          `⏭️ 跳过 WallpaperBaby 自动启动 (${isDev ? '开发环境' : '生产环境'}, ${isAutoStart ? '开机自启+延迟' : '手动启动'})`,
        );
      } catch (error) {
        console.error('自动启动 WallpaperBaby 异常:', error);
      }
    };

    autoStartWallpaperBaby();
  }, []);

  return (
    <AppProviders>
      <Router>
        {/* 路由跟踪器 - 监听页面浏览事件 */}
        <RouteTracker />

        {/*  公共消息监听器（聚合） */}
        <CommonListener />

        {/* 全局会话弹窗 */}
        <ConversationModal />

        {/* 全局进度提示组件 */}
        <ProgressToast />

        {/* 全局预览弹窗（壁纸库等路由共用 PreviewStore） */}
        <PreviewModal />

        <LoadInAppOnce />

        <VersionCheckProvider>
          <div className={styles.appContainer}>
            {/* 自定义窗口标题栏 */}
            <WindowHeader />

            <div className={styles.contentWrapper}>
              <aside className={styles.sidebar}>
                <NavBar />
              </aside>
              <main className={styles.mainContent}>
                <AppRoutes />
              </main>
            </div>
          </div>
        </VersionCheckProvider>
      </Router>
    </AppProviders>
  );
}
