export interface ImageUpload {
  id: string;
  base64: string;
  url?: string;
  from?: 'local' | 'phone';
  error?: string;
  progress?: number;
  isChecking?: boolean;
  poseType?: string;
  isChecked?: boolean;
  taskId?: string;
  // rank: number;
}

export interface GenderOption {
  value: 'male' | 'female';
  label: string;
}

// 生成步骤枚举
export enum GenerateStep {
  IDLE = 'idle', // 空闲状态
  IMAGE_CHECKING = 'image_checking', // 图片检查中
  IMAGE_CHECKED = 'image_checked', // 图片检查完成
  STATIC_GENERATING = 'static_generating', // 静态生成中
  STATIC_COMPLETED = 'static_completed', // 静态生成完成
  DYNAMIC_GENERATING = 'dynamic_generating', // 动态生成中
  DYNAMIC_COMPLETED = 'dynamic_completed', // 动态生成完成
}

export interface UploadProgress {
  progress: number;
  step: GenerateStep;
  isLoading: boolean;
  isGenerating: boolean;
  waitCount: number;
  delay: number;
}

export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message?: string;
}

export interface ChunkResponse {
  chunk_id: number;
}

export interface UploadResponse {
  images: Array<{
    url: string;
    filename: string;
  }>;
}

export interface SanityCheckResponse {
  reference_image: {
    filename: string;
  };
  selected_images_ordered: Array<{
    filename: string;
    pose_category: string;
  }>;
  errors: {
    skip_errors: Array<{
      filename: string;
      error_code: number;
    }>;
    warning_errors: Array<{
      error_code: number;
      missing_poses?: string;
    }>;
  };
}

export interface TaskResponse {
  progress: number;
  status: string;
}

export interface GenerateRequest {
  chunk_id: number;
  model_type: string;
  gender: 'male' | 'female';
  images: Array<{
    image_url: string;
    image_type: string;
  }>;
}

export interface ModalState {
  isQrcodeOpen: boolean;
  isHelpOpen: boolean;
  isUnacceptOpen: boolean;
  isPreviewOpen: boolean;
  isShowError: boolean;
}
export interface QrCodeState  {
  url: string;

}