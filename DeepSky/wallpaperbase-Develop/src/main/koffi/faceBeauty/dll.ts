import { app } from 'electron';
import * as koffi from 'koffi';
import path from 'path';

// 定义状态枚举（始终可用，不依赖DLL）
export enum GpwwStatus {
  GPWW_OK = 0,
  GPWW_ERR_GENERIC = -1,
  GPWW_ERR_INVALID_ARG = -2,
  GPWW_ERR_NOMEM = -3,
  GPWW_ERR_STATE = -4,
  GPWW_ERR_NOTFOUND = -5,
}

// 定义函数签名类型（koffi类型注册不依赖DLL加载）
export const gpww_status = koffi.alias('gpww_status', 'int');
export const uint64_ptr = koffi.pointer('uint64');
export const char_ptr = koffi.pointer('char');
export const char_ptr_ptr = koffi.pointer(char_ptr);
export const int_ptr = koffi.pointer('int');

// DLL路径工具函数
function getDllPath(): string {
  if (app.isPackaged) {
    // 打包后，extraResources 中的文件会被放在 process.resourcesPath 下
    return path.join(
      process.resourcesPath,
      'resources',
      'faceBeauty',
      'gpupixelWrapper.dll',
    );
  }
  return path.join(
    process.cwd(),
    'resources',
    'faceBeauty',
    'gpupixelWrapper.dll',
  );
}

function getDllDirectory(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'faceBeauty');
  }
  return path.join(process.cwd(), 'resources', 'faceBeauty');
}

// ===== 延迟加载管理 =====
let lib: koffi.IKoffiLib | null = null;
let dllLoadAttempted = false;
let dllLoadError: string | null = null;

// 保持对预加载DLL的引用，防止被GC回收后系统卸载DLL
const preloadedLibs: koffi.IKoffiLib[] = [];

/**
 * 预加载MSVC运行时DLL
 * 将 vcruntime140.dll 等运行时DLL预先加载到进程中，
 * 这样后续加载 gpupixel*.dll 时就能找到它们的依赖。
 * 解决用户电脑未安装 Visual C++ Redistributable 的问题。
 */
function preloadMsvcRuntime(dllDirectory: string): void {
  const runtimeDlls = [
    'vcruntime140.dll',
    'vcruntime140_1.dll',
    'msvcp140.dll',
  ];

  runtimeDlls.forEach((dllName) => {
    const fullPath = path.join(dllDirectory, dllName);
    try {
      const runtimeLib = koffi.load(fullPath);
      preloadedLibs.push(runtimeLib); // 保持引用，防止GC
      console.log(`预加载MSVC运行时DLL成功: ${dllName}`);
    } catch {
      // 本地文件不存在或加载失败，可能系统已安装 VC++ Redistributable，跳过即可
      console.log(`本地MSVC运行时DLL加载跳过(系统可能已安装): ${dllName}`);
    }
  });
}

/**
 * 延迟加载DLL，首次调用时才真正加载
 * @throws 如果DLL加载失败则抛出异常
 */
function ensureDllLoaded(): koffi.IKoffiLib {
  if (process.platform !== 'win32') {
    dllLoadAttempted = true;
    dllLoadError = 'Face beauty is only available on Windows';
    throw new Error(dllLoadError);
  }

  if (lib) return lib;

  // 如果之前已经尝试过加载且失败，直接抛出缓存的错误
  if (dllLoadAttempted) {
    throw new Error(
      `面部美颜DLL不可用: ${dllLoadError}\n` +
        '可能需要安装 Visual C++ Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe',
    );
  }

  dllLoadAttempted = true;
  const dllPath = getDllPath();
  const dllDirectory = getDllDirectory();

  try {
    // 1. 预加载MSVC运行时DLL（解决用户未安装VC++ Redistributable的问题）
    preloadMsvcRuntime(dllDirectory);

    // 2. 加载依赖的 gpupixel.dll
    const gpupixelDllPath = path.join(dllDirectory, 'gpupixel.dll');
    try {
      const gpupixelLib = koffi.load(gpupixelDllPath);
      preloadedLibs.push(gpupixelLib);
      console.log('Successfully loaded dependency DLL:', gpupixelDllPath);
    } catch (depError) {
      console.warn('Failed to load dependency DLL (gpupixel.dll):', depError);
    }

    // 3. 加载主 DLL
    lib = koffi.load(dllPath);
    console.log('Successfully loaded main DLL:', dllPath);
    return lib;
  } catch (error) {
    dllLoadError = error instanceof Error ? error.message : String(error);
    console.error('Failed to load faceBeauty DLL:', dllLoadError);
    console.error('DLL Path:', dllPath);
    console.error('DLL Directory:', dllDirectory);
    console.error(
      '如果缺少 Visual C++ Redistributable，请从以下地址下载安装:',
      'https://aka.ms/vs/17/release/vc_redist.x64.exe',
    );
    throw new Error(
      `面部美颜DLL加载失败: ${dllLoadError}\n` +
        '可能需要安装 Visual C++ Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe',
    );
  }
}

/**
 * 检查面部美颜功能是否可用（会触发延迟加载）
 */
export function isFaceBeautyAvailable(): boolean {
  if (lib) return true;
  if (dllLoadAttempted) return false;
  try {
    ensureDllLoaded();
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取DLL加载错误信息（如果有）
 */
export function getFaceBeautyLoadError(): string | null {
  return dllLoadError;
}

// ===== 延迟绑定的DLL函数 =====
interface BoundFunctions {
  gpwWeb_Process: (...args: any[]) => any;
  gpwWeb_Create: (...args: any[]) => any;
  gpwWeb_Update: (...args: any[]) => any;
  gpwWeb_Render: (...args: any[]) => any;
  gpwWeb_Destroy: (...args: any[]) => any;
  gpwWeb_Free: (...args: any[]) => any;
  gpwWeb_SetResourcePath: (...args: any[]) => any;
  gpwWeb_GetLastError: (...args: any[]) => any;
}

// eslint-disable-next-line import/no-mutable-exports
let cachedBoundFunctions: BoundFunctions | null = null;

/**
 * 获取绑定的DLL函数（延迟绑定，首次调用时创建）
 */
function getBoundFunctions(): BoundFunctions {
  if (cachedBoundFunctions) return cachedBoundFunctions;

  const loadedLib = ensureDllLoaded();
  cachedBoundFunctions = {
    gpwWeb_Process: loadedLib.func('gpwWeb_Process', gpww_status, [
      'string', // image_path
      'string', // json_params
      char_ptr_ptr, // out_b64_png
      int_ptr, // out_len
      int_ptr, // out_w
      int_ptr, // out_h
    ]),
    gpwWeb_Create: loadedLib.func('gpwWeb_Create', gpww_status, [
      'string', // image_path
      'string', // json_params
      uint64_ptr, // out_session
    ]),
    gpwWeb_Update: loadedLib.func('gpwWeb_Update', gpww_status, [
      'uint64', // session
      'string', // json_params
    ]),
    gpwWeb_Render: loadedLib.func('gpwWeb_Render', gpww_status, [
      'uint64', // session
      char_ptr_ptr, // out_b64_png
      int_ptr, // out_len
      int_ptr, // out_w
      int_ptr, // out_h
    ]),
    gpwWeb_Destroy: loadedLib.func('gpwWeb_Destroy', 'void', [
      'uint64', // session
    ]),
    gpwWeb_Free: loadedLib.func('gpwWeb_Free', 'void', [
      'void*', // p
    ]),
    gpwWeb_SetResourcePath: loadedLib.func(
      'gpwWeb_SetResourcePath',
      gpww_status,
      [
        'string', // dir_utf8
      ],
    ),
    gpwWeb_GetLastError: loadedLib.func('gpwWeb_GetLastError', 'string', []),
  };
  return cachedBoundFunctions;
}

// 导出延迟绑定的函数包装器（保持与原始导出相同的调用方式）
export const gpwWeb_Process = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Process(...args);

export const gpwWeb_Create = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Create(...args);

export const gpwWeb_Update = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Update(...args);

export const gpwWeb_Render = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Render(...args);

export const gpwWeb_Destroy = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Destroy(...args);

export const gpwWeb_Free = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_Free(...args);

export const gpwWeb_SetResourcePath = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_SetResourcePath(...args);

export const gpwWeb_GetLastError = (...args: any[]): any =>
  getBoundFunctions().gpwWeb_GetLastError(...args);
