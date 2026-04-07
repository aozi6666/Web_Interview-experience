import { useUser } from '@contexts/UserContext';
import { IPCChannels } from '@shared/channels';
import { openCreateCharacterWindow } from '@utils/createCharacter';
import { ensureWallpaperBabyRunning } from '@utils/ensureWallpaperBabyRunning';
import { logRenderer } from '@utils/logRenderer';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { message } from 'antd';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Avatar from '../Avatar';
import MenuItem from '../MenuItem';
import {
  NavChatIcon,
  NavCreateCharacterIcon,
  NavMyAssetsIcon,
  NavMyUserIcon,
  NavSettingIcon,
} from './icon';
import { useNavBarStyles } from './styles';
// import { NavMyAssetsIcon } from './icon';
// import { NavCreationCenterIcon } from './icon';
import logoIcon from '$assets/logo.png';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

const CLICK_COUNT = 15;

// 主要菜单项配置（中间区域）- 移到组件外部
const MAIN_MENU_ITEMS_1 = [
  {
    key: '/wallpapers',
    icon: NavMyAssetsIcon,
    label: '壁纸库',
    path: '/wallpapers',
  },
  {
    key: '/my-assets',
    icon: NavMyAssetsIcon,
    label: '我的壁纸',
    path: '/my-assets',
  },
  {
    key: '/character',
    icon: NavMyUserIcon,
    label: '我的角色',
    path: '/character',
  },
  {
    key: '/chat',
    icon: NavChatIcon,
    label: '聊天',
    path: '/chat',
  },
  {
    key: '/we-wallpaper',
    icon: 'WE',
    label: 'WE壁纸',
    path: '/we-wallpaper',
  },
];
const MAIN_MENU_ITEMS_2 = [
  {
    key: '/create-character',
    icon: NavCreateCharacterIcon,
    label: '创建角色',
    path: '/create-character',
  },
];

// 侧边栏按钮埋点映射
const SIDEBAR_CLICK_EVENTS: Record<string, string> = {
  '/my-assets': AnalyticsEvent.SIDEBAR_MY_WALLPAPER_CLICK,
  '/character': AnalyticsEvent.SIDEBAR_MY_ROLES_CLICK,
  '/chat': AnalyticsEvent.SIDEBAR_CHAT_CLICK,
};

// 底部菜单项配置（底部区域）- 移到组件外部
const BOTTOM_MENU_ITEMS = [
  // {
  //   key: '/home',
  //   icon: NavSettingIcon,
  //   label: '后台',
  //   path: '/home',
  // },
];
const BOTTOM_MENU_ITEMS1 = [
  {
    key: '/settings',
    icon: NavSettingIcon,
    label: '设置',
    path: '/settings',
  },
];

function NavBar() {
  const { styles } = useNavBarStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();
  const [clickCount, setClickCount] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [bottomClickCount, setBottomClickCount] = useState(0);
  const bottomTimerRef = useRef<number | null>(null);

  // 使用 useMemo 确保菜单项数组引用稳定
  const mainMenuItems1 = useMemo(() => MAIN_MENU_ITEMS_1, []);
  const mainMenuItems2 = useMemo(() => MAIN_MENU_ITEMS_2, []);
  const bottomMenuItems = useMemo(() => BOTTOM_MENU_ITEMS, []);
  const bottomMenuItems1 = useMemo(() => BOTTOM_MENU_ITEMS1, []);
  // 应用启动时如果当前路由是推荐页面（已被注释），自动跳转到第一个菜单项
  useEffect(() => {
    const currentPath = location.pathname;
    // 如果当前是根路径或推荐页面路径，且推荐菜单已被注释
    if (currentPath === '/') {
      // 跳转到第一个可用的菜单项
      const firstMenuItem = mainMenuItems1[0]; // 我的壁纸
      if (firstMenuItem && firstMenuItem.path) {
        console.log(
          '应用启动：检测到推荐页面路由，自动跳转到第一个菜单项:',
          firstMenuItem.path,
        );
        navigate(firstMenuItem.path);
      }
    }
  }, [location.pathname, mainMenuItems1, navigate]);

  const handleTitleClick = async () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // 清除之前的定时器
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    // 如果点击了CLICK_COUNT次，打开开发者工具
    if (newClickCount >= CLICK_COUNT) {
      try {
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.OPEN_DEVTOOLS,
        );
        logRenderer.info('打开开发者工具', {
          type: 'openDevTools',
          data: result,
        });
        if (!result.success) {
          // 静默处理错误，生产环境中不应该显示详细错误信息
        }
      } catch {
        // 静默处理错误
      }
      // 重置计数
      setClickCount(0);
      return;
    }

    // 设置定时器，2秒后重置计数
    timerRef.current = window.setTimeout(() => {
      setClickCount(0);
    }, 2000);
  };

  // 处理创建角色
  const handleCreateCharacter = useCallback(async () => {
    // 📊 发送创建角色入口埋点（侧边栏）
    const visitorId = getVisitorId();
    const eventData = {
      visitor_id: visitorId || 'unknown',
    };

    // eslint-disable-next-line no-console
    console.log('📊 [NavBar] 准备发送 creat_entry_tab 埋点:', {
      event: AnalyticsEvent.CREAT_ENTRY_TAB,
      data: eventData,
    });

    analytics
      .track(AnalyticsEvent.CREAT_ENTRY_TAB, eventData)
      .then((success) => {
        if (success) {
          // eslint-disable-next-line no-console
          console.log('✅ [NavBar] creat_entry_tab 埋点发送成功');
          logRenderer
            .info('[NavBar] creat_entry_tab 埋点发送成功', eventData)
            .catch(() => {});
        } else {
          // eslint-disable-next-line no-console
          console.warn('⚠️ [NavBar] creat_entry_tab 埋点发送返回失败');
          logRenderer
            .warn('[NavBar] creat_entry_tab 埋点发送返回失败', eventData)
            .catch(() => {});
        }
        return success;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('❌ [NavBar] creat_entry_tab 埋点发送失败:', err);
        logRenderer
          .error('[NavBar] creat_entry_tab 埋点发送失败', {
            error: err,
            data: eventData,
          })
          .catch(() => {});
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

      // 若本次需启动 UE，ueBootReady 时走白模场景，不加载壁纸配置
      setTimeout(() => {
        ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SET_BOOT_SCENE, {
          scene: 'char_appear_edit_level',
          subLevelData: {
            head: '',
            action: 'showBlank',
            bodyType: 'defaultmale',
            gender: 'male',
            appearanceData: '',
          },
        });
      }, 1000);

      // 打开创建角色窗口
      await openCreateCharacterWindow();
    } catch (error) {
      console.error('创建角色时发生错误:', error);
      message.error('创建角色失败');
    }
  }, [isLoggedIn]);

  // 处理打开设置窗口
  const handleOpenSettings = useCallback(async () => {
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.CREATE_SETTINGS_WINDOW,
      );
      logRenderer.info('创建设置窗口成功');
    } catch (error) {
      console.error('创建设置窗口失败:', error);
      message.error('打开设置失败');
    }
  }, []);

  // 获取当前选中的菜单项
  const isActive = (path: string) => {
    const currentPath = location.pathname;
    if (path === '/character' && currentPath === '/character') {
      return true;
    }
    if (path === '/chat' && currentPath === '/chat') {
      return true;
    }
    if (path === '/creation' && currentPath === '/creation') {
      return true;
    }
    return currentPath === path;
  };

  // 处理菜单点击
  const handleMenuClick = useCallback(
    async (path: string) => {
      // 找到对应的菜单项以获取标签
      const allMenuItems = [
        ...mainMenuItems1,
        ...mainMenuItems2,
        ...bottomMenuItems,
        ...bottomMenuItems1,
      ];
      const menuItem = allMenuItems.find((item) => item.path === path);

      // 侧边栏具体按钮埋点（我的壁纸、我的角色、聊天）
      const sidebarEvent = SIDEBAR_CLICK_EVENTS[path];
      if (sidebarEvent) {
        analytics
          .track(sidebarEvent, {
            visitor_id: getVisitorId() || 'unknown',
          })
          .catch(() => {});
      }

      // 上报菜单点击事件（使用新的埋点API）
      analytics.track(AnalyticsEvent.MENU_CLICK, {
        menu_path: path,
        menu_label: menuItem?.label || '未知菜单',
        current_page: location.pathname,
      });

      // 如果是创建角色菜单项，执行创建角色逻辑而不是导航
      if (path === '/create-character') {
        handleCreateCharacter();
        return;
      }

      // 如果是设置菜单项，创建设置窗口而不是导航
      if (path === '/settings') {
        handleOpenSettings();
        return;
      }

      navigate(path);
    },
    [
      location.pathname,
      navigate,
      handleCreateCharacter,
      handleOpenSettings,
      mainMenuItems1,
      mainMenuItems2,
      bottomMenuItems,
      bottomMenuItems1,
    ],
  );

  // 处理底部菜单点击（需要连续点击CLICK_COUNT次）
  const handleBottomMenuClick = (path: string) => {
    const newBottomClickCount = bottomClickCount + 1;
    setBottomClickCount(newBottomClickCount);

    // 清除之前的定时器
    if (bottomTimerRef.current) {
      window.clearTimeout(bottomTimerRef.current);
    }

    // 如果点击了CLICK_COUNT次，打开设置页面
    if (newBottomClickCount >= CLICK_COUNT) {
      navigate(path);
      // 重置计数
      setBottomClickCount(0);
      return;
    }

    // 设置定时器，2秒后重置计数
    bottomTimerRef.current = window.setTimeout(() => {
      setBottomClickCount(0);
    }, 2000);
  };

  // 处理键盘事件
  const handleKeyDown = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const handleAvatarClick = () => {
    // 侧边栏点击账号按钮埋点
    analytics
      .track(AnalyticsEvent.SIDEBAR_ACCOUNT_CLICK, {
        visitor_id: getVisitorId() || 'unknown',
      })
      .catch(() => {});
    navigate('/user');
    // const newAvatarClickCount = avatarClickCount + 1;
    // setAvatarClickCount(newAvatarClickCount);

    // // 清除之前的定时器
    // if (avatarTimerRef.current) {
    //   window.clearTimeout(avatarTimerRef.current);
    // }

    // // 如果点击了CLICK_COUNT次，跳转到用户页面
    // if (newAvatarClickCount >= CLICK_COUNT) {
    //   navigate('/user');
    //   // 重置计数
    //   setAvatarClickCount(0);
    //   return;
    // }

    // // 设置定时器，2秒后重置计数
    // avatarTimerRef.current = window.setTimeout(() => {
    //   setAvatarClickCount(0);
    // }, 2000);
  };

  return (
    <nav className={styles.navbar}>
      {/* Logo区域 */}
      <div className={styles.navbarHeader}>
        <div
          className={styles.navbarLogo}
          onClick={handleTitleClick}
          onKeyDown={(e) => handleKeyDown(e, handleTitleClick)}
          role="button"
          tabIndex={0}
        >
          <img
            src={logoIcon}
            alt="Logo"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* 主要菜单区域 */}
      <div className={styles.navbarMenu}>
        {mainMenuItems1.map((item) => (
          <MenuItem
            key={item.key}
            item={item}
            isActive={isActive(item.path)}
            onClick={() => handleMenuClick(item.path)}
            onKeyDown={(e) =>
              handleKeyDown(e, () => handleMenuClick(item.path))
            }
          />
        ))}
        <div className={styles.navbarMenuSeparator} />
        {mainMenuItems2.map((item) => (
          <MenuItem
            key={item.key}
            item={item}
            isActive={isActive(item.path)}
            onClick={() => handleMenuClick(item.path)}
            onKeyDown={(e) =>
              handleKeyDown(e, () => handleMenuClick(item.path))
            }
          />
        ))}
      </div>

      {/* 壁纸模式切换（位于“后台”菜单上方）*/}
      {/*<div className={styles.modeSwitcherContainer}>*/}
      {/*  <WallpaperModeSwitcher />*/}
      {/*</div>*/}

      {/* 后台菜单项 */}
      <div className={styles.bottomMenu}>
        {bottomMenuItems.map((item) => (
          <MenuItem
            key={item.key}
            item={item}
            isActive={isActive(item.path)}
            onClick={() => handleBottomMenuClick(item.path)}
            onKeyDown={(e) =>
              handleKeyDown(e, () => handleBottomMenuClick(item.path))
            }
          />
        ))}
      </div>
      {/* 底部菜单和用户头像 */}
      <div className={styles.navbarFooter}>
        {/* 用户头像/登录按钮 */}
        <div className={styles.avatarContainer}>
          <Avatar
            size={48}
            onClick={handleAvatarClick}
            onKeyDown={(e) => handleKeyDown(e, handleAvatarClick)}
            showOnlineStatus
          />
        </div>
      </div>

      {/* 设置菜单项 */}
      <div className={styles.bottomMenu}>
        {bottomMenuItems1.map((item) => (
          <MenuItem
            key={item.key}
            item={item}
            isActive={isActive(item.path)}
            onClick={() => handleMenuClick(item.path)}
            onKeyDown={(e) =>
              handleKeyDown(e, () => handleMenuClick(item.path))
            }
          />
        ))}
      </div>
    </nav>
  );
}

export default NavBar;
