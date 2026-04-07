/**
 * 装扮页按钮点击埋点监听器
 * 监听来自 UE 的装扮页按钮点击，记录用户和时间
 * UE 需发送 WebSocket 消息 type: 'appearanceButtonClick', data: { buttonType: string }
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

const BUTTON_TYPE_TO_EVENT: Record<string, string> = {
  // 短格式（推荐 UE 使用）
  compare: AnalyticsEvent.APPEARANCE_COMPARE_CLICK,
  reset_to_last_save: AnalyticsEvent.APPEARANCE_RESET_TO_LAST_SAVE_CLICK,
  reset: AnalyticsEvent.APPEARANCE_RESET_CLICK,
  shadow_fade: AnalyticsEvent.APPEARANCE_SHADOW_FADE_CLICK,
  switch_light: AnalyticsEvent.APPEARANCE_SWITCH_LIGHT_CLICK,
  back_button: AnalyticsEvent.APPEARANCE_BACK_BUTTON_CLICK,
  makeup: AnalyticsEvent.APPEARANCE_MAKEUP_CLICK,
  face_adjust: AnalyticsEvent.APPEARANCE_FACE_ADJUST_CLICK,
  hair: AnalyticsEvent.APPEARANCE_HAIR_CLICK,
  glasses: AnalyticsEvent.APPEARANCE_GLASSES_CLICK,
  clothing: AnalyticsEvent.APPEARANCE_CLOTHING_CLICK,
  full_makeup: AnalyticsEvent.APPEARANCE_FULL_MAKEUP_CLICK,
  base_makeup: AnalyticsEvent.APPEARANCE_BASE_MAKEUP_CLICK,
  skin_color: AnalyticsEvent.APPEARANCE_SKIN_COLOR_CLICK,
  contour: AnalyticsEvent.APPEARANCE_CONTOUR_CLICK,
  eyelashes: AnalyticsEvent.APPEARANCE_EYELASHES_CLICK,
  eye: AnalyticsEvent.APPEARANCE_EYE_CLICK,
  eye_makeup: AnalyticsEvent.APPEARANCE_EYE_MAKEUP_CLICK,
  eyeliner: AnalyticsEvent.APPEARANCE_EYELINER_CLICK,
  lip_makeup: AnalyticsEvent.APPEARANCE_LIP_MAKEUP_CLICK,
  blush: AnalyticsEvent.APPEARANCE_BLUSH_CLICK,
  face_shape: AnalyticsEvent.APPEARANCE_FACE_SHAPE_CLICK,
  forehead: AnalyticsEvent.APPEARANCE_FOREHEAD_CLICK,
  cheekbone: AnalyticsEvent.APPEARANCE_CHEEKBONE_CLICK,
  jaw: AnalyticsEvent.APPEARANCE_JAW_CLICK,
  chin: AnalyticsEvent.APPEARANCE_CHIN_CLICK,
  double_chin: AnalyticsEvent.APPEARANCE_DOUBLE_CHIN_CLICK,
  eyeball: AnalyticsEvent.APPEARANCE_EYEBALL_CLICK,
  nose: AnalyticsEvent.APPEARANCE_NOSE_CLICK,
  nose_overall: AnalyticsEvent.APPEARANCE_NOSE_OVERALL_CLICK,
  nose_top_bridge: AnalyticsEvent.APPEARANCE_NOSE_TOP_BRIDGE_CLICK,
  nose_bottom_bridge: AnalyticsEvent.APPEARANCE_NOSE_BOTTOM_BRIDGE_CLICK,
  nose_tip: AnalyticsEvent.APPEARANCE_NOSE_TIP_CLICK,
  nose_base: AnalyticsEvent.APPEARANCE_NOSE_BASE_CLICK,
  nose_edge: AnalyticsEvent.APPEARANCE_NOSE_EDGE_CLICK,
  nose_holes: AnalyticsEvent.APPEARANCE_NOSE_HOLES_CLICK,
  mouth: AnalyticsEvent.APPEARANCE_MOUTH_CLICK,
  ear: AnalyticsEvent.APPEARANCE_EAR_CLICK,
  // 完整事件名格式（兼容）
  Appearance_compare_click: AnalyticsEvent.APPEARANCE_COMPARE_CLICK,
  Appearance_reset_to_last_save_click:
    AnalyticsEvent.APPEARANCE_RESET_TO_LAST_SAVE_CLICK,
  Appearance_reset_click: AnalyticsEvent.APPEARANCE_RESET_CLICK,
  Appearance_shadow_fade_click: AnalyticsEvent.APPEARANCE_SHADOW_FADE_CLICK,
  Appearance_switch_light_click: AnalyticsEvent.APPEARANCE_SWITCH_LIGHT_CLICK,
  Appearance_back_button_click: AnalyticsEvent.APPEARANCE_BACK_BUTTON_CLICK,
  Appearance_makeup_click: AnalyticsEvent.APPEARANCE_MAKEUP_CLICK,
  Appearance_face_adjust_click: AnalyticsEvent.APPEARANCE_FACE_ADJUST_CLICK,
  Appearance_hair_click: AnalyticsEvent.APPEARANCE_HAIR_CLICK,
  Appearance_glasses_click: AnalyticsEvent.APPEARANCE_GLASSES_CLICK,
  Appearance_clothing_click: AnalyticsEvent.APPEARANCE_CLOTHING_CLICK,
  Appearance_full_makeup_click: AnalyticsEvent.APPEARANCE_FULL_MAKEUP_CLICK,
  Appearance_base_makeup_click: AnalyticsEvent.APPEARANCE_BASE_MAKEUP_CLICK,
  Appearance_skin_color_click: AnalyticsEvent.APPEARANCE_SKIN_COLOR_CLICK,
  Appearance_contour_click: AnalyticsEvent.APPEARANCE_CONTOUR_CLICK,
  Appearance_eyelashes_click: AnalyticsEvent.APPEARANCE_EYELASHES_CLICK,
  Appearance_eye_click: AnalyticsEvent.APPEARANCE_EYE_CLICK,
  Appearance_eye_makeup_click: AnalyticsEvent.APPEARANCE_EYE_MAKEUP_CLICK,
  Appearance_eyeliner_click: AnalyticsEvent.APPEARANCE_EYELINER_CLICK,
  Appearance_lip_makeup_click: AnalyticsEvent.APPEARANCE_LIP_MAKEUP_CLICK,
  Appearance_blush_click: AnalyticsEvent.APPEARANCE_BLUSH_CLICK,
  Appearance_face_shape_click: AnalyticsEvent.APPEARANCE_FACE_SHAPE_CLICK,
  Appearance_forehead_click: AnalyticsEvent.APPEARANCE_FOREHEAD_CLICK,
  Appearance_cheekbone_click: AnalyticsEvent.APPEARANCE_CHEEKBONE_CLICK,
  Appearance_jaw_click: AnalyticsEvent.APPEARANCE_JAW_CLICK,
  Appearance_chin_click: AnalyticsEvent.APPEARANCE_CHIN_CLICK,
  Appearance_double_chin_click: AnalyticsEvent.APPEARANCE_DOUBLE_CHIN_CLICK,
  Appearance_eyeball_click: AnalyticsEvent.APPEARANCE_EYEBALL_CLICK,
  Appearance_nose_click: AnalyticsEvent.APPEARANCE_NOSE_CLICK,
  Appearance_nose_overall_click: AnalyticsEvent.APPEARANCE_NOSE_OVERALL_CLICK,
  Appearance_nose_top_bridge_click:
    AnalyticsEvent.APPEARANCE_NOSE_TOP_BRIDGE_CLICK,
  Appearance_nose_bottom_bridge_click:
    AnalyticsEvent.APPEARANCE_NOSE_BOTTOM_BRIDGE_CLICK,
  Appearance_nose_tip_click: AnalyticsEvent.APPEARANCE_NOSE_TIP_CLICK,
  Appearance_nose_base_click: AnalyticsEvent.APPEARANCE_NOSE_BASE_CLICK,
  Appearance_nose_edge_click: AnalyticsEvent.APPEARANCE_NOSE_EDGE_CLICK,
  Appearance_nose_holes_click: AnalyticsEvent.APPEARANCE_NOSE_HOLES_CLICK,
  Appearance_mouth_click: AnalyticsEvent.APPEARANCE_MOUTH_CLICK,
  Appearance_ear_click: AnalyticsEvent.APPEARANCE_EAR_CLICK,
};

export function AppearanceButtonClickListener() {
  useEffect(() => {
    const handleAppearanceButtonClick = (data: unknown) => {
      try {
        const { buttonType } = (data || {}) as { buttonType?: string };
        const eventName = BUTTON_TYPE_TO_EVENT[buttonType || ''];

        if (!eventName) {
          console.warn(
            '[AppearanceButtonClickListener] 未知的 buttonType:',
            buttonType,
          );
          return;
        }

        const visitorId = getVisitorId();
        analytics.appearance.buttonClick(eventName, {
          visitor_id: visitorId || 'unknown',
        }).catch(() => {});
      } catch (error) {
        console.error('[AppearanceButtonClickListener] 处理失败:', error);
      }
    };

    const cleanup = ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_FORM_APPEARANCE_BUTTON_CLICK,
      handleAppearanceButtonClick,
    );

    return () => {
      if (cleanup) {
        cleanup();
      } else {
        ipcEvents.off(
          IpcTarget.MAIN,
          IPCChannels.UE_FORM_APPEARANCE_BUTTON_CLICK,
          handleAppearanceButtonClick,
        );
      }
    };
  }, []);

  return null;
}

export default AppearanceButtonClickListener;
