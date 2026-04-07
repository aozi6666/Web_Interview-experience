import { IPCChannels } from '@shared/channels';
import * as fs from 'fs';
import * as path from 'path';
import { mainHandle } from '..';
import { DownloadPathManager } from '../../modules/download/managers/DownloadPathManager';

/**
 * 文件检查请求参数
 */
interface FileCheckRequest {
  chunkId: string | number;
  type: 'static' | 'dynamic';
}

/**
 * 文件检查响应结果
 */
interface FileCheckResponse {
  exists: boolean;
  path: string;
  size?: number;
  error?: string;
  isValid?: boolean;
}

/**
 * 获取资源文件的完整路径
 * 使用与 downloadBinaryFile 完全相同的路径计算逻辑
 * @param chunkId chunk ID
 * @param type 资源类型
 * @returns 文件路径
 */
function getAssetFilePath(
  chunkId: string | number,
  type: 'static' | 'dynamic',
): string {
  const fileName =
    type === 'static' ? 'static_assets.zip' : 'dynamic_assets.zip';

  // 使用 DownloadPathManager 的默认下载路径（与下载时保持一致）
  const pathManager = DownloadPathManager.getInstance();
  const basePath = pathManager.getDefaultDownloadPath();

  // 构造完整路径：${basePath}/RebuildData/${chunkId}/${fileName}
  const filePath = path.join(
    basePath,
    'RebuildData',
    String(chunkId),
    fileName,
  );

  return filePath;
}

/**
 * 验证文件是否存在且有效
 * @param filePath 文件路径
 * @returns 验证结果
 */
function validateFile(filePath: string): {
  exists: boolean;
  size: number;
  isValid: boolean;
  error?: string;
} {
  try {
    // 检查文件是否存在
    const exists = fs.existsSync(filePath);

    if (!exists) {
      return {
        exists: false,
        size: 0,
        isValid: false,
        error: '文件不存在',
      };
    }

    // 获取文件状态
    const stats = fs.statSync(filePath);

    // 验证文件大小（至少 1KB，防止空文件或下载不完整）
    const minSize = 1024; // 1KB
    const isValid = stats.size >= minSize;

    if (!isValid) {
      return {
        exists: true,
        size: stats.size,
        isValid: false,
        error: `文件大小异常（${stats.size} bytes < ${minSize} bytes）`,
      };
    }

    return {
      exists: true,
      size: stats.size,
      isValid: true,
    };
  } catch (error) {
    return {
      exists: false,
      size: 0,
      isValid: false,
      error: error instanceof Error ? error.message : '验证失败',
    };
  }
}

/**
 * 注册资源文件验证相关的 IPC 处理器
 */
export const registerAssetValidationHandlers = () => {
  // 检查资源文件是否存在
  mainHandle(
    IPCChannels.CHECK_ASSET_FILE,
    async (_event, request: FileCheckRequest): Promise<FileCheckResponse> => {
      const { chunkId, type } = request;

      console.log(
        `🔍 [文件验证] 开始检查资源文件: chunkId=${chunkId}, type=${type}`,
      );

      try {
        // 获取 DownloadPathManager 的默认下载路径
        const pathMgr = DownloadPathManager.getInstance();
        const basePath = pathMgr.getDefaultDownloadPath();
        console.log(
          `📂 [文件验证] 使用 DownloadPathManager 的下载路径: ${basePath}`,
        );

        // 获取文件路径
        const filePath = getAssetFilePath(chunkId, type);

        console.log(`📁 [文件验证] 完整文件路径: ${filePath}`);

        // 验证文件
        const validation = validateFile(filePath);

        const response: FileCheckResponse = {
          exists: validation.exists,
          path: filePath,
          size: validation.size,
          isValid: validation.isValid,
          error: validation.error,
        };

        if (validation.isValid) {
          console.log(
            `✅ [文件验证] 文件验证成功: ${filePath} (${validation.size} bytes)`,
          );
        } else {
          console.warn(
            `⚠️ [文件验证] 文件验证失败: ${filePath} - ${validation.error}`,
          );
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        console.error(`❌ [文件验证] 检查失败:`, error);

        return {
          exists: false,
          path: '',
          error: errorMessage,
          isValid: false,
        };
      }
    },
  );

  console.log('✅ [IPC] 资源文件验证处理器已注册');
};
