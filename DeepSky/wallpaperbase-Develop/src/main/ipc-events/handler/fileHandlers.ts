import { IPCChannels } from '@shared/channels';
import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { mainHandle } from '..';
import { AppPaths } from '../../utils/appPaths';

function toBinaryBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data));
  }

  if (Array.isArray(data)) {
    return Buffer.from(data);
  }

  if (typeof data === 'string') {
    // 兼容 base64 形式传输的二进制数据
    return Buffer.from(data, 'base64');
  }

  throw new Error('二进制数据格式不支持，期望 Buffer/Uint8Array/ArrayBuffer/number[]/base64 string');
}

/**
 * 文件操作相关的IPC处理器
 * 包含：文件保存、PCM文件读取、文件夹选择等功能
 */
export const registerFileHandlers = () => {
  // 保存文件处理器
  mainHandle(
    IPCChannels.SAVE_FILE,
    async (_e, { fileType, data, filename, savePath }) => {
      try {
        // 确保保存路径存在
        const fullPath = path.join(savePath, filename);
        const dir = path.dirname(fullPath);

        console.log(`[文件保存] 目标路径: ${fullPath}`);
        console.log(`[文件保存] 目录: ${dir}`);

        if (!fs.existsSync(dir)) {
          console.log(`[文件保存] 目录不存在，正在创建: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        }

        // 根据文件类型处理数据
        switch (fileType) {
          case 'pcm': {
            // 将数据数组转换为Buffer并写入二进制文件
            const buffer = toBinaryBuffer(data);
            fs.writeFileSync(fullPath, buffer);
            break;
          }
          case 'mp3':
          case 'binary': {
            // MP3 / 通用二进制文件写入
            const buffer = toBinaryBuffer(data);
            fs.writeFileSync(fullPath, buffer);
            break;
          }
          case 'txt': {
            // 直接将字符串数据写入文本文件
            fs.writeFileSync(fullPath, data, 'utf8');
            break;
          }
          case 'json': {
            // 将JSON对象或字符串写入JSON文件
            const jsonData =
              typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            fs.writeFileSync(fullPath, jsonData, 'utf8');
            break;
          }
          default:
            throw new Error(`不支持的文件类型: ${fileType}`);
        }

        // 验证文件是否真的存在
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          console.log(
            `${fileType.toUpperCase()}文件已保存到: ${fullPath}, 大小: ${stats.size} bytes`,
          );
          return {
            success: true,
            path: fullPath,
          };
        } else {
          console.error(`文件写入后验证失败: ${fullPath} 不存在`);
          return {
            success: false,
            error: `文件写入后验证失败: ${fullPath} 不存在`,
          };
        }
      } catch (error) {
        console.error(`保存${fileType.toUpperCase()}文件失败:`, error);
        if (error instanceof Error) {
          console.error(`错误详情: ${error.message}`);
          console.error(`错误堆栈: ${error.stack}`);
          return {
            success: false,
            error: error.message,
          };
        }
        return {
          success: false,
          error: `保存${fileType.toUpperCase()}文件失败`,
        };
      }
    },
  );

  // 读取目录下的所有PCM文件
  mainHandle(IPCChannels.READ_PCM_FILES_LEGACY, async (_e, directoryPath) => {
    try {
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`目录不存在: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const pcmFiles = files.filter(
        (file) => path.extname(file).toLowerCase() === '.pcm',
      );

      const fileDataList = pcmFiles.map((file) => {
        const filePath = path.join(directoryPath, file);
        const buffer = fs.readFileSync(filePath);
        return {
          filename: file,
          data: Array.from(new Uint8Array(buffer)),
          size: buffer.length,
        };
      });

      console.log(
        `读取目录下PCM文件成功: ${directoryPath}, 共${pcmFiles.length}个文件`,
      );
      return fileDataList;
    } catch (error) {
      console.error(`读取目录下PCM文件失败:`, error);
      throw error;
    }
  });

  // 获取文件夹内所有PCM文件路径列表
  mainHandle(IPCChannels.GET_PCM_FILES, async (_e, directoryPath) => {
    try {
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`目录不存在: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const pcmFiles = files
        .filter((file) => path.extname(file).toLowerCase() === '.pcm')
        .map((file) => path.join(directoryPath, file))
        .sort(); // 按文件名排序

      console.log(
        `获取PCM文件列表成功: ${directoryPath}, 共${pcmFiles.length}个文件`,
      );
      return pcmFiles;
    } catch (error) {
      console.error(`获取PCM文件列表失败:`, error);
      throw error;
    }
  });

  // 读取单个PCM文件
  mainHandle(IPCChannels.READ_PCM_FILE, async (_e, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const buffer = fs.readFileSync(filePath);
      console.log(`PCM文件读取成功: ${filePath}, 大小: ${buffer.length} bytes`);
      return Array.from(new Uint8Array(buffer));
    } catch (error) {
      console.error(`读取PCM文件失败:`, error);
      throw error;
    }
  });

  // 检查文件/目录是否存在
  mainHandle(IPCChannels.CHECK_FILE_EXISTS, async (_e, filePath) => {
    try {
      const exists = fs.existsSync(filePath);
      console.log(`检查文件是否存在: ${filePath} -> ${exists}`);
      return exists;
    } catch (error) {
      console.error(`检查文件是否存在失败: ${filePath}`, error);
      return false;
    }
  });

  // 选择文件夹
  mainHandle(IPCChannels.SELECT_FOLDER, async (_e, defaultPath?: string) => {
    try {
      const projectRoot = AppPaths.getProjectRootPath();
      const fallbackPath = fs.existsSync(projectRoot) ? projectRoot : undefined;
      let candidatePath = fallbackPath;
      if (defaultPath && fs.existsSync(defaultPath)) {
        const stat = fs.statSync(defaultPath);
        candidatePath = stat.isDirectory() ? defaultPath : path.dirname(defaultPath);
      }

      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择PCM文件夹',
        defaultPath: candidatePath,
      });
      if (result.canceled) {
        return null;
      }
      return result.filePaths;
    } catch (error) {
      return null;
    }
  });

  // 读取目录（返回目录下的文件夹名称列表或所有内容）
  mainHandle(
    IPCChannels.READ_DIRECTORY,
    async (
      _e,
      dirPath: string,
      options?: { includeFiles?: boolean; filesOnly?: boolean },
    ) => {
      try {
        if (!fs.existsSync(dirPath)) {
          console.warn(`目录不存在: ${dirPath}`);
          return [];
        }

        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        // 根据选项决定返回什么
        if (options?.filesOnly) {
          // 只返回文件
          const files = items
            .filter((item) => item.isFile())
            .map((item) => item.name);
          console.log(`读取目录成功: ${dirPath}, 共${files.length}个文件`);
          return files;
        } else if (options?.includeFiles) {
          // 返回所有内容（目录和文件）
          const allItems = items.map((item) => item.name);
          console.log(`读取目录成功: ${dirPath}, 共${allItems.length}项内容`);
          return allItems;
        } else {
          // 默认只返回文件夹名称
          const directories = items
            .filter((item) => item.isDirectory())
            .map((item) => item.name);
          console.log(
            `读取目录成功: ${dirPath}, 共${directories.length}个文件夹`,
          );
          return directories;
        }
      } catch (error) {
        console.error(`读取目录失败:`, error);
        return [];
      }
    },
  );

  // 读取文件内容
  mainHandle(
    IPCChannels.READ_FILE,
    async (
      _e,
      { filePath, encoding = 'utf8' }: { filePath: string; encoding?: string },
    ) => {
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`文件不存在: ${filePath}`);
          return null;
        }

        const content = fs.readFileSync(filePath, encoding as BufferEncoding);
        console.log(`读取文件成功: ${filePath}`);
        return content;
      } catch (error) {
        console.error(`读取文件失败:`, error);
        return null;
      }
    },
  );

  // 删除文件
  mainHandle(IPCChannels.DELETE_FILE, async (_e, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'filePath 无效' };
      }

      if (!fs.existsSync(filePath)) {
        return { success: true, skipped: true };
      }

      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 获取项目根目录
  mainHandle(IPCChannels.GET_PROJECT_ROOT, async () => {
    try {
      const projectRoot = AppPaths.getProjectRootPath();
      console.log(`获取项目根目录: ${projectRoot}`);
      return projectRoot;
    } catch (error) {
      console.error(`获取项目根目录失败:`, error);
      return null;
    }
  });

  // 获取 resources 目录路径
  mainHandle(IPCChannels.GET_RESOURCES_PATH, async () => {
    try {
      const resourcesPath = AppPaths.getResourcesPath();
      console.log(`获取 resources 目录: ${resourcesPath}`);
      return resourcesPath;
    } catch (error) {
      console.error(`获取 resources 目录失败:`, error);
      return null;
    }
  });
};
