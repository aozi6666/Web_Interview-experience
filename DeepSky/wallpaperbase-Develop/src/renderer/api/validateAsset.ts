import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';

const ipcEvents = getIpcEvents();

/**
 * 验证资源参数
 */
export interface ValidateAssetParams {
  chunkId: string | number;
  type: 'static' | 'dynamic';
}

/**
 * 验证资源结果
 */
export interface ValidateAssetResult {
  success: boolean;
  exists: boolean;
  path: string;
  size?: number;
  error?: string;
}

/**
 * 验证资源文件是否存在且有效
 * @param params 验证参数
 * @returns 验证结果
 */
export async function validateAssetFile(
  params: ValidateAssetParams,
): Promise<ValidateAssetResult> {
  try {
    const { chunkId, type } = params;

    logRenderer.info(`[validateAssetFile] 开始验证资源: chunkId=${chunkId}, type=${type}`);

    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_ASSET_FILE,
      {
        chunkId,
        type,
      },
    )) as { exists: boolean; isValid: boolean; path?: string; size?: number; error?: string };

    // 返回格式化的验证结果
    const validateResult: ValidateAssetResult = {
      success: result.exists && result.isValid,
      exists: result.exists,
      path: result.path || '',
      size: result.size,
      error: result.error,
    };

    if (validateResult.success) {
      logRenderer.info(`[validateAssetFile] 验证成功: ${result.path} (${result.size} bytes)`);
    } else {
      logRenderer.warn(`[validateAssetFile] 验证失败: ${result.error}`);
    }

    return validateResult;
  } catch (error) {
    logRenderer.error('[validateAssetFile] 验证异常:', error);

    return {
      success: false,
      exists: false,
      path: '',
      error: error instanceof Error ? error.message : '验证失败',
    };
  }
}
