import { EllipsisOutlined } from '@ant-design/icons';
import {

  generateCharacterDynamic,
  getImageByChunkId,
  roleDelete,
} from '@api';
import { RunningTaskItem } from '@api/types/createCharacter';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Button, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import {
  useTaskPolling,
  useTaskState,
} from '../../../contexts/TaskPollingContext';
import { openCreateCharacterWindow } from '../../../utils/createCharacter';
import StepGenerateProcess from './StepGenerateProcess';
import { useStyles } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


// Props 接口
interface CurrentCharacterCardProps {
  task: RunningTaskItem; // 任务完整数据
  onTaskDeleted?: () => void; // 任务删除后的回调
  onTaskCompleted?: () => void; // 任务完成后的回调（用于刷新列表）
}

function CurrentCharacterCard({
  task: initialTask,
  onTaskDeleted,
  onTaskCompleted,
}: CurrentCharacterCardProps) {
  const { styles } = useStyles() as any;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ========== 从全局轮询服务订阅状态 ==========
  const taskState = useTaskState(initialTask.chunk_id);
  const { switchToDynamic, unregisterTask } = useTaskPolling();

  // 从全局服务读取状态（有全局状态就用全局的，否则用初始 prop）
  const chunkId = initialTask.chunk_id;
  const taskType = taskState?.taskType || initialTask.task_type;
  const progress =
    taskState?.progress ?? (Number(initialTask.progress) || 0);
  const error =
    taskState?.error || initialTask.error_message || null;
  const queueWaitCount = taskState?.queueWaitCount || 0;

  // UI 相关的本地状态
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewed, setIsPreviewed] = useState(false);
  const [gender] = useState<'male' | 'female'>('male'); // TODO: 从 task 中获取或推断
  const staticTaskId = initialTask.task_id || '';

  // ========== 获取预览图片 ==========
  useEffect(() => {
    const fetchPreviewImage = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log(`🖼️ [CurrentCharacterCard] 获取任务 ${chunkId} 的预览图`);
        const imageUrl = await getImageByChunkId(chunkId);
        if (imageUrl) {
          setPreviewImage(imageUrl);
          // eslint-disable-next-line no-console
          console.log(
            `✅ [CurrentCharacterCard] 任务 ${chunkId} 预览图获取成功`,
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `❌ [CurrentCharacterCard] 获取任务 ${chunkId} 预览图失败:`,
          err,
        );
        // 失败时尝试使用 result_urls 中的备用地址
        const fallbackUrl = initialTask.result_urls?.static_asset?.[0];
        if (fallbackUrl) {
          setPreviewImage(fallbackUrl);
        }
      }
    };

    fetchPreviewImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkId]);

  // ========== 监听动态完成，触发父组件刷新 ==========
  const prevDynamicCompletedRef = useRef(false);
  useEffect(() => {
    const isDynamicCompleted =
      taskState?.taskType === 'dynamic' &&
      taskState?.progress === 100 &&
      taskState?.dynamicDownloadCompleted === true;

    // 只在从 false→true 的变化时触发（避免重复调用）
    if (isDynamicCompleted && !prevDynamicCompletedRef.current) {
      prevDynamicCompletedRef.current = true;
      if (onTaskCompleted) {
        // eslint-disable-next-line no-console
        console.log(`🔄 [CurrentCharacterCard] 动态完成，触发列表刷新`);
        onTaskCompleted();
      }
    }
  }, [
    taskState?.taskType,
    taskState?.progress,
    taskState?.dynamicDownloadCompleted,
    onTaskCompleted,
  ]);

  // ========== 点击外部关闭菜单 ==========
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // 🔍 调试：打印渲染信息
  // eslint-disable-next-line no-console
  console.log(`🎨 [Render] CurrentCharacterCard ${chunkId}`, {
    taskType,
    progress,
    error,
    isPolling: taskState?.isPolling,
    isDownloading: taskState?.isDownloading,
    staticDownloadCompleted: taskState?.staticDownloadCompleted,
    dynamicDownloadCompleted: taskState?.dynamicDownloadCompleted,
  });

  // ========== 事件处理 ==========

  // 处理菜单按钮点击
  const handleMenuClick = (e: any) => {
    e.stopPropagation();
    analytics.track(AnalyticsEvent.MY_ROLES_MENU_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});
    setIsMenuOpen(!isMenuOpen);
  };

  // 处理删除按钮点击
  const handleDelete = async (e: any) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    analytics.track(AnalyticsEvent.MY_ROLES_DELETE_CLICK,
      { visitor_id: getVisitorId() || 'unknown' },
    ).catch(() => {});

    try {
      // eslint-disable-next-line no-console
      console.log(`🗑️ [CurrentCharacterCard] 删除任务 ${chunkId}`);

      // 通知全局服务注销任务（停止轮询+清理状态）
      unregisterTask(chunkId);

      // 删除服务器端的角色数据
      await roleDelete(chunkId);
      // eslint-disable-next-line no-console
      console.log(`✅ [CurrentCharacterCard] 服务器端角色 ${chunkId} 已删除`);

      message.success('角色已删除');

      // 通知父组件刷新列表
      if (onTaskDeleted) {
        onTaskDeleted();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`❌ [CurrentCharacterCard] 删除任务 ${chunkId} 失败:`, err);
      message.error((err as Error).message || '删除失败，请重试');
    }
  };

  // 处理"预览"按钮点击 - 打开UE预览
  const handlePreview = async () => {
    analytics.track(AnalyticsEvent.MY_ROLES_STATIC_PREVIEW_CLICK,
      { visitor_id: getVisitorId() || 'unknown', chunk_id: chunkId },
    ).catch(() => {});
    try {
      // eslint-disable-next-line no-console
      console.log(`👁️ [CurrentCharacterCard] 预览任务 ${chunkId}`);
      setIsPreviewed(true);

      // TODO: 实现预览逻辑，可能需要调用 UE 相关接口
      // 或者打开一个预览窗口
      message.info('预览功能开发中');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`❌ [CurrentCharacterCard] 预览任务 ${chunkId} 失败:`, err);
      message.error('预览失败，请重试');
    }
  };

  // 处理"下一步"按钮点击（开始动态生成）
  const handleStartDynamic = async () => {
    if (isProcessing) return;

    analytics.track(AnalyticsEvent.MY_ROLES_NEXT_STEP_CLICK,
      { visitor_id: getVisitorId() || 'unknown', chunk_id: chunkId },
    ).catch(() => {});

    try {
      setIsProcessing(true);
      // eslint-disable-next-line no-console
      console.log(`🚀 [CurrentCharacterCard] 任务 ${chunkId} 开始动态生成`);

      // 确定身体样式
      const bodyNames =
        gender === 'male'
          ? ['defaultmale', 'joker']
          : ['defaultfemale', 'yujie', 'evehighheel'];

      // 调用动态生成API
      await generateCharacterDynamic({
        chunk_id: chunkId,
        static_task_id: staticTaskId,
        body_names: bodyNames,
        gender,
      });

      // eslint-disable-next-line no-console
      console.log(
        `✅ [CurrentCharacterCard] 任务 ${chunkId} 动态生成API调用成功`,
      );

      // 通知全局服务切换到动态生成（内部会延迟 2.5 秒后启动轮询）
      switchToDynamic(chunkId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ [CurrentCharacterCard] 任务 ${chunkId} 开始动态生成失败:`,
        err,
      );
      message.error((err as Error).message || '开始动态生成失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理"重新生成"按钮点击
  const handleRetry = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log(`🔄 [CurrentCharacterCard] 重新生成任务 ${chunkId}`);

      // 通知全局服务注销任务
      unregisterTask(chunkId);

      // 1. 删除服务器端的旧角色数据
      await roleDelete(chunkId);
      // eslint-disable-next-line no-console
      console.log(`✅ [CurrentCharacterCard] 服务器端角色 ${chunkId} 已删除`);

      message.success('角色已删除');

      // 2. 隐藏主窗口和Live窗口
      try {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_LIVE_WINDOW);
      } catch (hideError) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ 隐藏窗口失败:', hideError);
      }

      // 3. 打开创建角色窗口
      const success = await openCreateCharacterWindow();
      if (success) {
        // eslint-disable-next-line no-console
        console.log(`✅ [CurrentCharacterCard] 已打开创建角色窗口`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`❌ [CurrentCharacterCard] 删除任务 ${chunkId} 失败:`, err);
      message.error((err as Error).message || '删除失败，请重试');
    }
  };

  // 计算等待时间的辅助函数
  const calculateWaitTime = (currentProgress: number, type: string): number => {
    const totalSeconds = type === 'static' ? 90 : 150; // 静态90秒，动态150秒
    const remaining = Math.max(0, 100 - currentProgress);
    return Math.ceil((remaining / 100) * totalSeconds + queueWaitCount * 60);
  };

  // 根据任务状态渲染不同的底部内容
  const renderCardContent = () => {
    // 错误状态
    if (error) {
      return (
        <div>
          <div style={{ color: '#ff4d4f', marginBottom: '8px' }}>{error}</div>
          <Button
            className={styles.actionButton}
            onClick={handleRetry}
            style={{ width: '100%' }}
          >
            重新生成
          </Button>
        </div>
      );
    }

    // 静态生成中
    if (taskType === 'static' && progress < 100) {
      return (
        <StepGenerateProcess
          status="static"
          progress={progress}
          waitTime={calculateWaitTime(progress, 'static')}
          error={error || undefined}
          waitCount={queueWaitCount}
        />
      );
    }

    // 静态生成完成
    if (taskType === 'static' && progress === 100) {
      return (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
          <Button
            className={styles.actionButton}
            onClick={isPreviewed ? handleRetry : handlePreview}
            style={{ flex: 1 }}
          >
            {isPreviewed ? '重新生成' : '预览'}
          </Button>
          <Button
            className={styles.actionButton}
            type="primary"
            onClick={handleStartDynamic}
            loading={isProcessing}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            下一步
          </Button>
        </div>
      );
    }

    // 动态生成中
    if (taskType === 'dynamic' && progress < 100) {
      return (
        <StepGenerateProcess
          status="model"
          progress={progress}
          waitTime={calculateWaitTime(progress, 'dynamic')}
          error={error || undefined}
          waitCount={queueWaitCount}
        />
      );
    }

    // 动态生成完成
    if (taskType === 'dynamic' && progress === 100) {
      return (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
          <Button className={styles.actionButton} style={{ flex: 1 }}>
            装扮
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`${styles.characterCard} ${isPreviewed ? 'selected' : ''}`}>
      {/* 右上角菜单按钮 */}
      <div
        className={`${styles.topRightIndicators} top-right-indicators`}
        ref={menuRef}
      >
        <div
          className={styles.menuButton}
          onClick={handleMenuClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleMenuClick(e);
            }
          }}
        >
          <EllipsisOutlined style={{ fontSize: '24px' }} />
        </div>

        {/* 菜单弹出层 */}
        {isMenuOpen && (
          <div className={styles.menuDropdown}>
            <div
              className={styles.menuItem}
              onClick={handleDelete}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleDelete(e);
                }
              }}
            >
              删除
            </div>
          </div>
        )}
      </div>

      {/* 背景头像 - 显示正面照预览 */}
      <div className={styles.characterImage}>
        {previewImage ? (
          <img
            alt="角色预览图"
            src={previewImage}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(51, 51, 51, 1)',
              color: 'rgba(153, 153, 153, 1)',
              fontSize: '14px',
            }}
          >
            {(() => {
              if (taskType === 'static' && progress < 100) {
                return '正在生成预览图...';
              }
              if (taskType === 'dynamic' && progress < 100) {
                return '正在生成角色模型...';
              }
              return '正在加载...';
            })()}
          </div>
        )}
      </div>

      <div className={styles.chunkId}>{initialTask.chunk_id}</div>

      {/* 底部内容 - 根据任务状态动态渲染 */}
      <div className={styles.cardContent}>{renderCardContent()}</div>
    </div>
  );
}

// 添加 defaultProps
CurrentCharacterCard.defaultProps = {
  onTaskDeleted: undefined,
  onTaskCompleted: undefined,
};

export default CurrentCharacterCard;
