import type { ITexture } from '../../rendering/interfaces/ITexture';

export interface TextureOutputProvider {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  getOutputTexture(): ITexture | null;
}

/**
 * 通用 FBO 纹理注册表。
 * 负责跨图层输出纹理引用以及场景级全局 FBO 纹理引用。
 */
export class FBORegistry {
  private static _layerOutputs: Map<string, TextureOutputProvider> = new Map();
  private static _globalTextures: Map<string, ITexture> = new Map();

  static registerLayerOutput(name: string, provider: TextureOutputProvider): void {
    this._layerOutputs.set(name, provider);
  }

  static unregisterLayerOutput(name: string): void {
    this._layerOutputs.delete(name);
  }

  static getLayerOutputProvider(name: string): TextureOutputProvider | null {
    return this._layerOutputs.get(name) ?? null;
  }

  static getLayerOutputTexture(name: string): ITexture | null {
    return this._layerOutputs.get(name)?.getOutputTexture() ?? null;
  }

  static setGlobalTexture(name: string, texture: ITexture): void {
    this._globalTextures.set(name, texture);
  }

  static getGlobalTexture(name: string): ITexture | null {
    return this._globalTextures.get(name) ?? null;
  }

  static clear(): void {
    this._layerOutputs.clear();
    this._globalTextures.clear();
  }
}
