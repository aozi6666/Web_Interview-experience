/**
 * 配置相关命令类型定义
 */

// UE请求当前配置
export interface RequestSettingsCommand {
  type: 'requestSettings';
}

// 配置数据结构
export interface SettingsData {
  bBGMMute?: boolean; // BGM静音状态（true=静音，false=未静音）
  BGMVolume?: number; // BGM音量值（0-100）
  aiMute?: boolean; // AI音频静音状态（true=静音，false=未静音）
  aiVolume?: number; // AI音频音量值（0-100）
  renderingQuality?: 'low' | 'high'; // 渲染画质等级
  [key: string]: any; // 预留扩展字段
}

// Electron下发配置信息
export interface SettingsCommand {
  type: 'settings';
  data: SettingsData;
}

export type SettingsCommandTypes = RequestSettingsCommand | SettingsCommand;
