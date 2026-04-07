// CreateCharacter API 类型定义

export type { HttpApiResponse as ApiResponse } from './common';

// Chunk ID 响应类型
export interface ChunkResponse {
  chunk_id: number;
}

// 上传响应类型
export interface UploadResponse {
  images: Array<{
    url: string;
    filename: string;
  }>;
}

// 照片检查响应类型
// export interface SanityCheckResponse {
//   reference_image: {
//     filename: string;
//   };
//   selected_images_ordered: Array<{
//     filename: string;
//     pose_category: string;
//   }>;
//   errors: {
//     skip_errors: Array<{
//       filename: string;
//       error_code: number;
//     }>;
//     warning_errors: Array<{
//       error_code: number;
//       missing_poses?: string;
//     }>;
//   };
// }

export interface SanityCheckResponse {
  chunk_id: string;
  image_count: number;
  task_id: string;
}

// 待下载资源信息类型
export interface PendingDownload {
  type: 'static' | 'dynamic';
  url: string;
}

// 任务进度响应类型
export interface TaskResponse {
  progress: number;
  status: string;
  queueWaitCount: number;
  // 待下载资源信息（不自动下载，由调用方决定）
  pendingDownload?: PendingDownload;
}

// V2 任务响应类型
export interface TaskV2Response {
  tasks: Array<{
    task_type: 'static' | 'dynamic';
    progress: number;
    status: string;
    queue_wait_count: number;
    result_urls?: {
      static_asset?: string[];
      dynamic_asset?: string[];
    };
  }>;
}

// 角色信息响应类型
export interface RoleInfoResponse {
  role: {
    model_url: {
      pak: string[];
    };
  };
}

// 下载响应类型
export interface DownloadResponse {
  result_urls: {
    static_asset: string[];
  };
}

// 生成请求类型
export interface GenerateRequest {
  chunk_id: number;
  // model_type: string;
  gender: 'male' | 'female';
  images: Array<{
    image_url: string;
    image_type: string;
  }>;
}
// 生成动态模型请求类型
export interface GenerateDynamicRequest {
  chunk_id: number;
  static_task_id: string;
  // body_names: string[];
  gender: 'male' | 'female';
}
// 姿态生成请求类型
export interface PoseGenerationRequest {
  chunk_id: number;
  missing_pose: string;
  image_url: string;
}

// 姿态生成响应类型
export interface PoseGenerationResponse {
  images: string[];
}
export interface BodyNameListRequest {
  female: string[];
  male: string[];
}
export interface ImageCheckResponse {
  tasks: Array<{
    task_id?: string;
    task_type?: string;
    status?: string;
    progress?: string;
  }>;
}

// 运行中任务列表响应类型
export interface RunningTaskItem {
  task_id: string;
  chunk_id: number;
  task_type: 'sanitycheck' | 'static' | 'dynamic' | 'hair3d' | string;
  status: string;
  progress: string;
  result_urls: {
    static_asset?: string[];
    dynamic_asset?: string[];
    [key: string]: any; // 允许其他可能的字段
  };
  step_description: string;
  queue_wait_count: number;
  created_at: string;
  updated_at: string;
  error_message?: string; // 可选字段
}

export interface RunningTaskListResponse {
  tasks: RunningTaskItem[];
  total: number;
}

// 版本类型
export type ApiVersion = 1 | 2;
