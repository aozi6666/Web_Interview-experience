/**
 * 全局AI音频状态管理器
 * 管理AI音频的静音和音量状态
 */

/**
 * AI音频管理器
 * 使用单例模式，管理AI音频状态
 */
export class AIManager {
  // AI音频状态
  private currentVolume: number = 80; // 默认AI音量为80
  private previousVolume: number = 80;
  private isMuted: boolean = false;

  /**
   * 获取当前音量
   */
  public getCurrentVolume(): number {
    return this.currentVolume;
  }

  /**
   * 获取静音状态
   */
  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * 获取应该发送到UE的音量值
   * 如果静音状态，返回0；否则返回当前音量
   */
  public getVolumeForUE(): number {
    return this.isMuted ? 0 : this.currentVolume;
  }

  /**
   * 设置音量（只更新状态，不发送命令）
   * @param volume 音量值（0-100）
   */
  public setVolume(volume: number): void {
    // 确保音量在有效范围内
    const clampedVolume = Math.max(0, Math.min(100, volume));

    // 更新音量状态
    this.currentVolume = clampedVolume;

    // 如果当前不是静音状态，更新previousVolume以便静音后能恢复
    if (!this.isMuted) {
      this.previousVolume = clampedVolume;
    }

    console.log(`AI音频音量状态更新为: ${clampedVolume}%`);
  }

  /**
   * 静音（只更新状态，不发送命令）
   */
  public mute(): void {
    if (this.isMuted) return;

    this.isMuted = true;
    // 记录静音前的音量
    this.previousVolume = this.currentVolume;

    console.log(`AI音频状态已设为静音，之前音量: ${this.previousVolume}%`);
  }

  /**
   * 取消静音（只更新状态，不发送命令）
   */
  public unmute(): void {
    if (!this.isMuted) return;

    this.isMuted = false;

    console.log(`AI音频状态已设为非静音，音量: ${this.previousVolume}%`);
  }

  /**
   * 切换静音状态（只更新状态，不发送命令）
   */
  public toggleMute(): void {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * 获取完整的状态信息（用于调试）
   */
  public getState(): {
    currentVolume: number;
    previousVolume: number;
    isMuted: boolean;
    volumeForUE: number;
  } {
    return {
      currentVolume: this.currentVolume,
      previousVolume: this.previousVolume,
      isMuted: this.isMuted,
      volumeForUE: this.getVolumeForUE(),
    };
  }

  /**
   * 重置为默认状态
   */
  public reset(): void {
    this.currentVolume = 80;
    this.previousVolume = 80;
    this.isMuted = false;
    console.log('AI音频状态已重置为默认值');
  }
}

// 导出单例实例
export const aiManager = new AIManager();
