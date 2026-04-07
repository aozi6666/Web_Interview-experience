import {
  deletePrivateAsset,
  getPrivateWallPaperList,
  getTagsList,
} from '@api/requests/wallpaper';
import { WallpaperListItem } from '@api/types/wallpaper';
import CommonPagination from '@components/CommonPagination';
import TagFilterPanel, { GroupedTags } from '@components/TagFilterPanel';
import WallpaperGrid from '@components/WallpaperGrid';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { useSystemStatus } from '@hooks/useSystemStatus';
import { useWallpaperLocalStatus } from '@hooks/useWallpaperLocalStatus';
import { loadWallpaperConfig } from '@renderer/api/wallpaperConfig';
import { downloadFromPrivate } from '@renderer/services/wallpaperDownloadService';
import {
  onDownloadComplete,
  wallpaperDownloadStore,
} from '@stores/WallpaperDownload';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Modal, message } from 'antd';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSnapshot } from 'valtio';
import filterIcon from '../../../../../assets/comment/filter-icon.svg';
import {
  applyWallpaperFromLocal,
  cleanupWallpaperLocalFiles,
  switchToDefaultWallpaperConfig,
} from '../../Wallpapers/wallpaperDetailTransformer';
import { useStyles } from '../styles';

const PAGE_SIZE = 20;

const GRID_CALC_FN = (width: number) => {
  const maxCardWidth = 275;
  const minColumns = 2;
  if (width >= maxCardWidth) {
    return Math.max(minColumns, Math.floor(width / maxCardWidth) + 1);
  }
  return minColumns;
};

export interface WallpaperSectionRef {
  handleSave: (wallpaper?: WallpaperItem) => Promise<void>;
  applyByLevelId: (levelId: string) => Promise<void>;
}

interface WallpaperSectionProps {
  appliedWallpaperId: string | null;
  onWallpaperSelect: (wallpaper: WallpaperItem | null, levelId: string) => void;
  onAppliedChange: (levelId: string) => void;
  /** 用户点击卡片选中壁纸时打开全宽详情滑层 */
  onOpenDetailSlide?: () => void;
}

type TagItem = {
  id: string | number;
  name: string;
};

const INTERACTION_TAGS = new Set(['不可互动', '可互动']);
const GENDER_TAGS = new Set(['女角色', '男角色']);

const WallpaperSection = forwardRef<WallpaperSectionRef, WallpaperSectionProps>(
  (
    {
      appliedWallpaperId,
      onWallpaperSelect,
      onAppliedChange,
      onOpenDetailSlide,
    },
    ref,
  ) => {
    const { styles } = useStyles();
    const { status } = useSystemStatus();
    const { localStatusMap, checkStatus, markReady, markFailed } =
      useWallpaperLocalStatus();
    const downloadSnapshot = useSnapshot(wallpaperDownloadStore);
    const { pendingWallpapers } = downloadSnapshot;

    const [wallpapers, setWallpapers] = useState<WallpaperListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [tags, setTags] = useState<TagItem[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showTagGroupFilter, setShowTagGroupFilter] = useState(false);
    const tagPanelWrapRef = useRef<HTMLDivElement | null>(null);
    const [selectedLevelId, setSelectedLevelId] = useState('');

    const toWallpaperItem = useCallback(
      (item: WallpaperListItem, isUsing = false): WallpaperItem => ({
        id: item.levelId,
        title: item.name || item.description || item.levelId,
        thumbnail: item.preview_url || '',
        preview: item.preview_url || '',
        description: item.description || '',
        tags: item.tags || [],
        createdAt: '',
        author: item.creator_name || '',
        isUsing,
      }),
      [],
    );

    const fetchWallpapers = async (
      page: number = currentPage,
      tagsFilter: string[] = selectedTags,
    ) => {
      setLoading(true);
      try {
        const configResult = await loadWallpaperConfig();
        const savedId =
          configResult.success && configResult.config?.levelId
            ? configResult.config.levelId
            : null;

        const tagsParam =
          tagsFilter.length > 0 ? tagsFilter.join(',') : undefined;
        const res = await getPrivateWallPaperList({
          page,
          page_size: PAGE_SIZE,
          tags: tagsParam,
        });
        const list = res.data?.items ?? [];
        setWallpapers(list);
        setCurrentPage(res.data?.page ?? page);
        setTotalCount(
          typeof res.data?.total === 'number'
            ? res.data.total
            : Math.max(res.data?.total_pages ?? 1, 1) * PAGE_SIZE,
        );

        const ids = list.map((i) => i.levelId).filter(Boolean);
        await checkStatus(ids);

        if (list.length > 0) {
          const current =
            selectedLevelId && list.find((i) => i.levelId === selectedLevelId);
          const saved = savedId && list.find((i) => i.levelId === savedId);
          const target = current || saved || list[0];
          if (target) {
            setSelectedLevelId(target.levelId);
            onWallpaperSelect(
              toWallpaperItem(target, savedId === target.levelId),
              target.levelId,
            );
          }
        } else {
          setSelectedLevelId('');
          onWallpaperSelect(null, '');
        }
      } catch (error) {
        message.error('获取壁纸列表失败，请稍候重试');
        // eslint-disable-next-line no-console
        console.error('[myAssets] getPrivateWallPaperList failed:', error);
      } finally {
        setLoading(false);
      }
    };
    const fetchWallpapersRef = useRef(fetchWallpapers);
    fetchWallpapersRef.current = fetchWallpapers;

    useEffect(() => {
      const unsubscribe = onDownloadComplete(() => {
        fetchWallpapersRef.current(currentPage, selectedTags).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('[myAssets] refresh private wallpapers failed:', error);
        });
      });
      return unsubscribe;
    }, [currentPage, selectedTags]);

    const applyLocal = async (item: WallpaperListItem) => {
      const { levelId } = item;
      try {
        const result = await applyWallpaperFromLocal({
          levelId,
          ueRunning: status.ueState.isRunning,
          ueState: status.ueState.state,
          listItem: item,
        });
        if (!result.success) {
          message.warning(result.error || '本地壁纸应用失败，请稍候重试');
          if ((result.error || '').includes('本地壁纸配置缺失')) {
            markFailed(levelId);
          }
          return;
        }
        onAppliedChange(levelId);
        setSelectedLevelId(levelId);
        onWallpaperSelect(toWallpaperItem(item, true), levelId);
        if (result.switched) {
          message.success('应用成功');
        } else {
          message.warning(
            'UE 未运行且未找到本地视频，稍后 UE 启动后可恢复场景',
          );
        }
      } catch {
        message.error('本地壁纸应用失败，请稍候重试');
      }
    };

    const downloadWallpaper = async (item: WallpaperListItem) => {
      const result = await downloadFromPrivate(item);
      if (result.skipped) {
        message.info('资源已在下载中...');
        return;
      }
      if (!result.success) {
        message.error(result.error || '获取私有壁纸详情失败');
        return;
      }
      markReady(result.finalLevelId);
      if (result.finalLevelId !== item.levelId) {
        markReady(item.levelId);
      }
      message.success('壁纸资源下载完成，请点击设为壁纸');
    };

    const handleAction = async (item: WallpaperListItem) => {
      setSelectedLevelId(item.levelId);
      onWallpaperSelect(
        toWallpaperItem(item, appliedWallpaperId === item.levelId),
        item.levelId,
      );
      onOpenDetailSlide?.();

      if (localStatusMap[item.levelId]) {
        await applyLocal(item);
        return;
      }
      await downloadWallpaper(item);
    };

    const handleDelete = (item: WallpaperListItem) => {
      Modal.confirm({
        title: '确认删除该壁纸吗？',
        content: '删除后不可恢复，请谨慎操作。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        async onOk() {
          try {
            const res = await deletePrivateAsset(item.levelId, 'wallpapers');
            if (res?.code === 0) {
              const cleanupResult = await cleanupWallpaperLocalFiles(
                item.levelId,
              );
              if (!cleanupResult.success && cleanupResult.errors.length > 0) {
                // eslint-disable-next-line no-console
                console.warn(
                  '[myAssets] cleanupWallpaperLocalFiles warnings:',
                  {
                    levelId: item.levelId,
                    errors: cleanupResult.errors,
                  },
                );
                // message.warning(
                //   '远端已删除，本地文件清理有部分失败，请稍后重试',
                // );
              }

              if (appliedWallpaperId === item.levelId) {
                const switchDefaultResult =
                  await switchToDefaultWallpaperConfig();
                if (!switchDefaultResult.success) {
                  message.warning(
                    `当前壁纸已删除，切换默认壁纸失败: ${switchDefaultResult.error || '未知错误'}`,
                  );
                } else {
                  onAppliedChange('wallpapersence034');
                }
              }

              message.success('壁纸删除成功');
              await fetchWallpapers(currentPage);
              return;
            }
            message.error(`壁纸删除失败: ${res?.message || '未知错误'}`);
          } catch (error) {
            message.error('壁纸删除失败，请稍候重试');
            // eslint-disable-next-line no-console
            console.error('[myAssets] deletePrivateAsset failed:', error);
          }
        },
      });
    };

    const handleSelect = (item: WallpaperListItem) => {
      setSelectedLevelId(item.levelId);
      onWallpaperSelect(
        toWallpaperItem(item, appliedWallpaperId === item.levelId),
        item.levelId,
      );
      onOpenDetailSlide?.();
      if (appliedWallpaperId !== item.levelId) {
        handleAction(item).catch(() => {});
      }
    };

    const handlePageChange = (page: number) => {
      analytics
        .track(AnalyticsEvent.WALLPAPER_PAGE_TURN_CLICK, {})
        .catch(() => {});
      setCurrentPage(page);
      fetchWallpapers(page);
    };

    const displayed = useMemo(() => {
      const apiLevelIds = new Set(wallpapers.map((w) => w.levelId));
      const pendingItems = Object.values(pendingWallpapers).filter(
        (p) => !apiLevelIds.has(p.levelId),
      );
      return [...pendingItems, ...wallpapers];
    }, [pendingWallpapers, wallpapers]);

    const groupedTags = useMemo<GroupedTags>(() => {
      const grouped: GroupedTags = {
        interaction: [],
        gender: [],
        type: [],
      };

      tags.forEach((tag) => {
        if (INTERACTION_TAGS.has(tag.name)) {
          grouped.interaction.push(tag);
          return;
        }
        if (GENDER_TAGS.has(tag.name)) {
          grouped.gender.push(tag);
          return;
        }
        grouped.type.push(tag);
      });

      return grouped;
    }, [tags]);

    const handleClickTag = useCallback((tag: string) => {
      setSelectedTags((prev) => {
        if (tag === 'all') {
          return [];
        }
        return prev.includes(tag)
          ? prev.filter((name) => name !== tag)
          : [...prev, tag];
      });
    }, []);

    useImperativeHandle(ref, () => ({
      handleSave: async (wallpaper?: WallpaperItem) => {
        const targetId = wallpaper?.id || selectedLevelId;
        if (!targetId) return;
        const target = wallpapers.find((w) => w.levelId === targetId);
        if (!target) return;
        await handleAction(target);
      },
      applyByLevelId: async (levelId: string) => {
        if (!levelId) return;
        const target = wallpapers.find((w) => w.levelId === levelId);
        if (!target) {
          message.warning('未找到对应壁纸，请刷新列表后重试');
          return;
        }
        await handleAction(target);
      },
    }));

    useEffect(() => {
      fetchWallpapers(1, selectedTags);
    }, [selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const fetchTags = async () => {
        try {
          const response = await getTagsList();
          if (response.code === 0 && Array.isArray(response.data)) {
            const normalized = response.data
              .map((item: unknown, index: number): TagItem | null => {
                if (typeof item === 'string') {
                  return { id: `tag-${index}-${item}`, name: item };
                }
                if (item && typeof item === 'object') {
                  const maybeTag = item as {
                    id?: string | number;
                    name?: string;
                  };
                  if (maybeTag.name) {
                    return {
                      id: maybeTag.id ?? `tag-${index}-${maybeTag.name}`,
                      name: maybeTag.name,
                    };
                  }
                }
                return null;
              })
              .filter((item: TagItem | null): item is TagItem =>
                Boolean(item?.name),
              );
            setTags(normalized);
          }
        } catch {
          // ignore tag errors to keep wallpaper list available
        }
      };
      fetchTags();
    }, []);

    useEffect(() => {
      if (!showTagGroupFilter) {
        return () => {};
      }

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (tagPanelWrapRef.current?.contains(target)) return;
        setShowTagGroupFilter(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showTagGroupFilter]);

    return (
      <div>
        <div style={{ position: 'relative' }} ref={tagPanelWrapRef}>
          <div className={styles.wallpaperHeader}>
            <div className={styles.wallpaperTitle}>我的壁纸</div>
            <button
              type="button"
              onClick={() => setShowTagGroupFilter((prev) => !prev)}
              className={styles.tagFilterBtn}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <img
                src={filterIcon}
                alt=""
                aria-hidden
                style={{ width: 20, height: 20 }}
              />
              {showTagGroupFilter ? '收起筛选' : '筛选'}
            </button>
          </div>

          {showTagGroupFilter && (
            <TagFilterPanel
              groupedTags={groupedTags}
              selectedTags={selectedTags}
              onClickTag={handleClickTag}
            />
          )}
        </div>

        <WallpaperGrid
          wallpapers={displayed}
          localStatusMap={localStatusMap}
          loading={loading}
          gridCalcFn={GRID_CALC_FN}
          selectedId={selectedLevelId}
          appliedId={appliedWallpaperId ?? undefined}
          onApply={(item) => {
            handleAction(item).catch(() => {});
          }}
          onReset={(item) => {
            handleAction(item).catch(() => {});
          }}
          onSelect={handleSelect}
          onDelete={(item) => {
            handleDelete(item);
          }}
        />
        {!loading && totalCount > 0 && (
          <div className={styles.paginationWrap}>
            <CommonPagination
              current={currentPage}
              total={totalCount}
              pageSize={PAGE_SIZE}
              onChange={handlePageChange}
            />
          </div>
        )}
      </div>
    );
  },
);

WallpaperSection.displayName = 'WallpaperSection';

export default WallpaperSection;
