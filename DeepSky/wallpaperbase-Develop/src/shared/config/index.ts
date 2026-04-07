/**
 * 服务与资源地址配置（渲染进程 / 主进程共用）
 * 统一管理 baseURL、平台代码、PAK 下载地址等
 */

// ========================= 平台 =========================

export const PLATFORM_CODE = 'yyya_Qe5niE_1746688872';

// ========================= 服务地址 =========================

/** 线上登录服务 */
export const LOGIN_BASE_URL = 'https://service-api.fancytech.online/login';

/** 线上壁纸服务 */
export const WALLPAPER_API_URL =
  'https://service-api.fancytech.online/wallpaper/api/v1';

/** 内网壁纸/资源服务 */
export const WALLPAPER_NATIVE_URL = 'http://10.15.101.111:31187/api/v1';

/** 线上角色/资产服务 */
export const CHARACTER_API_URL =
  'https://service-api.fancytech.online/character';

/** FaceApp GPU 服务（内网） */
export const FACE_APP_URL_INTERNAL = 'http://10.15.101.111:31195';

/** FaceApp GPU 服务（外网） */
export const FACE_APP_URL_EXTERNAL =
  'https://gpu.deepsymphony.cn:5788/character';

/** FaceApp GPU 服务（默认外网，兼容旧常量名） */
export const FACE_APP_URL = FACE_APP_URL_EXTERNAL;

/** 移动端 WS 服务 */
export const MOBILE_WS_URL = 'https://service-api.fancytech.online/wallpaper';

/** Coze 开放平台 */
export const COZE_API_URL = 'https://api.coze.cn/v1';

/** 火山语音 */
export const VOLC_VOICE_URL = 'https://service-api.fancytech.online/wallpaper';

/** 火山引擎后端代理 */
export const VOLCENGINE_PROXY_URL = 'https://service-api.fancytech.online';

/** 火山引擎直连（需 HMAC 签名） */
export const VOLCENGINE_DIRECT_URL =
  'https://speech-saas-prod.volcengineapi.com';

/** 版本检查服务 */
export const VERSION_API_URL = 'https://service-api.fancytech.online/version';

/** 本地 MCP 服务 */
export const MCP_LOCAL_URL = 'http://127.0.0.1:8000';

/** 线上 PAK 资源下载地址 */
export const PAK_BASE_URL_ONLINE =
  'https://client-resources.tos-cn-beijing.volces.com/wallpaper/pak-files/';

/** 测试环境 PAK 资源下载地址 */
export const PAK_BASE_URL_TEST = 'http://10.15.101.171/wallpaper-paks/';

const isDevelopment =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/** PAK 资源下载地址（开发环境走测试地址，其他环境走线上地址） */
export const PAK_BASE_URL = isDevelopment
  ? PAK_BASE_URL_ONLINE
  : PAK_BASE_URL_ONLINE;

// ========================= 火山引擎 =========================

const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  try {
    // @ts-ignore - process.env 在渲染进程中可能不存在
    return (
      (typeof process !== 'undefined' && process.env?.[key]) || defaultValue
    );
  } catch {
    return defaultValue;
  }
};

export const VOLCENGINE_USE_PROXY = true;

export const getVolcengineConfig = () => {
  const appId = getEnvVar('VOLCENGINE_APP_ID', '9934702733');
  const accessToken = getEnvVar(
    'VOLCENGINE_ACCESS_TOKEN',
    'WIG86BTrlHUsfx5pZefYgkGXCwtb44mV',
  );
  return {
    appId: appId || '9934702733',
    accessToken: accessToken || 'WIG86BTrlHUsfx5pZefYgkGXCwtb44mV',
  };
};

export const VOLCENGINE_API_BASE_URL = VOLCENGINE_USE_PROXY
  ? VOLCENGINE_PROXY_URL
  : getEnvVar('VOLCENGINE_API_BASE_URL') || VOLCENGINE_DIRECT_URL;
