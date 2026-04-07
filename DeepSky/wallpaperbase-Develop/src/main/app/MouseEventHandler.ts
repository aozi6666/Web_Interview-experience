/**
 * 鼠标事件处理模块
 *
 * 负责：
 * - 全局鼠标事件监听（Windows 全局钩子 / 其他平台定时器）
 * - 鼠标遮挡检测（仅在壁纸窗口上时转发）
 * - 屏幕坐标到壁纸相对坐标转换
 * - 鼠标事件通过 WebSocket 转发到 UE
 */

import {
  isMouseOnWallpaper,
  isMouseOnWallpaperLayer,
} from '../koffi/mouseOcclusionCheck';
import { injectable } from 'inversify';
import { getDisplayCoordinator } from '../modules/backend/DisplayCoordinator';
import FullscreenDetectorManager from '../modules/fullscreen/managers/FullscreenDetectorManager';
import { logMain } from '../modules/logger';
import { getDynamicWallpaperManager } from '../modules/wallpaper/managers/DynamicWallpaperManager';
import { UEStateManager } from '../modules/ue-state/managers/UEStateManager';
import {
  mouseEventForwarder,
  MouseEventType,
  onMouseEvent,
} from '../modules/mouse/MouseEventForwarder';
import { wsService } from '../modules/websocket/core/ws-service';
import type { MouseEventCommand } from '../modules/websocket/types/system';

@injectable()
export class MouseEventHandler {
  private readonly displayCoordinator = getDisplayCoordinator();

  private readonly fiveClickWindowMs = 1500;

  private desktopLeftClickCount = 0;

  private lastDesktopLeftClickAt = 0;

  private isHandlingFiveClick = false;

  /**
   * 初始化鼠标事件监听
   */
  setup(): void {
    console.log('开始初始化鼠标事件监听器...');

    // 尝试获取嵌入器窗口句柄
    const ueManager = UEStateManager.getInstance();
    const activeHandles = ueManager.getActiveWindowHandles();
    const targetWindowHandle =
      activeHandles.length > 0 ? activeHandles[0] : undefined;

    if (targetWindowHandle) {
      console.log(
        `[鼠标监听] 🎯 检测到嵌入器窗口句柄: ${targetWindowHandle}，启用屏幕限制模式`,
      );
    } else {
      console.log(
        '[鼠标监听] 💡 未检测到嵌入器窗口，使用全局监听模式（稍后可更新）',
      );
    }

    // 启动鼠标事件转发器，传入目标窗口句柄
    mouseEventForwarder.start(targetWindowHandle);

    // 监听所有鼠标事件
    onMouseEvent((eventData) => {
      this.handleDesktopFiveClickGesture(eventData);

      // 发送鼠标事件到 UE (WebSocket)
      this.sendMouseEventToUE(eventData);

      // 过滤掉鼠标移动事件，只打印点击和滚轮事件
      if (eventData.type === 'WM_MOUSEMOVE') {
        return;
      }

      // 如果是滚轮事件，额外打印滚轮数据
      if (eventData.wheelDelta !== undefined) {
        console.log(`  └─ 滚轮数据: ${eventData.wheelDelta}`);
      }
    });

    console.log(
      '鼠标事件监听器初始化完成（Windows: 全局钩子 | 其他平台: 定时器）',
    );
  }

  /**
   * 发送鼠标事件到 UE
   * 仅当鼠标在壁纸窗口上时发送（被其他窗口挡住则不发送）
   * 坐标在转发前转换为壁纸相对坐标（支持副屏等多显示器）
   */
  private sendMouseEventToUE(eventData: any): void {
    try {
      const ueManager = UEStateManager.getInstance();
      const windowHandles = ueManager.getActiveWindowHandles();

      // 遮挡检测：检查鼠标是否在壁纸窗口上
      if (!isMouseOnWallpaper(windowHandles)) {
        return;
      }

      // 屏幕坐标转壁纸相对坐标（副屏等需换算）
      const coords = ueManager.screenToWallpaperCoords(
        eventData.x,
        eventData.y,
      );
      if (!coords) return;

      // 将 MouseEventType 转换为 MouseEventCommand 中定义的类型
      let mouseEventType:
        | 'move'
        | 'left_down'
        | 'left_up'
        | 'right_down'
        | 'right_up'
        | 'middle_down'
        | 'middle_up'
        | 'wheel';

      switch (eventData.type) {
        case MouseEventType.MOVE:
          mouseEventType = 'move';
          break;
        case MouseEventType.LEFT_DOWN:
          mouseEventType = 'left_down';
          break;
        case MouseEventType.LEFT_UP:
          mouseEventType = 'left_up';
          break;
        case MouseEventType.RIGHT_DOWN:
          mouseEventType = 'right_down';
          break;
        case MouseEventType.RIGHT_UP:
          mouseEventType = 'right_up';
          break;
        case MouseEventType.MIDDLE_DOWN:
          mouseEventType = 'middle_down';
          break;
        case MouseEventType.MIDDLE_UP:
          mouseEventType = 'middle_up';
          break;
        case MouseEventType.WHEEL:
          mouseEventType = 'wheel';
          break;
        default:
          console.warn('未知的鼠标事件类型:', eventData.type);
          return;
      }

      // 构造 MouseEventCommand（使用壁纸相对坐标，UE 不转换坐标）
      const mouseEventCommand: MouseEventCommand = {
        type: 'mouseEvent',
        data: {
          type: mouseEventType,
          x: coords.x,
          y: coords.y,
          wParam: eventData.wParam,
          timestamp: eventData.timestamp,
          wheelDelta: eventData.wheelDelta,
        },
      };

      if (wsService) {
        wsService.send(mouseEventCommand);

        // 📊 如果是左键点击，发送埋点（注意：此时还没有部位信息，部位信息需要从UE返回）
        // 部位信息会通过 WebSocket 从 UE 返回，由 BodyPartClickListener 处理埋点
        if (mouseEventType === 'left_down' || mouseEventType === 'left_up') {
          // 这里不发送埋点，因为还没有部位信息
          // 埋点会在收到UE返回的点击部位信息时发送（通过 BodyPartClickListener）
        }
      } else {
        console.warn('WsService 未初始化，无法发送鼠标事件');
      }
    } catch (error) {
      console.error('发送鼠标事件到 UE 失败:', error);
    }
  }

  /**
   * 检测桌面五连击，触发互动模式。
   * 仅在点击命中桌面壁纸层时计数，排除非透明 APP。
   */
  private handleDesktopFiveClickGesture(eventData: any): void {
    if (eventData.type !== MouseEventType.LEFT_DOWN) {
      return;
    }

    try {
      if (this.displayCoordinator.getState().displayMode === 'Interactive') {
        this.resetFiveClickState();
        return;
      }

      const videoHandles = this.getVideoWallpaperHandles();
      const isDesktopWallpaperHit = isMouseOnWallpaperLayer(videoHandles);

      if (!isDesktopWallpaperHit) {
        this.resetFiveClickState();
        return;
      }

      const now = eventData.timestamp || Date.now();
      if (now - this.lastDesktopLeftClickAt > this.fiveClickWindowMs) {
        this.desktopLeftClickCount = 1;
      } else {
        this.desktopLeftClickCount += 1;
      }
      this.lastDesktopLeftClickAt = now;

      if (this.desktopLeftClickCount < 5) {
        return;
      }

      this.resetFiveClickState();
      void this.activateInteractiveModeByGesture();
    } catch (error) {
      logMain.error('[MouseEventHandler] 处理桌面五连击失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getVideoWallpaperHandles(): number[] {
    const manager = getDynamicWallpaperManager();
    return manager
      .getActiveWallpapers()
      .map((wallpaperId) => manager.getWallpaperInfo(wallpaperId))
      .filter((wallpaper) => wallpaper?.windowHandle)
      .map((wallpaper) => wallpaper!.windowHandle);
  }

  private resetFiveClickState(): void {
    this.desktopLeftClickCount = 0;
    this.lastDesktopLeftClickAt = 0;
  }

  private async activateInteractiveModeByGesture(): Promise<void> {
    if (this.isHandlingFiveClick) {
      return;
    }

    this.isHandlingFiveClick = true;
    try {
      FullscreenDetectorManager.getInstance().setUserPreferredMode('3D');
      const switched = await this.displayCoordinator.switchDisplayMode('3D');
      if (!switched.success) {
        logMain.warn('[MouseEventHandler] 五连击触发互动模式失败', {
          error: switched.error,
        });
        return;
      }
      logMain.info('[MouseEventHandler] 五连击触发互动模式成功');
    } catch (error) {
      logMain.error('[MouseEventHandler] 五连击触发互动模式异常', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isHandlingFiveClick = false;
    }
  }

  /**
   * 停止鼠标事件监听
   */
  stop(): void {
    try {
      mouseEventForwarder.stop();
      console.log('鼠标事件监听器已停止');
    } catch (error) {
      console.error('停止鼠标事件监听器时出错:', error);
    }
  }
}
