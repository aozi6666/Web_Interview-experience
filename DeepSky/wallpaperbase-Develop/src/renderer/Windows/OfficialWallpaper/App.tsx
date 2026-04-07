import { api } from '@api';
import { Button, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadWallpapersFromLocal,
  saveWallpapersToLocal,
} from '../../utils/wallpaperStorage';
import CommonPagination from '../../components/CommonPagination';
import PreviewModal from '../../components/PreviewModal';
import WindowHeader from '../../components/WindowHeader';
import { convertThemesToWallpapers } from '../../pages/myAssets/utils';
import CreateWallpaperModal from './components/CreateWallpaperModal/CreateWallpaperModal';
import WallPaperCard from './components/WallPaperCard/WallPaperCard';
import WallpaperDetailModal from './components/WallpaperDetailModal/WallpaperDetailModal';
import { WallpaperItem } from './components/WallpaperInfo/WallpaperInfo';
import { useOfficialWallpaperStyles } from './styles';




function OfficialWallpaper() {
  const { styles } = useOfficialWallpaperStyles();

  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [, setAppliedWallpaperId] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);

  // 详情弹窗相关状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedWallpaperId, setSelectedWallpaperId] = useState<string | null>(null);
  const [selectedWallpaper, setSelectedWallpaper] = useState<WallpaperItem | null>(null);

  // 创建弹窗相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // 从localStorage加载应用的壁纸ID
  const loadAppliedWallpaper = () => {
    const savedWallpaperId = localStorage.getItem('appliedWallpaperId');
    if (savedWallpaperId) {
      setAppliedWallpaperId(savedWallpaperId);
    }
    return savedWallpaperId;
  };

  // 计算网格列数
  const calculateGridColumns = (containerWidth: number) => {
    const maxCardWidth = 330;
    const minColumns = 2;

    if (containerWidth >= maxCardWidth) {
      const columns = Math.floor(containerWidth / maxCardWidth) + 1;
      return Math.max(minColumns, columns);
    }
    return minColumns;
  };

  // 更新网格列数
  const updateGridColumns = useCallback(() => {
    if (gridRef.current) {
      const containerWidth = gridRef.current.offsetWidth;
      const newColumns = calculateGridColumns(containerWidth);
      setGridColumns(newColumns);
    }
  }, []);

  // 监听容器大小变化
  useEffect(() => {
    const handleResize = () => {
      updateGridColumns();
    };

    updateGridColumns();

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (gridRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateGridColumns();
      });
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updateGridColumns]);

  // 获取壁纸列表
  const fetchWallpapers = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const res = await api.getThemesList({
        page,
        page_size: pageSize,
      });

      if (res.code !== 0) {
        message.error(res.message);
        setWallpapers([]);
        setTotalCount(0);
        setCurrentPage(1);
        return;
      }

      const convertedWallpapers = convertThemesToWallpapers(res);
      setWallpapers(convertedWallpapers);
      setTotalCount(res.data.total);
      setCurrentPage(res.data.page);

      // 保存壁纸列表到本地文件
      if (res.data.items && res.data.items.length > 0) {
        void saveWallpapersToLocal(res.data.items).catch((err: any) => {
          console.error('保存壁纸列表到本地失败:', err);
        });
      }

      if (convertedWallpapers.length > 0) {
        const savedWallpaperId = loadAppliedWallpaper();
          // 注意：不再需要选择默认壁纸，因为弹窗现在是自包含的
      }
    } catch (error) {
      console.error('❌ 获取壁纸列表失败:', error);

      // 尝试从本地加载壁纸
      try {
        const localWallpapers = await loadWallpapersFromLocal();

        if (localWallpapers && localWallpapers.length > 0) {
          console.log('✅ 使用本地保存的壁纸列表');
          message.warning('网络连接失败，已加载本地保存的壁纸列表');

          // 转换本地壁纸数据
          const convertedLocalWallpapers = localWallpapers.map(
            (theme: any) => ({
              id: theme.id,
              title: theme.name,
              thumbnail: theme.thumbnail_url || '',
              preview: theme.thumbnail_url || '',
              description: theme.description || '',
              tags: theme.tags || [],
              createdAt: new Date(theme.created_at).toLocaleDateString('zh-CN'),
              author: theme.creator_name || theme.creator_id || '',
              isUsing: false,
              agent_prompt_id: theme.agent_prompt_id,
            }),
          );

          // 获取已应用的壁纸ID
          const savedWallpaperId = loadAppliedWallpaper();

          // 更新 isUsing 状态
          const wallpapersWithStatus = convertedLocalWallpapers.map(
            (wp: any) => ({
              ...wp,
              isUsing: wp.id === savedWallpaperId,
            }),
          );

          setWallpapers(wallpapersWithStatus);
          setTotalCount(localWallpapers.length);
          setCurrentPage(1);

            // 注意：不再需要选择默认壁纸，因为弹窗现在是自包含的
        } else {
          // 本地也没有数据
          message.error('获取壁纸列表失败，且本地没有保存的壁纸');
          setWallpapers([]);
          setTotalCount(0);
        }
      } catch (localError) {
        console.error('❌ 加载本地壁纸列表也失败:', localError);
        message.error('获取壁纸列表失败');
        setWallpapers([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
    }
  };


  // 点击壁纸卡片 - 显示详情弹窗
  const handleWallpaperClick = (wallpaper: WallpaperItem) => {
    setSelectedWallpaperId(wallpaper.id);
    setSelectedWallpaper(wallpaper);
    setDetailModalVisible(true);
  };

  // 删除壁纸
  const handleDeleteWallpaper = async (wallpaper: WallpaperItem) => {
    try {
      const res = await api.deleteThemes(wallpaper.id);
      if (res.code === 0) {
        message.success('壁纸删除成功');
        await fetchWallpapers();
      } else {
        message.error(res.data || '删除壁纸失败');
      }
    } catch (error) {
      console.error('删除壁纸失败:', error);
      message.error('删除壁纸失败');
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchWallpapers(page);
  };



  useEffect(() => {
    loadAppliedWallpaper();
    fetchWallpapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <WindowHeader title="官方壁纸管理器" />
      <div className={styles.container}>
        {/* 壁纸网格 */}
        <div className={styles.recommendTitle}>
          <div>官方壁纸管理</div>
          <Button
            type="primary"
            onClick={() => setCreateModalVisible(true)}
            style={{ marginRight: 16 }}
          >
            新建壁纸
          </Button>
        </div>
        <div className={styles.wallpaperGrid}>
          <div
            ref={gridRef}
            className={styles.gridContainer}
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, minmax(200px, 1fr))`,
            }}
          >
            {wallpapers.map((wallpaper) => (
              <WallPaperCard
                key={`wallpaper-card-${wallpaper.id}`}
                wallpaper={wallpaper}
                onClick={handleWallpaperClick}
                onDelete={handleDeleteWallpaper}
              />
            ))}
          </div>
        </div>

        {/* 分页器 */}
        {!loading && totalCount > 0 && (
          <CommonPagination
            current={currentPage}
            total={totalCount}
            pageSize={pageSize}
            onChange={handlePageChange}
          />
        )}
      </div>

      {/* 壁纸详情弹窗 */}
        <WallpaperDetailModal
          visible={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          onRefresh={fetchWallpapers}
          wallpaperId={selectedWallpaperId}
          wallpaper={selectedWallpaper}
        />

      {/* 创建壁纸弹窗 */}
      <CreateWallpaperModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onRefresh={fetchWallpapers}
      />

      {/* 预览模态框 */}
      <PreviewModal />
    </>
  );
}

export default OfficialWallpaper;
