/**
 * Base64 to PCM file saving utility
 * 将 base64 编码的音频数据保存为 PCM 文件
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();
type SaveFileResult = boolean | { success?: boolean; error?: string };

function isSaveFileSuccess(result: SaveFileResult): boolean {
  if (typeof result === 'boolean') {
    return result;
  }
  return Boolean(result?.success);
}

export async function base64ToBlob(base64Data: string) {
  const decodedContent = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(decodedContent.length);
  const view = new Uint8Array(arrayBuffer);

  for (let i = 0; i < decodedContent.length; i += 1) {
    view[i] = decodedContent.charCodeAt(i);
  }

  return new Blob([view], { type: 'audio/pcm' });
}

/**
 * 将base64编码的PCM数据保存为文件
 * @param base64Data - base64编码的PCM音频数据（支持带前缀或纯base64字符串）
 * @param filename - 文件名（不含扩展名）
 * @param savePath - 文件保存的目录路径
 * @returns Promise<boolean> - 保存是否成功
 */
export async function savePcmAsFile(
  base64Data: string,
  filename: string,
  savePath: string,
): Promise<boolean> {
  try {
    // 解码base64数据为二进制数据
    const binaryString = atob(base64Data);
    const view = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));

    const fullFilename = `${filename}.pcm`;

    // 通过统一的IPC接口保存到主进程指定路径
    const saveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_FILE,
      {
        fileType: 'pcm',
        data: view,
        filename: fullFilename,
        savePath,
      },
    )) as SaveFileResult;
    const success = isSaveFileSuccess(saveResult);

    if (success) {
      // eslint-disable-next-line no-console
      console.log(`PCM文件已保存: ${savePath}/${fullFilename}`);
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`保存PCM文件失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 将base64数据直接保存为txt文件
 * @param base64Data - base64编码的数据字符串
 * @param filename - 文件名（不含扩展名）
 * @param savePath - 文件保存的目录路径
 * @returns Promise<boolean> - 保存是否成功
 */
export async function saveBase64AsTxtFile(
  base64Data: string,
  filename: string,
  savePath: string,
): Promise<boolean> {
  try {
    const fullFilename = `${filename}.txt`;

    // 去除base64数据中的空格
    const cleanedBase64Data = base64Data.replace(/\s/g, '');

    // 通过统一的IPC接口保存到主进程指定路径
    const saveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_FILE,
      {
        fileType: 'txt',
        data: cleanedBase64Data,
        filename: fullFilename,
        savePath,
      },
    )) as SaveFileResult;
    const success = isSaveFileSuccess(saveResult);

    if (success) {
      // eslint-disable-next-line no-console
      console.log(`TXT文件已保存: ${savePath}/${fullFilename}`);
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`保存TXT文件失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 从本地读取单个PCM文件
 * @param filePath - PCM文件的完整路径
 * @returns Promise<Uint8Array | null> - 读取成功返回PCM数据，失败返回null
 */
export async function readPcmFile(
  filePath: string,
): Promise<Uint8Array | null> {
  try {
    const data = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.READ_PCM_FILE,
      filePath,
    );
    if (data && Array.isArray(data)) {
      const pcmData = new Uint8Array(data);
      // eslint-disable-next-line no-console
      console.log(
        `PCM文件读取成功: ${filePath}, 大小: ${pcmData.length} bytes`,
      );
      return pcmData;
    }
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`读取PCM文件失败: ${errorMessage}`);
    return null;
  }
}

/**
 * 从目录中读取所有PCM文件
 * @param directoryPath - 包含PCM文件的目录路径
 * @returns Promise<Array<{filename: string, data: Uint8Array, size: number}> | null> - 读取成功返回文件列表，失败返回null
 */
export async function readPcmFilesFromDirectory(
  directoryPath: string,
): Promise<Array<{ filename: string; data: Uint8Array; size: number }> | null> {
  try {
    const fileList = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.READ_PCM_FILES_LEGACY,
      directoryPath,
    );
    if (fileList && Array.isArray(fileList)) {
      const processedFiles = fileList.map((file) => ({
        filename: file.filename,
        data: new Uint8Array(file.data),
        size: file.size,
      }));
      // eslint-disable-next-line no-console
      console.log(
        `目录下PCM文件读取成功: ${directoryPath}, 共${processedFiles.length}个文件`,
      );
      return processedFiles;
    }
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`读取目录下PCM文件失败: ${errorMessage}`);
    return null;
  }
}

/**
 * 拼接多个PCM数据
 * @param pcmDataArray - PCM数据数组
 * @returns Uint8Array - 拼接后的PCM数据
 */
export function concatenatePcmData(pcmDataArray: Uint8Array[]): Uint8Array {
  // 计算总长度
  const totalLength = pcmDataArray.reduce((sum, data) => sum + data.length, 0);

  // 创建新的数组来存储拼接后的数据
  const concatenatedData = new Uint8Array(totalLength);

  let offset = 0;
  pcmDataArray.forEach((pcmData) => {
    concatenatedData.set(pcmData, offset);
    offset += pcmData.length;
  });

  // eslint-disable-next-line no-console
  console.log(
    `PCM数据拼接完成: ${pcmDataArray.length}个文件, 总大小: ${totalLength} bytes`,
  );
  return concatenatedData;
}

/**
 * 从多个PCM文件路径读取并拼接数据
 * @param filePaths - PCM文件路径数组
 * @param outputFilename - 输出文件名（不含扩展名）
 * @param outputPath - 输出目录路径
 * @returns Promise<boolean> - 拼接并保存是否成功
 */
export async function concatenatePcmFilesFromPaths(
  filePaths: string[],
  outputFilename: string,
  outputPath: string,
): Promise<boolean> {
  try {
    const pcmDataArray: Uint8Array[] = [];

    // 使用Promise.all批量读取所有PCM文件
    const pcmDataPromises = filePaths.map(async (filePath) => {
      const pcmData = await readPcmFile(filePath);
      if (pcmData) {
        return pcmData;
      }
      // eslint-disable-next-line no-console
      console.warn(`跳过读取失败的文件: ${filePath}`);
      return null;
    });

    const results = await Promise.all(pcmDataPromises);
    results.forEach((pcmData) => {
      if (pcmData) {
        pcmDataArray.push(pcmData);
      }
    });

    if (pcmDataArray.length === 0) {
      // eslint-disable-next-line no-console
      console.error('没有成功读取到任何PCM文件');
      return false;
    }

    // 拼接PCM数据
    const concatenatedData = concatenatePcmData(pcmDataArray);

    // 保存拼接后的PCM文件
    const saveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_FILE,
      {
        fileType: 'pcm',
        data: concatenatedData,
        filename: `${outputFilename}.pcm`,
        savePath: outputPath,
      },
    )) as SaveFileResult;
    const success = isSaveFileSuccess(saveResult);

    if (success) {
      // eslint-disable-next-line no-console
      console.log(`拼接的PCM文件已保存: ${outputPath}/${outputFilename}.pcm`);
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`拼接PCM文件失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 从指定目录读取所有PCM文件并拼接
 * @param directoryPath - 包含PCM文件的目录路径
 * @param outputFilename - 输出文件名（不含扩展名）
 * @param outputPath - 输出目录路径
 * @param sortByName - 是否按文件名排序（默认true）
 * @returns Promise<boolean> - 拼接并保存是否成功
 */
export async function concatenatePcmFilesFromDirectory(
  directoryPath: string,
  outputFilename: string,
  outputPath: string,
  sortByName: boolean = true,
): Promise<boolean> {
  try {
    // 读取目录下所有PCM文件
    const fileList = await readPcmFilesFromDirectory(directoryPath);
    if (!fileList || fileList.length === 0) {
      // eslint-disable-next-line no-console
      console.error(`目录下没有找到PCM文件: ${directoryPath}`);
      return false;
    }

    // 按文件名排序（如果需要）
    if (sortByName) {
      fileList.sort((a, b) => a.filename.localeCompare(b.filename));
      // eslint-disable-next-line no-console
      console.log(
        'PCM文件按文件名排序:',
        fileList.map((f) => f.filename),
      );
    }

    // 提取PCM数据
    const pcmDataArray = fileList.map((file) => file.data);

    // 拼接PCM数据
    const concatenatedData = concatenatePcmData(pcmDataArray);

    // 保存拼接后的PCM文件
    const saveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_FILE,
      {
        fileType: 'pcm',
        data: concatenatedData,
        filename: `${outputFilename}.pcm`,
        savePath: outputPath,
      },
    )) as SaveFileResult;
    const success = isSaveFileSuccess(saveResult);

    if (success) {
      // eslint-disable-next-line no-console
      console.log(`拼接的PCM文件已保存: ${outputPath}/${outputFilename}.pcm`);
      // eslint-disable-next-line no-console
      console.log(
        `拼接了${fileList.length}个文件，总大小: ${concatenatedData.length} bytes`,
      );
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`从目录拼接PCM文件失败: ${errorMessage}`);
    return false;
  }
}
