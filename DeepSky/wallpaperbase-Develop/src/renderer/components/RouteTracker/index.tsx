import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../../utils/Weblogger/analyticsAPI';

// 页面路径到页面名称的映射
const PAGE_NAME_MAP: Record<string, string> = {
  '/': '推荐',
  '/for-vc': '首页',
  '/my-assets': '资产',
  '/character': '角色库',
  '/ai-chat': 'AI聊天',
  '/mcp-test': 'MCP测试',
  '/wallpaper-baby-test': '壁纸测试',
  '/home': '设置',
  '/face-beauty': 'AI美颜',
  '/user': '用户中心',
};

const RouteTracker = () => {
  const location = useLocation();
  const previousPathRef = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // 如果路径发生了变化，发送页面浏览事件
    if (currentPath !== previousPath) {
      // 获取页面名称，如果没有映射则使用路径作为名称
      const pageName = PAGE_NAME_MAP[currentPath] || `页面: ${currentPath}`;

      console.log(
        '路由变化:',
        `${previousPath} -> ${currentPath},`,
        `上报页面: ${pageName}`,
      );

      // 上报页面浏览数据
      analytics.trackPageView(pageName, {
        previous_page: previousPath || '直接访问',
        current_page_path: currentPath,
      });

      // 更新上一个路径
      previousPathRef.current = currentPath;
    }
  }, [location.pathname]);

  // 监听hash变化（如果使用hash路由）
  useEffect(() => {
    const handleHashChange = () => {
      const pageName =
        PAGE_NAME_MAP[location.pathname] || `页面: ${location.pathname}`;
      analytics.trackPageView(pageName, {
        hash_change: true,
        hash: location.hash,
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [location.pathname, location.hash]);

  return null; // 这个组件不渲染任何UI
};

export default RouteTracker;
