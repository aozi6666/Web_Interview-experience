import { app } from 'electron';
import * as koffi from 'koffi';
import path from 'path';
import {
  char_ptr,
  gpwWeb_Create,
  gpwWeb_Destroy,
  gpwWeb_GetLastError,
  gpwWeb_Process,
  gpwWeb_Render,
  gpwWeb_SetResourcePath,
  gpwWeb_Update,
  GpwwStatus,
} from './dll';

/**
 * 面部美颜处理类
 * DLL采用延迟加载策略，构造时不会加载DLL，
 * 仅在首次调用处理方法时才会触发加载。
 */
export class FaceBeautyProcessor {
  private session: bigint | null = null;

  private resourcePathSet = false;

  /**
   * 确保DLL已加载且资源路径已设置（延迟初始化）
   * 在每个需要调用DLL的公共方法开头调用
   */
  private ensureReady(): void {
    this.setResourcePath();
  }

  /**
   * 设置资源路径
   */
  private setResourcePath(): void {
    if (this.resourcePathSet) return;

    // 获取资源路径，兼容打包和开发环境
    let resourcePath: string;

    if (app.isPackaged) {
      // 打包后，extraResources 中的文件会被放在 process.resourcesPath 下
      resourcePath = path.join(
        process.resourcesPath,
        'resources',
        'faceBeauty',
        'resource',
      );
    } else {
      resourcePath = path.join(
        process.cwd(),
        'resources',
        'faceBeauty',
        'resource',
      );
    }

    const status = gpwWeb_SetResourcePath(resourcePath);

    if (status !== GpwwStatus.GPWW_OK) {
      const error = gpwWeb_GetLastError();
      throw new Error(`设置资源路径失败: ${error}`);
    }

    this.resourcePathSet = true;
  }

  /**
   * 一次性处理图像（简单模式）
   * @param imagePath 图像文件路径
   * @param params 美颜参数JSON字符串
   * @returns 处理后的base64图像数据和尺寸信息
   */
  processImage(
    imagePath: string,
    params: string,
  ): Promise<{
    base64Data: string;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        this.ensureReady();
        // 为输出参数分配内存 - 修复内存分配大小
        const outB64Png = koffi.alloc('char*', 1); // 分配一个指针
        const outLen = koffi.alloc('int', 1); // 分配一个int
        const outW = koffi.alloc('int', 1); // 分配一个int
        const outH = koffi.alloc('int', 1); // 分配一个int

        // 调用DLL函数，传入输出参数的指针
        const status = gpwWeb_Process(
          imagePath,
          params,
          outB64Png,
          outLen,
          outW,
          outH,
        );

        if (status !== GpwwStatus.GPWW_OK) {
          const error = gpwWeb_GetLastError();
          reject(new Error(`图像处理失败: ${error}`));
          return;
        }

        // 从输出参数中读取结果 - 修复指针解码方式
        const base64Data = koffi.decode(outB64Png, char_ptr); // 使用正确的类型解码
        const width = koffi.decode(outW, 'int');
        const height = koffi.decode(outH, 'int');

        resolve({
          base64Data,
          width,
          height,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 创建处理会话（高级模式）
   * @param imagePath 图像文件路径
   * @param params 初始参数JSON字符串
   */
  createSession(imagePath: string, params: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ensureReady();

        if (this.session !== null) {
          this.destroySession();
        }

        const outSession = koffi.alloc('uint64', 1); // 分配一个uint64
        const status = gpwWeb_Create(imagePath, params, outSession);

        if (status !== GpwwStatus.GPWW_OK) {
          const error = gpwWeb_GetLastError();
          reject(new Error(`创建会话失败: ${error}`));
          return;
        }

        this.session = koffi.decode(outSession, 'uint64'); // 读取uint64值
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 更新会话参数
   * @param params 新的参数JSON字符串
   */
  updateSession(params: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ensureReady();

        if (this.session === null) {
          reject(new Error('会话未创建，请先调用 createSession'));
          return;
        }

        const status = gpwWeb_Update(this.session, params);

        if (status !== GpwwStatus.GPWW_OK) {
          const error = gpwWeb_GetLastError();
          reject(new Error(`更新会话参数失败: ${error}`));
          return;
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 渲染图像
   * @returns 渲染后的base64图像数据和尺寸信息
   */
  renderImage(): Promise<{
    base64Data: string;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        this.ensureReady();

        if (this.session === null) {
          reject(new Error('会话未创建，请先调用 createSession'));
          return;
        }

        // 为输出参数分配内存 - 修复内存分配
        const outB64Png = koffi.alloc('char*', 1); // 分配一个指针
        const outLen = koffi.alloc('int', 1); // 分配一个int
        const outW = koffi.alloc('int', 1); // 分配一个int
        const outH = koffi.alloc('int', 1); // 分配一个int

        // 调用DLL函数，传入输出参数的指针
        const status = gpwWeb_Render(
          this.session,
          outB64Png,
          outLen,
          outW,
          outH,
        );

        if (status !== GpwwStatus.GPWW_OK) {
          const error = gpwWeb_GetLastError();
          reject(new Error(`渲染图像失败: ${error}`));
          return;
        }

        // 从输出参数中读取结果 - 修复指针解码方式
        const base64Data = koffi.decode(outB64Png, char_ptr); // 使用正确的类型解码
        const width = koffi.decode(outW, 'int');
        const height = koffi.decode(outH, 'int');

        resolve({
          base64Data,
          width,
          height,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 销毁会话
   */
  destroySession(): void {
    if (this.session !== null) {
      gpwWeb_Destroy(this.session);
      this.session = null;
    }
  }

  /**
   * 获取最后的错误信息
   */
  getLastError(): string {
    return gpwWeb_GetLastError();
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.destroySession();
  }
}

/**
 * 美颜参数构建器
 */
export class BeautyParamsBuilder {
  private filters: {
    beauty?: { blurAlpha?: number; white?: number };
    reshape?: { faceSlim?: number; eyeZoom?: number };
    lipstick?: { blend?: number };
    blusher?: { blend?: number };
  } = {};

  /**
   * 设置美白程度
   * @param level 美白级别 (0.0 - 1.0)
   */
  setWhite(level: number): BeautyParamsBuilder {
    if (!this.filters.beauty) this.filters.beauty = {};
    this.filters.beauty.white = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置模糊透明度（磨皮）
   * @param level 透明度 (0.0 - 1.0)
   */
  setBlurAlpha(level: number): BeautyParamsBuilder {
    if (!this.filters.beauty) this.filters.beauty = {};
    this.filters.beauty.blurAlpha = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置瘦脸程度
   * @param level 瘦脸级别 (0.0 - 1.0)
   */
  setFaceSlim(level: number): BeautyParamsBuilder {
    if (!this.filters.reshape) this.filters.reshape = {};
    this.filters.reshape.faceSlim = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置大眼程度
   * @param level 大眼级别 (0.0 - 1.0)
   */
  setEyeZoom(level: number): BeautyParamsBuilder {
    if (!this.filters.reshape) this.filters.reshape = {};
    this.filters.reshape.eyeZoom = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置腮红混合级别
   * @param level 混合级别 (0.0 - 1.0)
   */
  setBlusherBlend(level: number): BeautyParamsBuilder {
    if (!this.filters.blusher) this.filters.blusher = {};
    this.filters.blusher.blend = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置口红混合级别
   * @param level 混合级别 (0.0 - 1.0)
   */
  setLipstickBlend(level: number): BeautyParamsBuilder {
    if (!this.filters.lipstick) this.filters.lipstick = {};
    this.filters.lipstick.blend = Math.max(0, Math.min(1, level));
    return this;
  }

  /**
   * 设置美颜滤镜参数
   * @param blurAlpha 磨皮透明度 (0.0 - 1.0)
   * @param white 美白程度 (0.0 - 1.0)
   */
  setBeautyFilter(blurAlpha: number, white: number): BeautyParamsBuilder {
    this.filters.beauty = {
      blurAlpha: Math.max(0, Math.min(1, blurAlpha)),
      white: Math.max(0, Math.min(1, white)),
    };
    return this;
  }

  /**
   * 设置脸型重塑参数
   * @param faceSlim 瘦脸程度 (0.0 - 1.0)
   * @param eyeZoom 大眼程度 (0.0 - 1.0)
   */
  setReshapeFilter(faceSlim: number, eyeZoom: number): BeautyParamsBuilder {
    this.filters.reshape = {
      faceSlim: Math.max(0, Math.min(1, faceSlim)),
      eyeZoom: Math.max(0, Math.min(1, eyeZoom)),
    };
    return this;
  }

  /**
   * 设置口红滤镜参数
   * @param blend 混合级别 (0.0 - 1.0)
   */
  setLipstickFilter(blend: number): BeautyParamsBuilder {
    this.filters.lipstick = {
      blend: Math.max(0, Math.min(1, blend)),
    };
    return this;
  }

  /**
   * 设置腮红滤镜参数
   * @param blend 混合级别 (0.0 - 1.0)
   */
  setBlusherFilter(blend: number): BeautyParamsBuilder {
    this.filters.blusher = {
      blend: Math.max(0, Math.min(1, blend)),
    };
    return this;
  }

  /**
   * 构建参数JSON字符串
   */
  build(): string {
    return JSON.stringify({ filters: this.filters });
  }

  /**
   * 重置所有参数
   */
  reset(): BeautyParamsBuilder {
    this.filters = {};
    return this;
  }

  /**
   * 获取当前参数对象（用于调试）
   */
  getParams(): {
    filters: {
      beauty?: { blurAlpha?: number; white?: number };
      reshape?: { faceSlim?: number; eyeZoom?: number };
      lipstick?: { blend?: number };
      blusher?: { blend?: number };
    };
  } {
    return { filters: this.filters };
  }
}

// 导出默认实例
export const faceBeautyProcessor = new FaceBeautyProcessor();
export const beautyParamsBuilder = new BeautyParamsBuilder();
