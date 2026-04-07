import {
  forkWallPaperDetail,
  getPrivateWallPaperDetail,
  getTagsList,
  getWallPaperDetail,
  getWallPaperList,
} from '@api/requests/wallpaper';
import { WallpaperListItem } from '@api/types/wallpaper';
import WallpaperGrid from '@components/WallpaperGrid';
import {
  downloadPreviewVideo,
  downloadWallpaperPaks,
} from '@hooks/useApplyWallpaper/downloader';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { useSystemStatus } from '@hooks/useSystemStatus';
import { useWallpaperLocalStatus } from '@hooks/useWallpaperLocalStatus';
import { loadWallpaperConfig } from '@renderer/api/wallpaperConfig';
// import { recordingActions, recordingStore } from '@stores/RecordingStore';
import { updateDownloadProgress } from '@stores/WallpaperDownload';
import DetailChatPanel from '@components/DetailChatPanel';
import WallpaperDetailSlidePanel from '@components/WallpaperDetailSlidePanel';
import { Alert, Button, Empty, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import filterIcon from '../../../../assets/comment/filter-icon.svg';
import CommonLayout from '../../components/CommonLayout';
import CommonPagination from '../../components/CommonPagination';
import TagFilterPanel, { GroupedTags } from '../../components/TagFilterPanel';
import { useStyles } from './styles';
import {
  applyWallpaperFromLocal,
  extractLevelId,
  extractPaksFromWallpaper,
  extractPreviewVideo,
  getWallpaperJsonById,
  saveSettingFilesToDisk,
  transformDetailToSettingFiles,
  updateWallpaperJsonById,
} from './wallpaperDetailTransformer';

const PAGE_SIZE = 20;
// const RECORDING_DURATION_SECONDS = 10;
// const SCENE_CONFIRM_TIMEOUT_MS = 15000;
// const RECORDING_SAFETY_BUFFER_MS = 15000;

const GRID_CALC_FN = (width: number) => {
  const maxCardWidth = 330;
  const minColumns = 2;
  if (width >= maxCardWidth) {
    return Math.max(minColumns, Math.floor(width / maxCardWidth) + 1);
  }
  return minColumns;
};

const isCompactViewport = (): boolean => {
  const innerWidth = window.innerWidth || Number.MAX_SAFE_INTEGER;
  const clientWidth =
    document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
  return Math.min(innerWidth, clientWidth) <= 975;
};

const INTERACTION_TAGS = new Set(['不可互动', '可互动']);
const GENDER_TAGS = new Set(['女角色', '男角色']);

type TagItem = {
  id: string | number;
  name: string;
};

// function waitForSceneConfirm(sceneId: string): Promise<boolean> {
//   return new Promise((resolve) => {
//     let finished = false;
//     const finish = (ok: boolean) => {
//       if (finished) {
//         return;
//       }
//       finished = true;
//       ipcEvents.off(
//         IpcTarget.MAIN,
//         IPCChannels.UE_SCENE_CHANGED,
//         onSceneChanged,
//       );
//       ipcEvents.off(
//         IpcTarget.MAIN,
//         IPCChannels.UE_SCENE_CHANGE_FAILED,
//         onSceneFailed,
//       );
//       clearTimeout(timer);
//       resolve(ok);
//     };
//
//     const onSceneChanged = (payload: any) => {
//       if (payload?.scene !== sceneId) {
//         return;
//       }
//       if (payload?.confirmed === true) {
//         finish(true);
//       }
//     };
//
//     const onSceneFailed = (payload: any) => {
//       if (payload?.failedScene === sceneId) {
//         finish(false);
//       }
//     };
//
//     const timer = setTimeout(() => finish(false), SCENE_CONFIRM_TIMEOUT_MS);
//     ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_SCENE_CHANGED, onSceneChanged);
//     ipcEvents.on(
//       IpcTarget.MAIN,
//       IPCChannels.UE_SCENE_CHANGE_FAILED,
//       onSceneFailed,
//     );
//   });
// }

function Wallpapers() {
  const { styles } = useStyles();
  const { status } = useSystemStatus();
  const { localStatusMap, checkStatus, markReady, markFailed } =
    useWallpaperLocalStatus();

  const [wallpapers, setWallpapers] = useState<WallpaperListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [selectedId, setSelectedId] = useState('');
  const [selectedWallpaperFallback, setSelectedWallpaperFallback] =
    useState<WallpaperItem | null>(null);
  const [appliedWallpaperId, setAppliedWallpaperId] = useState<string | null>(
    null,
  );
  const [processingId, setProcessingId] = useState('');
  const [, setActionResultMap] = useState<
    Record<string, { success: boolean; text: string }>
  >({});
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagGroupFilter, setShowTagGroupFilter] = useState(false);
  const [detailSlideOpen, setDetailSlideOpen] = useState(false);
  const tagPanelWrapRef = useRef<HTMLDivElement | null>(null);
  const selectedWallpaper = useMemo<WallpaperItem | null>(() => {
    console.log('---------------selectedWallpaper', selectedId);
    if (!selectedId) {
      return null;
    }
    const item = wallpapers.find(
      (wallpaper) => wallpaper.levelId === selectedId,
    );
    if (!item) {
      if (
        selectedWallpaperFallback &&
        selectedWallpaperFallback.id === selectedId
      ) {
        return {
          ...selectedWallpaperFallback,
          isUsing: appliedWallpaperId === selectedId,
        };
      }
      return null;
    }
    return {
      id: item.levelId,
      title: item.name || item.description || item.levelId,
      thumbnail: item.preview_url || '',
      preview: item.preview_url || '',
      description: item.description,
      tags: item.tags || [],
      createdAt: '',
      author: item.creator_name,
      isUsing: appliedWallpaperId === item.levelId,
    };
  }, [selectedId, selectedWallpaperFallback, wallpapers, appliedWallpaperId]);

  /*
  const startRecordingAfterSwitch = async (
    sceneId: string,
  ): Promise<boolean> => {
    recordingActions.start(sceneId);
    // globalProgressActions.show('更新中...', 'loading', false);

    const currentSceneResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.UE_GET_CURRENT_SCENE,
    )) as { scene?: string } | undefined;
    const alreadyInTargetScene = currentSceneResult?.scene === sceneId;
    const confirmed = alreadyInTargetScene
      ? true
      : await waitForSceneConfirm(sceneId);
    if (!confirmed) {
      recordingActions.finish('failed', '场景切换确认超时');
      globalProgressActions.error('更新失败');
      message.error('场景切换超时，录制未开始');
      return false;
    }

    const downloadPath = await getDefaultDownloadPath();
    if (!downloadPath) {
      recordingActions.finish('failed', '获取下载目录失败');
      globalProgressActions.error('更新失败');
      message.error('获取下载目录失败，录制未开始');
      return false;
    }

    const outputPath = `${downloadPath}\\No3DVideo\\${sceneId}.mp4`.replace(
      /\//g,
      '\\',
    );
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_SEND_START_RECORDING,
        {
          type: 'startRecording',
          data: {
            duration: RECORDING_DURATION_SECONDS,
            outputPath,
          },
        },
      );
      if (result === false || (result as any)?.success === false) {
        const errorMsg = (result as any)?.error || '发送录屏指令失败';
        recordingActions.finish('failed', errorMsg);
        globalProgressActions.error('更新失败');
        message.error(errorMsg);
        return false;
      }
      setTimeout(() => {
        if (
          recordingStore.isRecording &&
          recordingStore.targetSceneId === sceneId
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            '[Wallpapers] Recording callback timeout, force reset state:',
            sceneId,
          );
          recordingActions.finish('failed', '录屏回调超时');
          globalProgressActions.error('更新失败');
          message.error('录屏回调超时，请重试');
        }
      }, RECORDING_DURATION_SECONDS * 1000 + RECORDING_SAFETY_BUFFER_MS);
      return true;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '发送录屏指令异常';
      recordingActions.finish('failed', errorMsg);
      globalProgressActions.error('更新失败');
      message.error(errorMsg);
      return false;
    }
  };
  */

  const fetchList = async (page = 1, tagsFilter: string[] = selectedTags) => {
    setListLoading(true);
    setListError('');
    try {
      const tagsParam =
        tagsFilter.length > 0 ? tagsFilter.join(',') : undefined;
      const res = await getWallPaperList({
        page,
        page_size: PAGE_SIZE,
        tags: tagsParam,
      });
      const items = res.data.items ?? [];
      setWallpapers(items);
      setPagination({
        page: res.data.page ?? page,
        totalPages: Math.max(res.data.total_pages ?? 1, 1),
        total:
          typeof res.data.total === 'number'
            ? res.data.total
            : (res.data.total_pages ?? 1) * PAGE_SIZE,
      });
      const ids = items.map((i) => i.levelId).filter(Boolean);
      await checkStatus(ids);
    } catch (error) {
      setListError('获取壁纸列表失败，请稍候重试');
      // eslint-disable-next-line no-console
      console.error('[Wallpapers] getWallPaperList failed:', error);
    } finally {
      setListLoading(false);
    }
  };

  const updateActionResult = (id: string, success: boolean, text: string) => {
    setActionResultMap((prev) => ({ ...prev, [id]: { success, text } }));
  };

  const fetchDetail = async (id: string) => {
    setSelectedId(id);
    setProcessingId(id);
    updateActionResult(id, true, '正在处理...');
    updateDownloadProgress(id, { status: 'queued', error: undefined });

    try {
      const res = await getWallPaperDetail(id);
      let levelId = extractLevelId(res);
      const paks = extractPaksFromWallpaper(res);
      const previewVideoUrl = extractPreviewVideo(res);
      const listItem = wallpapers.find((i) => i.levelId === levelId);

      const files = transformDetailToSettingFiles(res);
      const saveResult = await saveSettingFilesToDisk(files);
      if (saveResult.failed === 0 && saveResult.skipped === 0) {
        // message.success(`配置写入成功，共 ${saveResult.success} 个文件`);
      } else if (saveResult.failed === 0 && saveResult.skipped > 0) {
        // message.success(
        //   `配置写入成功：成功 ${saveResult.success}，跳过 ${saveResult.skipped}`,
        // );
      } else {
        // message.warning(
        //   `配置写入部分失败：成功 ${saveResult.success}，跳过 ${saveResult.skipped}，失败 ${saveResult.failed}`,
        // );
        // eslint-disable-next-line no-console
        console.error(
          '[Wallpapers] save setting files failed:',
          saveResult.errors,
        );
      }
      const wallpaperJsonResult = await getWallpaperJsonById(levelId);
      if (!wallpaperJsonResult.success) {
        const errorText =
          wallpaperJsonResult.error || '写入本地 Wallpaper JSON 失败';
        message.error(errorText);
        updateActionResult(id, false, errorText);
        markFailed(levelId);
        return;
      }

      if (paks.length === 0) {
        message.info('该壁纸未返回 Paks 资源，已跳过资源下载');
      }
      const previewVideoOk = await downloadPreviewVideo(
        levelId,
        previewVideoUrl,
      );
      if (!previewVideoOk && previewVideoUrl) {
        // eslint-disable-next-line no-console
        console.warn(
          '[Wallpapers] preview_video download failed, continue paks flow',
          {
            levelId,
            previewVideoUrl,
          },
        );
      }
      const downloadSuccess = await downloadWallpaperPaks(levelId, paks);
      if (!downloadSuccess && paks.length > 0) {
        message.warning('壁纸资源下载失败，请检查网络后重试');
        updateActionResult(id, false, '壁纸资源下载失败');
        return;
      }
      if (downloadSuccess && paks.length > 0) {
        message.success('壁纸资源下载完成');
      }

      updateDownloadProgress(id, { status: 'forking', error: undefined });

      const savedJson = wallpaperJsonResult.data ?? null;
      const alreadyForked = Boolean(savedJson?.source_wallpaper_id);
      let sourceWallpaperId =
        typeof savedJson?.source_wallpaper_id === 'string'
          ? savedJson.source_wallpaper_id
          : '';

      if (!alreadyForked) {
        const forkRes = await forkWallPaperDetail(levelId);
        const forkData = forkRes?.data ?? forkRes;
        sourceWallpaperId = forkData?.source_wallpaper_id;
        const forkedLevelId = forkData?.levelId;
        const forkedVisibility = forkData?.visibility;
        if (!sourceWallpaperId) {
          message.warning('Fork 接口未返回 source_wallpaper_id');
          updateActionResult(id, false, 'Fork 失败：缺少 source_wallpaper_id');
          return;
        }
        const forkedDetailLevelId =
          typeof forkedLevelId === 'string' && forkedLevelId.trim()
            ? forkedLevelId
            : levelId;
        try {
          const forkedDetail =
            await getPrivateWallPaperDetail(forkedDetailLevelId);
          const forkedFiles = transformDetailToSettingFiles(forkedDetail);
          const forkedSaveResult = await saveSettingFilesToDisk(forkedFiles);
          if (forkedSaveResult.failed > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              '[Wallpapers] save forked setting files partially failed:',
              forkedSaveResult.errors,
            );
          }
        } catch (error) {
          // fork 后二次分割失败不阻塞流程，避免影响应用体验
          // eslint-disable-next-line no-console
          console.warn(
            '[Wallpapers] forked detail re-split failed, continue apply flow:',
            error,
          );
        }
        const patch: Record<string, unknown> = {
          source_wallpaper_id: sourceWallpaperId,
        };
        if (forkedLevelId) {
          patch.levelId = forkedLevelId;
          levelId = forkedLevelId;
        }
        if (forkedVisibility !== undefined) {
          patch.visibility = forkedVisibility;
        }
        const updateResult = await updateWallpaperJsonById(
          levelId,
          patch,
          savedJson,
        );
        if (!updateResult.success) {
          message.warning(`覆盖本地壁纸 JSON 失败：${updateResult.error}`);
          updateActionResult(id, false, '覆盖本地壁纸 JSON 失败');
          return;
        }
        if (levelId !== id) {
          await updateWallpaperJsonById(id, {
            source_wallpaper_id: sourceWallpaperId,
            forked_level_id: levelId,
          });
        }
      }

      const applyResult = await applyWallpaperFromLocal({
        levelId,
        ueRunning: status.ueState.isRunning,
        ueState: status.ueState.state,
        sourceWallpaperId,
        listItem,
      });
      if (!applyResult.success) {
        updateActionResult(id, false, applyResult.error || '应用壁纸失败');
        return;
      }
      if (!applyResult.switched) {
        message.warning('UE 未运行且未找到本地视频，稍后 UE 启动后可恢复场景');
      }
      setAppliedWallpaperId(levelId);
      updateActionResult(
        id,
        applyResult.switched,
        applyResult.switched ? '应用成功' : '配置已保存，等待 UE 启动后恢复',
      );
      // if (status.ueState.isRunning && applyResult.switched) {
      //   await startRecordingAfterSwitch(levelId);
      // }
      markReady(levelId);
      if (levelId !== id) markReady(id);
    } catch {
      message.error('获取壁纸详情失败');
      updateActionResult(id, false, '获取壁纸详情失败，请稍候重试');
      updateDownloadProgress(id, {
        status: 'failed',
        error: '获取壁纸详情失败',
      });
    } finally {
      setProcessingId('');
      updateDownloadProgress(id, { status: 'idle', error: undefined });
    }
  };

  const applyLocal = async (id: string) => {
    setSelectedId(id);
    setProcessingId(id);
    updateActionResult(id, true, '正在应用本地壁纸...');
    updateDownloadProgress(id, { status: 'queued', error: undefined });
    try {
      const listItem = wallpapers.find((i) => i.levelId === id);
      let effectiveLevelId = id;
      const origJson = await getWallpaperJsonById(id);
      if (origJson.success && origJson.data) {
        const forkedId = origJson.data.forked_level_id;
        if (typeof forkedId === 'string' && forkedId.length > 0) {
          effectiveLevelId = forkedId;
        }
      }
      const applyResult = await applyWallpaperFromLocal({
        levelId: effectiveLevelId,
        ueRunning: status.ueState.isRunning,
        ueState: status.ueState.state,
        listItem,
      });
      if (!applyResult.success) {
        updateActionResult(id, false, applyResult.error || '本地壁纸应用失败');
        if ((applyResult.error || '').includes('本地壁纸配置缺失')) {
          markFailed(id);
        }
        return;
      }
      if (!applyResult.switched) {
        message.warning('UE 未运行且未找到本地视频，稍后 UE 启动后可恢复场景');
      }
      setAppliedWallpaperId(id);
      updateActionResult(
        id,
        applyResult.switched,
        applyResult.switched ? '应用成功' : '配置已保存，等待 UE 启动后恢复',
      );
      // if (status.ueState.isRunning && applyResult.switched) {
      //   await startRecordingAfterSwitch(id);
      // }
    } catch {
      message.error('本地壁纸应用失败');
      updateActionResult(id, false, '本地壁纸应用失败，请重新下载后重试');
      markFailed(id);
    } finally {
      setProcessingId('');
      updateDownloadProgress(id, { status: 'idle', error: undefined });
    }
  };

  const handleWallpaperCardSelect = useCallback((item: WallpaperListItem) => {
    setSelectedId(item.levelId);
    if (isCompactViewport()) {
      setDetailSlideOpen(true);
    }
  }, []);

  const closeDetailSlide = useCallback(() => setDetailSlideOpen(false), []);

  const handleWallpaperAction = async (item: WallpaperListItem) => {
    // if (recordingStore.isRecording) {
    //   message.warning('正在更新中，请稍候...');
    //   return;
    // }
    const id = item.levelId;
    setSelectedId(id);
    if (isCompactViewport()) {
      setDetailSlideOpen(true);
    }

    if (localStatusMap[id]) {
      await applyLocal(id);
      return;
    }
    await fetchDetail(id);
  };

  const handleSaveWallpaper = async (wallpaper?: WallpaperItem) => {
    if (!wallpaper?.id) {
      return;
    }
    setSelectedId(wallpaper.id);
  };

  const applyWallpaper = async (wallpaper?: WallpaperItem) => {
    const levelId = wallpaper?.id;
    if (!levelId) {
      return;
    }
    const targetWallpaper = wallpapers.find((item) => item.levelId === levelId);
    if (!targetWallpaper) {
      return;
    }
    await handleWallpaperAction(targetWallpaper);
  };

  const handleOpenModifyCharacter = () => {};

  const displayedWallpapers = wallpapers;

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

  const handleClickTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (tag === 'all') {
        return [];
      }
      return prev.includes(tag)
        ? prev.filter((name) => name !== tag)
        : [...prev, tag];
    });
  };

  useEffect(() => {
    fetchList(1, selectedTags);
  }, [selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const selectedInCurrentPage = wallpapers.some(
      (wallpaper) => wallpaper.levelId === selectedId,
    );
    if (!selectedId || selectedInCurrentPage) {
      setSelectedWallpaperFallback(null);
      return () => {};
    }

    let cancelled = false;
    const fetchSelectedFallback = async () => {
      try {
        const res = await getWallPaperDetail(selectedId);
        const payload =
          res && typeof res === 'object'
            ? ((res as Record<string, unknown>).data as Record<
                string,
                unknown
              >) || (res as Record<string, unknown>)
            : {};
        const wallpaper =
          payload && typeof payload.wallpaper === 'object'
            ? (payload.wallpaper as Record<string, unknown>)
            : payload;
        if (cancelled) return;
        setSelectedWallpaperFallback({
          id:
            (typeof wallpaper.levelId === 'string' && wallpaper.levelId) ||
            selectedId,
          title:
            (typeof wallpaper.name === 'string' && wallpaper.name) ||
            (typeof wallpaper.description === 'string' &&
              wallpaper.description) ||
            selectedId,
          thumbnail:
            (typeof wallpaper.preview_url === 'string' &&
              wallpaper.preview_url) ||
            '',
          preview:
            (typeof wallpaper.preview_url === 'string' &&
              wallpaper.preview_url) ||
            '',
          description:
            typeof wallpaper.description === 'string'
              ? wallpaper.description
              : '',
          tags: Array.isArray(wallpaper.tags) ? wallpaper.tags : [],
          createdAt: '',
          author:
            typeof wallpaper.creator_name === 'string'
              ? wallpaper.creator_name
              : '',
        });
      } catch {
        if (!cancelled) {
          setSelectedWallpaperFallback(null);
        }
      }
    };

    fetchSelectedFallback().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, wallpapers]);

  useEffect(() => {
    const handleResize = () => {
      if (!isCompactViewport()) {
        setDetailSlideOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const syncAppliedWallpaperFromConfig = async () => {
      const result = await loadWallpaperConfig();
      let id = 'wallpapersence034';
      if (result.success && result.config?.levelId) {
        if (result.config.levelId.startsWith('private')) {
          id = result.config.source_wallpaper_id || 'wallpapersence034';
        } else {
          id = result.config.levelId;
        }
      }
      setAppliedWallpaperId(id);
      setSelectedId(id);
    };

    syncAppliedWallpaperFromConfig().catch(() => {});
  }, []);

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
        // ignore tag errors to avoid blocking list rendering
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showTagGroupFilter) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (tagPanelWrapRef.current?.contains(target)) return;
      setShowTagGroupFilter(false);
    };

    if (showTagGroupFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagGroupFilter]);

  let wallpaperStatusContent = null;
  if (!listLoading && listError) {
    wallpaperStatusContent = (
      <div className={styles.listStatusBox}>
        <Alert
          type="error"
          message={listError}
          showIcon
          action={
            <Button size="small" onClick={() => fetchList(pagination.page)}>
              重试
            </Button>
          }
        />
      </div>
    );
  } else if (!listLoading && displayedWallpapers.length === 0) {
    wallpaperStatusContent = (
      <div className={styles.listStatusBox}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无壁纸" />
      </div>
    );
  }

  return (
    // <CommonLayout
    //   showRightPanel
    //   rightPanel={<Chat showResetButton={false} />}
    //   rightPanelWidth={440}
    //   rightPanelMinHeight={316}
    //   rightPanelMaxHeight={700}
    // >
    <CommonLayout
      showRightPanel
      onRightPanelDragStart={closeDetailSlide}
      rightPanel={
        <DetailChatPanel
          wallpaper={selectedWallpaper}
          onSave={handleSaveWallpaper}
          onModifyCharacter={handleOpenModifyCharacter}
          applyLocalWallpaper={applyWallpaper}
          showResetButton={false}
          defaultChatHeight={228}
          minChatHeight={228}
          maxChatHeight={560}
          onSplitDragStart={closeDetailSlide}
          isLocalReady={Boolean(selectedId && localStatusMap[selectedId])}
          isProcessing={Boolean(selectedId && processingId === selectedId)}
          onDownload={() => {
            if (!selectedId) return;
            if (processingId === selectedId) return;
            if (appliedWallpaperId === selectedId) return;
            if (localStatusMap[selectedId]) return;
            const item = wallpapers.find((w) => w.levelId === selectedId);
            if (item) handleWallpaperAction(item);
          }}
        />
      }
      rightPanelWidth={400}
      rightPanelMinHeight={228}
      rightPanelMaxHeight={560}
    >
      <div className={styles.slideHost}>
        <div className={styles.slideHostScroll}>
          <div style={{ position: 'relative' }} ref={tagPanelWrapRef}>
            <div className={styles.wallpaperHeader}>
              <div className={styles.recommendTitle}>壁纸推荐</div>
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

          <div className={styles.wallpaperGrid}>
            {wallpaperStatusContent}

            <WallpaperGrid
              variant="store"
              wallpapers={displayedWallpapers}
              localStatusMap={localStatusMap}
              loading={listLoading}
              gridCalcFn={GRID_CALC_FN}
              selectedId={selectedId}
              appliedId={appliedWallpaperId ?? undefined}
              // applyText="下载使用"
              onApply={handleWallpaperAction}
              onReset={handleWallpaperAction}
              onSelect={handleWallpaperCardSelect}
            />
          </div>

          {!listLoading && pagination.total > 0 && (
            <div className={styles.paginationWrap}>
              <CommonPagination
                current={pagination.page}
                total={pagination.total}
                pageSize={PAGE_SIZE}
                onChange={(page) => fetchList(page)}
              />
            </div>
          )}
        </div>
        <WallpaperDetailSlidePanel
          open={detailSlideOpen}
          onClose={closeDetailSlide}
          wallpaper={selectedWallpaper}
          onSave={handleSaveWallpaper}
          applyLocalWallpaper={applyWallpaper}
          onModifyCharacter={handleOpenModifyCharacter}
          isLocalReady={Boolean(selectedId && localStatusMap[selectedId])}
          isProcessing={Boolean(selectedId && processingId === selectedId)}
          onDownload={() => {
            if (!selectedId) return;
            if (processingId === selectedId) return;
            if (appliedWallpaperId === selectedId) return;
            if (localStatusMap[selectedId]) return;
            const item = wallpapers.find((w) => w.levelId === selectedId);
            if (item) handleWallpaperAction(item);
          }}
          onApply={() => {
            if (!selectedId) return;
            applyLocal(selectedId);
          }}
        />
      </div>
    </CommonLayout>
  );
}

export default Wallpapers;
