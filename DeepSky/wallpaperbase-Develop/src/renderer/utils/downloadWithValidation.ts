import { downloadBinaryFile } from '../api/requests/createCharacter';
import { validateAssetFile } from '../api/validateAsset';
import { sleep } from './common';

/**
 * 带验证的下载选项
 */
export interface DownloadWithValidationOptions {
  chunkId: string | number;
  type: 'static' | 'dynamic';
  url: string;
  maxRetries?: number; // 最大重试次数，默认 3
  retryDelay?: number; // 重试延迟（毫秒），默认 2000
  validationDelay?: number; // 验证前延迟（毫秒），等待文件写入完成，默认 500
}

/**
 * 下载验证结果
 */
export interface DownloadValidationResult {
  success: boolean;
  error?: string;
  attempts?: number; // 尝试次数
  path?: string; // 文件路径
  size?: number; // 文件大小
}

/**
 * 下载并验证资源文件
 * 包含重试机制
 * @param options 下载选项
 * @returns 下载验证结果
 */
export async function downloadWithValidation(
  options: DownloadWithValidationOptions,
): Promise<DownloadValidationResult> {
  const {
    chunkId,
    type,
    url,
    maxRetries = 3,
    retryDelay = 2000,
    validationDelay = 500,
  } = options;

  const fileName =
    type === 'static' ? 'static_assets.zip' : 'dynamic_assets.zip';
  const normalizedChunkId = Number(chunkId);

  if (!Number.isFinite(normalizedChunkId)) {
    return {
      success: false,
      error: `无效的 chunkId: ${String(chunkId)}`,
      attempts: 0,
    };
  }

  // eslint-disable-next-line no-console
  console.log(
    `📥 [downloadWithValidation] 开始下载并验证: chunkId=${chunkId}, type=${type}, maxRetries=${maxRetries}`,
  );

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line no-console
    console.log(
      `📥 [downloadWithValidation] 第 ${attempt}/${maxRetries} 次下载尝试: ${type}`,
    );

    try {
      // 步骤1: 下载文件
      const downloadResult = await downloadBinaryFile(
        url,
        fileName,
        normalizedChunkId,
      );

      if (!downloadResult.success) {
        // eslint-disable-next-line no-console
        console.warn(
          `⚠️ [downloadWithValidation] 下载失败（尝试 ${attempt}/${maxRetries}）:`,
          downloadResult.error,
        );

        // 如果是最后一次尝试，返回失败
        if (attempt === maxRetries) {
          return {
            success: false,
            error: `下载失败（已重试 ${maxRetries} 次）: ${downloadResult.error}`,
            attempts: attempt,
          };
        }

        // 等待后重试
        // eslint-disable-next-line no-console
        console.log(
          `⏳ [downloadWithValidation] 等待 ${retryDelay}ms 后重试...`,
        );
        await sleep(retryDelay);
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(
        `✅ [downloadWithValidation] 下载成功（尝试 ${attempt}/${maxRetries}）`,
      );

      // 步骤2: 等待文件写入完成
      // eslint-disable-next-line no-console
      console.log(
        `⏳ [downloadWithValidation] 等待 ${validationDelay}ms 以确保文件写入完成...`,
      );
      await sleep(validationDelay);

      // 步骤3: 验证文件
      // eslint-disable-next-line no-console
      console.log(`🔍 [downloadWithValidation] 开始验证文件...`);
      const validateResult = await validateAssetFile({ chunkId, type });

      if (validateResult.success) {
        // eslint-disable-next-line no-console
        console.log(
          `✅ [downloadWithValidation] 下载并验证成功（尝试 ${attempt}/${maxRetries}）:`,
          validateResult.path,
          validateResult.size,
          'bytes',
        );

        return {
          success: true,
          attempts: attempt,
          path: validateResult.path,
          size: validateResult.size,
        };
      }

      // 验证失败
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ [downloadWithValidation] 验证失败（尝试 ${attempt}/${maxRetries}）:`,
        validateResult.error,
      );

      // 如果是最后一次尝试，返回失败
      if (attempt === maxRetries) {
        return {
          success: false,
          error: `文件验证失败（已重试 ${maxRetries} 次）: ${validateResult.error}`,
          attempts: attempt,
          path: validateResult.path,
        };
      }

      // 等待后重试
      // eslint-disable-next-line no-console
      console.log(`⏳ [downloadWithValidation] 等待 ${retryDelay}ms 后重试...`);
      await sleep(retryDelay);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ [downloadWithValidation] 下载或验证异常（尝试 ${attempt}/${maxRetries}）:`,
        error,
      );

      // 如果是最后一次尝试，返回失败
      if (attempt === maxRetries) {
        return {
          success: false,
          error: `下载或验证异常（已重试 ${maxRetries} 次）: ${error instanceof Error ? error.message : '未知错误'}`,
          attempts: attempt,
        };
      }

      // 等待后重试
      await sleep(retryDelay);
    }
  }

  // 不应该到达这里，但为了类型安全返回失败
  return {
    success: false,
    error: '未知错误',
    attempts: maxRetries,
  };
}
