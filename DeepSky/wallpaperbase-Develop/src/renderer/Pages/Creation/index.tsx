import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { deleteThemes, getThemesList } from '@api';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { message, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommonLayout from '../../components/CommonLayout';
import CommonPagination from '../../components/CommonPagination';
import { openCreationCenterWindow } from '../../utils/createCharacter';
import { useStyles } from './styles';

const ipcEvents = getIpcEvents();

interface CreationItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  author: string;
  thumbnail?: string;
  category: 'image' | 'video' | 'audio' | 'text';
}

const PAGE_SIZE = 10;

// 模拟创作数据
// const MOCK_CREATIONS: CreationItem[] = [
//   {
//     id: '1',
//     name: '创意壁纸设计',
//     description: '模板1',
//     tags: ['壁纸', '创意'],
//     createdAt: '2024-12-18',
//     author: '官方',
//     thumbnail: '',
//     category: 'image',
//   },
//   {
//     id: '2',
//     name: '动画短片',
//     description: '模板2',
//     tags: ['动画', '视频'],
//     createdAt: '2024-12-17',
//     author: '官方',
//     category: 'video',
//   },
//   {
//     id: '3',
//     name: '音乐作品',
//     description: '模板3',
//     tags: ['音乐', '音频'],
//     createdAt: '2024-12-16',
//     author: '官方',
//     category: 'audio',
//   },
// ];

function Creation() {
  const { styles } = useStyles();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [creations, setCreations] = useState<CreationItem[]>();
  const [currentPage, setCurrentPage] = useState(1);
  const [select, setSelect] = useState('all');
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'image' | 'video' | 'audio' | 'text'
  >('all');
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // 根据选中的类别过滤创作列表
  // const filteredCreations = useMemo(() => {
  //   if (selectedCategory === 'all') {
  //     return creations;
  //   }
  //   return creations.filter(
  //     (creation) => creation.category === selectedCategory,
  //   );
  // }, [creations, selectedCategory]);

  // 监听容器大小变化
  useEffect(() => {
    const updateContainerWidth = () => {
      if (gridRef.current) {
        const scrollbarWidth = 8;
        const paddingRight = 8;
        const availableWidth =
          gridRef.current.offsetWidth - scrollbarWidth - paddingRight;
        setContainerWidth(availableWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);

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

  // 计算网格布局和卡片尺寸
  const gridLayout = useMemo(() => {
    const maxCardWidth = 292;

    // 计算可用宽度（减去padding）
    const availableWidth = containerWidth; // 左右padding 8px * 2
    const gap = 8; // 卡片间距

    // 列数 = int(容器宽度 / 最大宽度) + 1
    const columns = Math.floor(availableWidth / maxCardWidth) + 1;

    // 计算实际卡片宽度
    const cardWidth = Math.min(
      maxCardWidth,
      (availableWidth - (columns - 1) * gap) / columns,
    );

    // 计算图片缩放比例
    const imageScale = cardWidth / maxCardWidth;

    return {
      columns,
      cardWidth,
      imageScale,
      availableWidth,
      gap,
    };
  }, [containerWidth]);

  // 加载创作列表
  // const loadCreations = useCallback(async () => {
  //   setLoading(true);
  //   try {
  //     // 这里可以调用实际的API
  //     // const response = await api.getCreations({
  //     //   page: currentPage,
  //     //   page_size: PAGE_SIZE,
  //     //   category: selectedCategory,
  //     // });

  //     // 模拟API调用
  //     setTimeout(() => {
  //       setCreations(MOCK_CREATIONS);
  //       setTotal(MOCK_CREATIONS.length);
  //       setLoading(false);
  //     }, 500);
  //   } catch {
  //     message.error('加载创作列表失败，请稍候重试');
  //     setLoading(false);
  //   }
  // }, [currentPage, selectedCategory]);

  // 监听页码和类别变化
  // useEffect(() => {
  //   // loadCreations();
  // }, [loadCreations]);
  const getList = async (params?: {
    page?: number;
    page_size?: number;
    category?: string;
    model_type?: 'wallpaper';
  }) => {
    if (params?.page) {
      setCurrentPage(params.page);
    }
    const result = await getThemesList(params);
    console.log(result);
    if (result && result.code === 0) {
      const list: CreationItem[] = [];
      setTotal(result.data.total);
      console.log(result.data.total);
      result.data.items.forEach((item) => {
        let type = '图片';
        if (item.category === 'video') {
          type = '视频';
        }
        list.push({
          id: item.id,
          name: item.name,
          thumbnail: item.thumbnail_url,
          author: item.creator_name,
          description: item.description,
          tags: item.tags ?? [],
          createdAt: item.created_at,
          category: item.category as 'image' | 'video' | 'audio' | 'text',
        });
      });
      setCreations(list);
    }
  };
  useEffect(() => {
    const initialize = async () => {
      try {
        await getList({ page: 1 });
        // setCurrentPage(1);
      } catch {
        message.error('初始化失败，请重试');
      }
    };
    initialize();
  }, []);
  // 处理类别选择
  const handleClickCategory = useCallback(
    (category: 'all' | 'image' | 'video' | 'audio' | 'text') => {
      setSelectedCategory(category);
      setCurrentPage(1);
    },
    [],
  );

  // 处理创作项点击
  const handleCreationClick = useCallback((creation: CreationItem) => {
    message.info(`点击了创作: ${creation.name}`);
    // 这里可以添加跳转到创作详情页面的逻辑
  }, []);

  // 处理鼠标移入
  const handleMouseEnter = useCallback((creationId: string) => {
    setHoveredCardId(creationId);
  }, []);

  // 处理鼠标移出
  const handleMouseLeave = useCallback(() => {
    setHoveredCardId(null);
  }, []);

  // 处理使用模板按钮点击
  const handleUseTemplate = useCallback(async (creation: CreationItem) => {
    message.info(`使用模板: ${creation.name}`);
    try {
      // 打开创作中心窗口
      localStorage.setItem('creationId', creation.id);
      const success = await openCreationCenterWindow();
      if (success) {
        // 关闭主窗口
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
        message.success('创作中心已打开');
      } else {
        message.error('打开创作中心失败');
      }
    } catch {
      message.error('创建创作失败');
    }
  }, []);

  // 处理创建创作
  const handleCreateCreation = useCallback(async () => {
    try {
      // 打开创作中心窗口
      const success = await openCreationCenterWindow();
      if (success) {
        // 关闭主窗口
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
        message.success('创作中心已打开');
      } else {
        message.error('打开创作中心失败');
      }
    } catch {
      message.error('创建创作失败');
    }
  }, []);
  const handleSelect = useCallback(async (item: string) => {
    setSelect(item);
    if (item === 'all') {
      // await getList({page:1});
      setCurrentPage(1);
    } else if (item === 'img') {
      // const result = await getList({page:1,category:'image'});
      setCurrentPage(1);
    } else if (item === 'video') {
      // const result = await getList({page:1,category:'video'});
      setCurrentPage(1);
    }
  }, []);
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    getList({ page });
  };
  const handleDelete = async (id: string) => {
    console.log(id);
    await deleteThemes(id);
    await getList({ page: currentPage || 1 });
  };
  return (
    <CommonLayout showRightPanel={false}>
      <>
        {/* 类别选择区域 */}
        <div className={styles.creationTypeContainer}>
          <div className={styles.creationType}>壁纸模板</div>
        </div>
        {/* <div className={styles.creationButtons}>
          <button
            className={styles.tab1}
            disabled={select == 'all'}
            onClick={() => handleSelect('all')}
          >
            所有模板
          </button>
          <button
            className={styles.tab2}
            disabled={select == 'img'}
            onClick={() => handleSelect('img')}
          >
            官方模板
          </button>
          <button
            className={styles.tab3}
            disabled={select == 'video'}
            onClick={() => handleSelect('video')}
          >
            我的模板
          </button>
        </div> */}
        {/* 创作网格 */}
        <div className={styles.creationGrid}>
          <Spin spinning={loading} size="large">
            <div
              ref={gridRef}
              className={styles.creationGridContainer}
              style={{
                gridTemplateColumns: `repeat(${gridLayout.columns}, ${gridLayout.cardWidth}px)`,
                gap: `${gridLayout.gap}px`,
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {creations &&
                creations.map((creation) => (
                  <div
                    key={creation.id}
                    className={styles.creationCard}
                    // onClick={() => handleCreationClick(creation)}
                    onMouseEnter={() => handleMouseEnter(creation.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className={styles.creationThumbnail}
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1', // 1:1 宽高比，正方形
                        position: 'relative',
                      }}
                    >
                      <div className={styles.creationPlaceholder} />
                      <img
                        src={creation.thumbnail}
                        className={styles.imageContainer}
                      />

                      {/* Hover时显示的眼睛图标 */}
                      {hoveredCardId === creation.id && (
                        <div className={styles.eyeIcon}>
                          <EyeOutlined />
                        </div>
                      )}
                      {hoveredCardId === creation.id && (
                        <div
                          className={styles.delIcon}
                          onClick={() => handleDelete(creation.id)}
                        >
                          <DeleteOutlined />
                        </div>
                      )}
                      {/* Hover时显示的使用模板按钮 */}
                      {hoveredCardId === creation.id && (
                        <div className={styles.useBtn}>
                          <button
                            type="button"
                            className={styles.useTemplateButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseTemplate(creation);
                            }}
                          >
                            使用模板
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={styles.creationInfo}>
                      <div className={styles.creationTitle}>
                        <div className={styles.creationFlag}></div>
                        <div> {creation.author}</div>
                      </div>
                      <div className={styles.creationDescription}>
                        {creation.name}
                      </div>
                    </div>
                  </div>
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
            onChange={handlePageChange}
          />
        )}
      </>
    </CommonLayout>
  );
}

export default Creation;
