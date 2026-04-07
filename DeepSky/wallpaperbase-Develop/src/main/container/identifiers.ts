/**
 * Inversify 服务标识符
 * 所有模块通过 Symbol 进行依赖注入，不直接 import 实现类
 */
export const TYPES = {
  // ==================== 平台服务 ====================
  NativeService: Symbol.for('NativeService'),
  StoreService: Symbol.for('StoreService'),
  WindowService: Symbol.for('WindowService'),
  ScreenService: Symbol.for('ScreenService'),
  FullscreenService: Symbol.for('FullscreenService'),
  AutoLaunchService: Symbol.for('AutoLaunchService'),
  TrayService: Symbol.for('TrayService'),
  ShortcutService: Symbol.for('ShortcutService'),
  DownloadService: Symbol.for('DownloadService'),
  InterWindowService: Symbol.for('InterWindowService'),
  UpdateService: Symbol.for('UpdateService'),
  WebSocketService: Symbol.for('WebSocketService'),

  // ==================== 协调器 & 功能 ====================
  UEStateService: Symbol.for('UEStateService'),
  WallpaperService: Symbol.for('WallpaperService'),
  WallpaperBackendManager: Symbol.for('WallpaperBackendManager'),
  DisplayCoordinator: Symbol.for('DisplayCoordinator'),
  RTCChatService: Symbol.for('RTCChatService'),
  FaceBeautyService: Symbol.for('FaceBeautyService'),

  // ==================== 应用层 ====================
  Application: Symbol.for('Application'),
  AppState: Symbol.for('AppState'),
  AppBootstrap: Symbol.for('AppBootstrap'),
  AppWindowManager: Symbol.for('AppWindowManager'),
  AppLifecycle: Symbol.for('AppLifecycle'),
  MouseEventHandler: Symbol.for('MouseEventHandler'),
  Lifecycle: Symbol.for('Lifecycle'),

  // ==================== 集成 ====================
  IntegrationRegistry: Symbol.for('IntegrationRegistry'),
} as const;
