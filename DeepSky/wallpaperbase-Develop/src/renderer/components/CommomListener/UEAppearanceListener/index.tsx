import { AppearanceData, useAppearance } from '@contexts/AppearanceContext';
import { useApplyWallpaper } from '@hooks/useApplyWallpaper';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import {
  formatTimestamp,
  getAndClearAppearanceStartTime,
} from '@utils/appearanceAnalytics';
import {
  isDefaultCharacter,
  saveDefaultAppearance,
} from '@utils/appearanceStorage';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { message } from 'antd';
import { useEffect, useRef } from 'react';
import { DEFAULT_APPEARANCE_DATA } from '../../../pages/Character/constance';

const ipcEvents = getIpcEvents();

/**
 * UE外观数据监听组件
 * 职责：
 * 1. 监听 UE_FORM_APPEARANCE_COMMAND 消息 - 保存外观数据并应用到当前场景
 * 2. 监听 UE_FORM_APPEARANCE_RETURN 消息 - 恢复壁纸状态
 *
 * 优化：使用 useRef 存储最新的函数引用，避免监听器重复注册
 */
export function UEAppearanceListener() {
  const { processAppearanceData } = useAppearance();
  const { resetWallpaperAndReconnect } = useApplyWallpaper();

  // 🔑 使用 Ref 存储最新的函数引用，避免 useEffect 重新执行
  const processAppearanceDataRef = useRef(processAppearanceData);
  const resetWallpaperAndReconnectRef = useRef(resetWallpaperAndReconnect);
  const isListenerRegisteredRef = useRef(false);
  // 防抖：记录最后一次发送埋点的时间，避免短时间内重复发送
  const lastAnalyticsTimeRef = useRef<number>(0);
  const ANALYTICS_DEBOUNCE_MS = 1000; // 1秒内只发送一次埋点
  // 防止重复处理：记录正在处理的消息的 chunkId 和时间戳
  const processingRef = useRef<{ chunkId: number; timestamp: number } | null>(
    null,
  );

  // 保持 ref 始终指向最新的函数
  useEffect(() => {
    processAppearanceDataRef.current = processAppearanceData;
    resetWallpaperAndReconnectRef.current = resetWallpaperAndReconnect;
  });

  // 🎧 只在组件挂载时注册一次监听器，避免重复注册
  useEffect(() => {
    // 🔒 防止重复注册
    if (isListenerRegisteredRef.current) {
      console.warn('⚠️ UEAppearanceListener 监听器已注册，跳过重复注册');
      return undefined;
    }

    console.log('🎧 UEAppearanceListener 开始监听（仅注册一次）');
    isListenerRegisteredRef.current = true;

    const handleGetAppearanceCommand = async (data: any) => {
      console.log('📨 UEAppearanceListener 收到外观数据:', {
        data,
        dataType: typeof data,
        keys: data ? Object.keys(data) : [],
      });

      const appearanceData = data as AppearanceData;
      const { chunkId } = appearanceData;
      const now = Date.now();

      // 🔒 防止重复处理：如果同一个 chunkId 在1秒内被处理过，跳过
      if (
        processingRef.current &&
        processingRef.current.chunkId === chunkId &&
        now - processingRef.current.timestamp < ANALYTICS_DEBOUNCE_MS
      ) {
        console.warn(
          `⚠️ 跳过重复处理：chunkId ${chunkId} 在 ${now - processingRef.current.timestamp}ms 前已处理`,
        );
        return;
      }

      // 记录正在处理的消息
      processingRef.current = { chunkId, timestamp: now };

      try {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.BGM_RESUME, {
          reason: 'appearance',
        });
      } catch (error) {
        console.warn('⚠️ 请求恢复背景音乐失败（保存外观）:', error);
      }

      resetWallpaperAndReconnectRef.current();

      // 注意：不在这里触发角色列表刷新事件
      // processAppearanceData 函数内部会触发刷新事件，避免重复触发

      try {
        // 📊 发送化妆捏脸保存埋点
        try {
          const visitorId = getVisitorId();
          let parsedAppearanceData: any = null;

          // 解析 appearanceData
          try {
            parsedAppearanceData =
              typeof appearanceData.appearanceData === 'string'
                ? JSON.parse(appearanceData.appearanceData)
                : appearanceData.appearanceData;
          } catch (parseError) {
            // eslint-disable-next-line no-console
            console.warn('解析 appearanceData 失败:', parseError);
          }

          // 检测是否是重置操作：比较解析后的数据是否等于默认外观数据
          const isReset =
            parsedAppearanceData &&
            JSON.stringify(parsedAppearanceData) ===
              JSON.stringify(DEFAULT_APPEARANCE_DATA);

          // 防抖：检查距离上次发送埋点的时间
          const timeSinceLastAnalytics = now - lastAnalyticsTimeRef.current;
          const shouldSendAnalytics =
            timeSinceLastAnalytics >= ANALYTICS_DEBOUNCE_MS;

          if (isReset) {
            // 重置操作：发送重置埋点
            if (shouldSendAnalytics) {
              // 更新最后发送时间
              lastAnalyticsTimeRef.current = now;

              analytics
                .track(AnalyticsEvent.WALLPAPER_RESET, {
                  visitor_id: visitorId,
                })
                .catch((err) => {
                  // eslint-disable-next-line no-console
                  console.error(
                    '重置外貌埋点失败:',
                    err?.message || String(err),
                  );
                });
            } else {
              console.warn(
                `⚠️ 埋点防抖：距离上次发送仅 ${timeSinceLastAnalytics}ms，跳过本次重置埋点发送`,
              );
            }
          } else {
            // 非重置操作，发送保存埋点
            // 提取参数
            const faceShapeParams =
              parsedAppearanceData?.MakeUp?.FaceShapeSettings || {};
            const makeupParams =
              parsedAppearanceData?.MakeUp?.MakeUpSettings || {};
            const hairParams = parsedAppearanceData?.Hair || {};
            const glassesParams = parsedAppearanceData?.Glasses || {};
            const clothParams =
              parsedAppearanceData?.Cloth || parsedAppearanceData?.Dress || {};

            // 提取阴影淡化状态
            let shadowFadeEnabled: boolean | null = null;
            if (parsedAppearanceData?.ShadowFade?.enabled !== undefined) {
              shadowFadeEnabled = parsedAppearanceData.ShadowFade.enabled;
            } else if (parsedAppearanceData?.Shadow?.fade !== undefined) {
              shadowFadeEnabled = parsedAppearanceData.Shadow.fade;
            }

            // 提取ID
            const faceShapeId = faceShapeParams?.FaceShape?.id || null;
            const makeupId = makeupParams?.id || makeupParams?.MakeUpId || null;
            const hairId = hairParams?.id || hairParams?.HairId || null;
            const glassesId =
              glassesParams?.id || glassesParams?.GlassesId || null;
            const clothId =
              clothParams?.id ||
              clothParams?.ClothId ||
              clothParams?.DressId ||
              null;

            // 只有在防抖检查通过时才发送埋点
            if (shouldSendAnalytics) {
              // 更新最后发送时间
              lastAnalyticsTimeRef.current = now;
              // 获取装扮开始时间和结束时间
              const chunkIdStr = chunkId.toString();
              const startTime = getAndClearAppearanceStartTime(chunkIdStr);
              const endTime = formatTimestamp(new Date());

              analytics
                .track(AnalyticsEvent.APPEARANCE_SAVE, {
                  chunk_id: appearanceData.chunkId,
                  gender: appearanceData.gender,
                  // face_shape_params: JSON.stringify(faceShapeParams),
                  face_shape_id: faceShapeId,
                  makeup_params: JSON.stringify(makeupParams),
                  makeup_id: makeupId,
                  hair_params: JSON.stringify(hairParams),
                  hair_id: hairId,
                  glasses_params: JSON.stringify(glassesParams),
                  glasses_id: glassesId,
                  cloth_params: JSON.stringify(clothParams),
                  cloth_id: clothId,
                  shadow_fade_enabled: shadowFadeEnabled,
                  start_time: startTime || null, // 装扮开始时间（点击装扮按钮时）
                  end_time: endTime, // 装扮结束时间（点击保存按钮时）
                  visitor_id: visitorId,
                })
                .catch((err) => {
                  // eslint-disable-next-line no-console
                  // 只打印错误消息，避免传递整个错误对象导致克隆失败
                  console.error(
                    '化妆捏脸保存埋点失败:',
                    err?.message || String(err),
                  );
                });
            }
          }
        } catch (analyticsError) {
          // eslint-disable-next-line no-console
          const errorMessage =
            analyticsError instanceof Error
              ? analyticsError.message
              : String(analyticsError);
          message.error(`发送化妆捏脸保存埋点时出错: ${errorMessage}`);
          console.error('发送化妆捏脸保存埋点时出错:', analyticsError);
        }

        // 1️⃣ 处理外观数据（保存到数据库）- 通过 ref 访问最新函数
        console.log('💄 开始处理外观数据...');
        await processAppearanceDataRef.current(appearanceData);
        console.log('✅ 外观数据处理完成');

        // 1.5️⃣ 如果是默认角色，同时保存到 localStorage
        const chunkIdStr = chunkId.toString();
        if (isDefaultCharacter(chunkIdStr)) {
          console.log(
            `💾 检测到默认角色 ${chunkIdStr}，保存到 localStorage...`,
          );
          const saved = saveDefaultAppearance(chunkIdStr, appearanceData);
          if (saved) {
            console.log(`✅ 默认角色 ${chunkIdStr} 外观数据已保存到本地存储`);
          } else {
            console.warn(
              `⚠️ 默认角色 ${chunkIdStr} 外观数据保存到本地存储失败，但不影响主流程`,
            );
          }
        }

        // 🆕 确保角色列表刷新（延迟一下，确保截图文件已生成）
        setTimeout(() => {
          console.log('🔄 触发角色列表刷新事件（确保图片更新）');
          const refreshEvent = new CustomEvent('character-list-refresh', {
            detail: {
              chunkId: appearanceData.chunkId,
              reason: 'appearance_saved',
            },
          });
          window.dispatchEvent(refreshEvent);
          console.log('✅ 已发送角色列表刷新事件');
        }, 500);

        // 2️⃣ 应用角色外观到当前场景
        console.log('🎭 应用角色外观到当前场景...');
        try {
          // // 准备外观数据
          // let finalAppearanceData = appearanceData.appearanceData;

          // if (isDefaultCharacter(chunkId)) {
          //   // 从 localStorage 读取最新的外观数据
          //   const localAppearanceData = getDefaultAppearanceData(
          //     chunkId as '000001' | '000002' | '000003' | '000004',
          //   );
          //   finalAppearanceData = localAppearanceData.appearanceData;
          //   console.log(
          //     `✅ 从 localStorage 读取默认角色 ${chunkId} 的外观数据`,
          //   );
          // }

          // // 发送应用外观命令到 UE
          // console.log('📤 发送应用外观命令到 UE:', {
          //   type: 'appearanceApply',
          //   data: {
          //     scene:
          //       appearanceData.gender === 'male'
          //         ? 'live_level_01'
          //         : 'live_level_03',
          //     subLevelData: {
          //       modelId: appearanceData.chunkId,
          //       head: appearanceData.chunkId,
          //       bodyType: appearanceData.gender,
          //       appearanceData: JSON.parse(finalAppearanceData),
          //     },
          //   },
          // });

          // await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_APPEARANCE_APPLY, {
          //   type: 'appearanceApply',
          //   data: {
          //     scene:
          //       appearanceData.gender === 'male'
          //         ? 'live_level_01'
          //         : 'live_level_03',
          //     subLevelData: {
          //       modelId: appearanceData.chunkId,
          //       head: appearanceData.chunkId,
          //       bodyType: appearanceData.gender,
          //       appearanceData: JSON.parse(finalAppearanceData),
          //     },
          //   },
          // });

          console.log('✅ 角色外观已应用');
        } catch (applyError) {
          console.error('❌ 应用角色外观失败:', applyError);
          console.warn('⚠️ 角色外观应用失败，但数据已保存');
        }

        // 3️⃣ 显示主窗口和Live窗口
        console.log('👁️ 还原显示窗口...');
        try {
          await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.SHOW_MAIN_WINDOW,
          );
          console.log('✅ 主窗口已显示');
        } catch (showMainError) {
          console.warn('⚠️ 显示主窗口失败:', showMainError);
        }

        try {
          await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.SHOW_LIVE_WINDOW,
          );
          console.log('✅ Live窗口已显示');
        } catch (showLiveError) {
          console.warn('⚠️ 显示Live窗口失败:', showLiveError);
        }
      } catch (error) {
        console.error('❌ 处理外观数据或重置壁纸失败:', error);
        message.error('处理外观数据或重置壁纸失败:');
        // 错误已在各自的函数中显示，这里只记录日志
      }
    };

    const handleAppearanceReturn = async (data: any) => {
      console.log('📨 UEAppearanceListener 收到外观返回数据:', {
        data,
        dataType: typeof data,
        keys: data ? Object.keys(data) : [],
      });

      try {
        try {
          await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.BGM_RESUME, {
            reason: 'appearance',
          });
        } catch (error) {
          console.warn('⚠️ 请求恢复背景音乐失败（返回外观）:', error);
        }

        resetWallpaperAndReconnectRef.current();

        // 显示主窗口和Live窗口
        console.log('👁️ 还原显示窗口...');
        try {
          await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.SHOW_MAIN_WINDOW,
          );
          console.log('✅ 主窗口已显示');
        } catch (showMainError) {
          console.warn('⚠️ 显示主窗口失败:', showMainError);
        }

        // try {
        //   await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_LIVE_WINDOW);
        //   console.log('✅ Live窗口已显示');
        // } catch (showLiveError) {
        //   console.warn('⚠️ 显示Live窗口失败:', showLiveError);
        // }
      } catch (error) {
        console.error('❌ 外观返回处理失败:', error);
      }
    };

    // 注册监听器
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_FORM_APPEARANCE_COMMAND,
      handleGetAppearanceCommand,
    );

    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_FORM_APPEARANCE_RETURN,
      handleAppearanceReturn,
    );

    // 清理函数：只在组件卸载时执行
    return () => {
      console.log('🔄 UEAppearanceListener 停止监听（组件卸载）');
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_FORM_APPEARANCE_COMMAND,
        handleGetAppearanceCommand,
      );
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_FORM_APPEARANCE_RETURN,
        handleAppearanceReturn,
      );
      isListenerRegisteredRef.current = false;
    };
  }, []); // 空依赖数组，确保只注册一次

  return null;
}

export default UEAppearanceListener;
