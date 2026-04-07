import selectIcon from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose2__size_32.png';
import { getPrivateModelList } from '@api';
import { Button, Image, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import CommonPagination from '../../../../components/CommonPagination';
import { useStyles } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


interface Scene {
  id: string;
  name: string;
  url: string;
  type: string;
}
interface SceneProps {
  selectedFile?:string;
  onSelectScene?: (id:string) => void;
}
const SceneComponent: React.FC<SceneProps>  = ({
  selectedFile,
  onSelectScene,
}) => {
  const { styles } = useStyles();
  const [select, setSelect] = useState('all');
  const [scenes, setScenes] = useState<Scene[]>([]);
  // const [selectedFile, setSelectedFile] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const getList = async (params?: {
    page?: number;
    page_size?: number;
    category?: string;
    model_type?:'scene_model'
  }) => {
    const model_type = params?.model_type ?? 'scene_model';
    // 其他参数按需获取
    const page = params?.page;
    const page_size = params?.page_size;
    const category = params?.category;
    const result = await getPrivateModelList({ page, page_size, category, model_type });
    console.log("----",params,result);
    if (result && result.code === 0) {
      const list: Scene[] = [];
      setTotalCount(result.data.total);
      console.log(result.data.total);
      result.data.items.forEach((item) => {
        let type = '图片'
        if (item.category === 'video') {
          type = '视频';
        }
        let url = '';
        for (const model of item.model_urls) {
          if (model.type === 'thumbnail') {
            url = model.url;
            break;
          }
        }
        list.push({
          id: item.id,
          name: item.name,
          url: url,
          type: type,
        });
        // if (item.thumbnail_url.endsWith('.mp4')) {
        //   // todo
        //   list.push({
        //     id: item.id,
        //     name: item.name,
        //     url: item.metadata.videoImgUrl,
        //     type: '视频',
        //   })
        // } else {
        //   list.push({
        //     id: item.id,
        //     name: item.name,
        //     url: item.thumbnail_url,
        //     type: '图片',
        //   });
        // }
      });
      setScenes(list);
    }
  };
  useEffect(() => {
    const initialize = async () => {
      try {
        await getList({page:1});
        setCurrentPage(1);
      } catch {
        message.error('初始化失败，请重试');
      }
    };
    initialize();
  }, []);
  const onselect = useCallback(
    async (_id: string) => {
      // setSelectedFile(_id);
      if (onSelectScene) {
        onSelectScene(_id);
      }
    },
    [scenes],
  );
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    getList({page});
  };
  const handleCreateNew = useCallback(async () => {
    const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_SCENE_WINDOW);
  }, []);
  const handleSelect = useCallback(async (item: string) => {
    setSelect(item);
    if (item === 'all') {
      await getList({page:1});
      setCurrentPage(1);
    }else if (item === 'img') {
      const result = await getList({page:1,category:'image'});
      setCurrentPage(1);
    }else if (item === 'video') {
      const result = await getList({page:1,category:'video'});
      setCurrentPage(1);
    }
  }, []);
  return (
    <div>
      <div>
        <Button
          className={styles.tab1}
          disabled={select == 'all'}
          onClick={() => handleSelect('all')}
        >
          所有场景
        </Button>
        <Button
          className={styles.tab2}
          disabled={select == 'img'}
          onClick={() => handleSelect('img')}
        >
          图片
        </Button>
        <Button
          className={styles.tab3}
          disabled={select == 'video'}
          onClick={() => handleSelect('video')}
        >
          视频
        </Button>
        <div className={styles.create} onClick={handleCreateNew}>
          创建场景
        </div>
        <div className={styles.content1}
          ref={gridRef}
          style={{
            gridTemplateColumns: `repeat(${gridLayout.columns}, ${gridLayout.cardWidth}px)`,
            gap: `${gridLayout.gap}px`,
            width: '100%',
            overflow: 'hidden',
          }}>
          {scenes.map((item, index) => (
            <div
              className={styles.content2}
              onClick={() => {
                onselect(item.id);
              }}
            >
              <div className={styles.top}>
                <Image
                  className={styles.img1}
                  width={177}
                  height={177}
                  src={item.url}
                  preview={false}
                />
                {selectedFile === item.id && (
                  <div className={styles.selectIcon}>
                    <Image
                      width={36}
                      src={selectIcon}
                      alt="选择"
                      preview={false}
                    />
                  </div>
                )}
              </div>
              <div className={styles.bottom}>
                <div className={styles.type}>{item.type}</div>
                <div className={styles.name}>{item.name}</div>
              </div>
            </div>
          ))}
        </div>
        <CommonPagination
        className={styles.pagination}
        current={currentPage}
        total={totalCount}
        pageSize={pageSize}
        onChange={handlePageChange}
      />
      </div>
      
    </div>
  );
};

export default SceneComponent;
