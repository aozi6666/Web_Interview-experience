import { BotMode } from '../../types/character';

/**
 * SystemStatusContext 专用的场景切换处理工具
 *
 * 与 DobaoContext 的 sceneHandler 功能类似，但专门为 SystemStatusContext 设计
 */

// ==================== 类型定义 ====================

/**
 * 场景切换数据类型
 */
export interface SceneData {
  /** 消息类型 */
  type: string;
  /** 场景ID */
  scene: string;
  /** 来源标识 */
  from: string;
}

/**
 * 场景切换结果类型
 */
export interface SceneHandleResult {
  /** 是否成功 */
  success: boolean;
  /** 关联的角色名称 */
  characterName?: string;
  /** Bot模式 */
  botMode?: BotMode;
  /** 错误信息 */
  error?: string;
  /** 场景ID */
  sceneId?: string;
}

/**
 * 角色信息类型
 */
export interface CharacterInfo {
  /** 角色名称 */
  name: string;
  /** 绑定的场景ID */
  scene_id: string;
  /** 角色类型 */
  type: BotMode;
}

