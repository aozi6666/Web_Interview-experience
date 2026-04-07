import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { characterState } from '@stores/CharacterStore';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

/**
 * 角色部位点击埋点监听器
 * 监听来自UE的点击部位信息，记录埋点
 */
export function BodyPartClickListener() {
  useEffect(() => {
    // 监听来自UE的点击部位信息
    const handleBodyPartClick = (data: unknown) => {
      console.log('🎯 [BodyPartClickListener] 收到点击部位消息:', data);
      // 使用 logRenderer 记录到主进程日志（如果可用）
      if (window.electron.logRenderer) {
        window.electron.logRenderer
          .info('[BodyPartClickListener] 收到点击部位消息', data)
          .catch(() => {
            // 忽略日志记录失败
          });
      }

      try {
        const clickData = data as {
          hitBodyPart?: string;
          bodyPart?: string;
          name?: string;
          [key: string]: any;
        };

        // 获取点击部位名称（支持多种字段名）
        const bodyPartName =
          clickData.hitBodyPart ||
          clickData.bodyPart ||
          clickData.name ||
          'unknown';

        console.log(
          '🎯 [BodyPartClickListener] 解析后的部位名称:',
          bodyPartName,
        );
        if (window.electron.logRenderer) {
          window.electron.logRenderer
            .info('[BodyPartClickListener] 解析后的部位名称', bodyPartName)
            .catch(() => {});
        }

        // 获取壁纸ID
        let wallpaperId: string | null = null;
        try {
          wallpaperId = localStorage.getItem('appliedWallpaperId');
        } catch {
          // eslint-disable-next-line no-console
          console.warn('获取壁纸ID失败');
        }

        // 获取角色信息
        const { selectedCharacter } = characterState;
        const chunkId =
          selectedCharacter?.id?.replace('wallpaper_', '') || 'unknown';
        const personaId =
          selectedCharacter?.bot_id || selectedCharacter?.id || null;

        // 发送点击部位埋点
        const visitorId = getVisitorId();
        const eventData = {
          wallpaper_id: wallpaperId || 'unknown',
          chunk_id: chunkId || 'unknown',
          persona_id: personaId || 'unknown',
          body_part: bodyPartName,
          visitor_id: visitorId || 'unknown',
        };

        console.log('🎯 [BodyPartClickListener] 准备发送埋点:', eventData);
        if (window.electron.logRenderer) {
          window.electron.logRenderer
            .info('[BodyPartClickListener] 准备发送埋点', eventData)
            .catch(() => {});
        }

        analytics.track(AnalyticsEvent.WALLPAPER_BODY_PART_CLICK,
          eventData,
        )
          .then(() => {
            console.log('✅ [BodyPartClickListener] 埋点发送成功');
            if (window.electron.logRenderer) {
              window.electron.logRenderer
                .info('[BodyPartClickListener] 埋点发送成功')
                .catch(() => {});
            }
          })
          .catch((err) => {
            console.error('❌ [BodyPartClickListener] 埋点发送失败:', err);
            if (window.electron.logRenderer) {
              window.electron.logRenderer
                .error('[BodyPartClickListener] 埋点发送失败', err)
                .catch(() => {});
            }
          });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('处理点击部位信息失败:', error);
        if (window.electron.logRenderer) {
          window.electron.logRenderer
            .error('[BodyPartClickListener] 处理点击部位信息失败', error)
            .catch(() => {});
        }
      }
    };

    // 监听 IPC 消息
    const channel = IPCChannels.UE_FORM_BODY_PART_CLICK;
    console.log('🎯 [BodyPartClickListener] 注册 IPC 监听器:', channel);
    if (window.electron.logRenderer) {
      window.electron.logRenderer
        .info('[BodyPartClickListener] 注册 IPC 监听器', { channel })
        .catch(() => {});
    }

    // 使用 on() 返回的清理函数
    const cleanup = ipcEvents.on(IpcTarget.MAIN, channel, handleBodyPartClick);

    // 清理函数
    return () => {
      console.log('🎯 [BodyPartClickListener] 移除 IPC 监听器');
      if (window.electron.logRenderer) {
        window.electron.logRenderer
          .info('[BodyPartClickListener] 移除 IPC 监听器')
          .catch(() => {});
      }
      // 使用 on() 返回的清理函数
      if (cleanup) {
        cleanup();
      } else {
        // 备用方案：使用 off()
        ipcEvents.off(IpcTarget.MAIN, channel, handleBodyPartClick);
      }
    };
  }, []);

  return null; // 这个组件不渲染任何UI
}

export default BodyPartClickListener;
