import { IPCChannels } from '@shared/channels';
import fs from 'fs/promises';
import path from 'path';
import { createIPCRegistrar, mainHandle } from '../../../ipc-events';
import {
  faceBeautyProcessor,
  getFaceBeautyLoadError,
  isFaceBeautyAvailable,
} from '../../../koffi/faceBeauty';
import { logMain } from '../../logger';

/**
 * 注册面部美颜相关的IPC处理器
 */
export function registerFaceBeautyHandlers() {
  /**
   * 检查面部美颜功能是否可用
   */
  mainHandle(IPCChannels.FACE_BEAUTY_CHECK_AVAILABLE, async () => {
    const available = isFaceBeautyAvailable();
    return {
      success: true,
      data: {
        available,
        error: available ? null : getFaceBeautyLoadError(),
      },
    };
  });

  /**
   * 处理面部美颜
   */
  mainHandle(IPCChannels.FACE_BEAUTY_PROCESS, async (event, data) => {
    try {
      const { imageData, params } = data;

      if (!imageData || !params) {
        return {
          success: false,
          message: '缺少必要参数：图像数据或处理参数',
        };
      }

      // 将base64图像数据保存为临时文件
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const tempImagePath = path.join(tempDir, `temp_${Date.now()}.png`);

      // 移除base64前缀并保存
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(tempImagePath, buffer);

      // 构建参数JSON字符串
      const paramsJson = JSON.stringify(params);

      // 调用面部美颜处理
      const result = await faceBeautyProcessor.processImage(
        tempImagePath,
        paramsJson,
      );

      // 清理临时文件
      try {
        await fs.unlink(tempImagePath);
      } catch (error) {
        console.warn('清理临时文件失败:', error);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('面部美颜处理失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /**
   * 创建面部美颜会话
   */
  mainHandle(IPCChannels.FACE_BEAUTY_CREATE_SESSION, async (event, data) => {
    try {
      const { imageData, params } = data;

      if (!imageData || !params) {
        return {
          success: false,
          message: '缺少必要参数：图像数据或处理参数',
        };
      }

      // 将base64图像数据保存为临时文件
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const tempImagePath = path.join(tempDir, `session_${Date.now()}.png`);

      // 移除base64前缀并保存
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(tempImagePath, buffer);

      // 构建参数JSON字符串
      const paramsJson = JSON.stringify(params);

      // 创建会话
      await faceBeautyProcessor.createSession(tempImagePath, paramsJson);
      logMain.info('会话创建完成', {
        channel: IPCChannels.FACE_BEAUTY_CREATE_SESSION,
        tempImagePath,
        paramsJson,
      });

      return {
        success: true,
        message: '会话创建成功',
        tempImagePath, // 返回临时文件路径，用于后续操作
      };
    } catch (error) {
      console.error('创建面部美颜会话失败:', error);
      logMain.error('创建面部美颜会话失败', {
        channel: IPCChannels.FACE_BEAUTY_CREATE_SESSION,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /**
   * 更新面部美颜会话参数
   */
  mainHandle(IPCChannels.FACE_BEAUTY_UPDATE_SESSION, async (event, data) => {
    try {
      const { params } = data;

      if (!params) {
        return {
          success: false,
          message: '缺少必要参数：处理参数',
        };
      }

      // 构建参数JSON字符串
      const paramsJson = JSON.stringify(params);

      // 更新会话参数
      await faceBeautyProcessor.updateSession(paramsJson);
      logMain.info('会话参数更新完成', {
        channel: IPCChannels.FACE_BEAUTY_UPDATE_SESSION,
        paramsJson,
      });
      return {
        success: true,
        message: '参数更新成功',
      };
    } catch (error) {
      console.error('更新面部美颜会话参数失败:', error);
      logMain.error('更新面部美颜会话参数失败', {
        channel: IPCChannels.FACE_BEAUTY_UPDATE_SESSION,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /**
   * 渲染面部美颜图像
   */
  mainHandle(IPCChannels.FACE_BEAUTY_RENDER, async (event) => {
    try {
      // 渲染图像
      const result = await faceBeautyProcessor.renderImage();
      logMain.info('面部美颜图像渲染完成', {
        channel: IPCChannels.FACE_BEAUTY_RENDER,
        result: JSON.stringify(result),
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('渲染面部美颜图像失败:', error);
      logMain.error('渲染面部美颜图像失败', {
        channel: IPCChannels.FACE_BEAUTY_RENDER,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /**
   * 销毁面部美颜会话
   */
  mainHandle(IPCChannels.FACE_BEAUTY_DESTROY_SESSION, async (event, data) => {
    try {
      // 销毁会话
      faceBeautyProcessor.destroySession();

      // 清理临时文件
      if (data?.tempImagePath) {
        try {
          await fs.unlink(data.tempImagePath);
        } catch (error) {
          console.warn('清理临时文件失败:', error);
        }
      }

      return {
        success: true,
        message: '会话销毁成功',
      };
    } catch (error) {
      console.error('销毁面部美颜会话失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /**
   * 获取面部美颜最后错误信息
   */
  mainHandle(IPCChannels.FACE_BEAUTY_GET_LAST_ERROR, async (event) => {
    try {
      const error = faceBeautyProcessor.getLastError();
      return {
        success: true,
        data: error,
      };
    } catch (error) {
      console.error('获取面部美颜错误信息失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  console.log('✅ 面部美颜IPC处理器注册完成');
}

export const registerFaceBeautyIPCHandlers = createIPCRegistrar(() => {
  registerFaceBeautyHandlers();
});
