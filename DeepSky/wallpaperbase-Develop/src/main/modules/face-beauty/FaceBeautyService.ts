import fs from 'fs/promises';
import path from 'path';
import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IFaceBeautyService } from '../../core/interfaces/IFaceBeautyService';
import {
  faceBeautyProcessor,
  getFaceBeautyLoadError,
  isFaceBeautyAvailable,
} from '../../koffi/faceBeauty';
import { registerFaceBeautyIPCHandlers } from './ipc/handlers';

@injectable()
export class FaceBeautyService implements IFaceBeautyService, IService {
  async initialize(): Promise<void> {
    registerFaceBeautyIPCHandlers();
  }

  checkAvailable(): boolean {
    return isFaceBeautyAvailable();
  }

  async createSession(params: any): Promise<any> {
    const { imageData, config } = params ?? {};
    if (!imageData || !config) {
      throw new Error('缺少必要参数: imageData/config');
    }

    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempImagePath = path.join(tempDir, `session_${Date.now()}.png`);
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    await fs.writeFile(tempImagePath, Buffer.from(base64Data, 'base64'));
    await faceBeautyProcessor.createSession(tempImagePath, JSON.stringify(config));
    return { tempImagePath };
  }

  async updateSession(_sessionId: string, params: any): Promise<void> {
    await faceBeautyProcessor.updateSession(JSON.stringify(params));
  }

  async render(_sessionId: string, _imageData: any): Promise<any> {
    return faceBeautyProcessor.renderImage();
  }

  destroySession(_sessionId: string): void {
    faceBeautyProcessor.destroySession();
  }

  getLastError(): string | null {
    return faceBeautyProcessor.getLastError() ?? getFaceBeautyLoadError();
  }

  async dispose(): Promise<void> {
    faceBeautyProcessor.destroySession();
  }
}
