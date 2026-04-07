/**
 * FaceSanity Client
 * 前端人脸检测模块 - 替代 insightface 服务器端检测
 *
 * 遵循 FaceSanity 错误码规范
 */

/**
 * FaceSanity 错误码定义 (与后端 FaceSanity.py 保持一致)
 */
import * as faceapi from '@vladmandic/face-api';
// 导入 TensorFlow.js 核心及 WebGL 后端（必须，faceapi 依赖）
import '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// 类型定义
export const ErrorType = {
  NONE: 0,
  BUSINESS_LOGIC: 201,
  MALFORMED_REQUEST: 401,
  INVALID_IMAGE: 406,
  INTERNAL_ERROR: 500,
  FACE_NO_FACE_DETECTED: 201001, // 未检测到人脸
  FACE_MULTIPLE_FACES_DETECTED: 201002, // 检测到多个脸
  FACE_POSE_ERROR: 201003, // 姿态角度过大
  FACE_NOT_SAME_PERSON: 201004, // 不是一个人 (前端暂不做)
  FACE_BBOX_OUT_OF_BOUNDS: 201008, // bbox超出边界
  FACE_BBOX_SIZE_ERROR: 201009, // bbox太小 (<100px)
} as const;

type ErrorTypeValue = (typeof ErrorType)[keyof typeof ErrorType];

const ErrorMsg: Record<ErrorTypeValue, string> = {
  [ErrorType.NONE]: '操作成功',
  [ErrorType.BUSINESS_LOGIC]: '业务逻辑错误',
  [ErrorType.MALFORMED_REQUEST]: '请求格式错误',
  [ErrorType.INVALID_IMAGE]: '图片无效',
  [ErrorType.INTERNAL_ERROR]: '系统内部错误',
  [ErrorType.FACE_NO_FACE_DETECTED]: '未检测到人脸',
  [ErrorType.FACE_MULTIPLE_FACES_DETECTED]: '检测到多张人脸',
  [ErrorType.FACE_POSE_ERROR]: '人脸姿态角度过大',
  [ErrorType.FACE_NOT_SAME_PERSON]: '检测到非同一人，', // 前端暂不使用
  [ErrorType.FACE_BBOX_OUT_OF_BOUNDS]: '人脸超出图片边界',
  [ErrorType.FACE_BBOX_SIZE_ERROR]: '人脸区域过小',
};

// 配置接口
interface Config {
  minConfidence: number;
  minFaceSize: number;
  poseThresholds: {
    yaw: number;
    pitch: number;
    roll: number;
  };
}

// 姿态接口
interface Pose {
  yaw: number;
  pitch: number;
  roll: number;
}

// 姿态类型
type PoseType = 'Front' | 'Left' | 'Right' | 'Invalid';

// 姿态验证结果
interface PoseValidityResult {
  valid: boolean;
  issues: string[];
}

// 关键点类型 (5个关键点)
type KeyPoints5 = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

// 人脸数据接口
interface FaceData {
  bbox: [number, number, number, number];
  kps: KeyPoints5;
  det_score: number;
  embedding: number[];
  pose: Pose;
  pose_type: PoseType;
  image_width: number;
  image_height: number;
  bbox_size: number;
}

// 错误响应接口
interface ErrorResponse {
  code: ErrorTypeValue;
  msg: string;
  success: false;
  data?: any;
}

// 成功响应接口
interface SuccessResponse {
  code: ErrorTypeValue;
  msg: string;
  success: true;
  face_data: FaceData;
}

// 检测响应类型
type DetectionResponse = ErrorResponse | SuccessResponse;

// 图片输入类型
type ImageInput = HTMLImageElement | File | Blob | string;

// 批量检测结果项
interface BatchResultItem {
  index: number;
  filename: string;
  valid: boolean;
  code?: ErrorTypeValue;
  message?: string;
  pose?: Pose;
}

// 批量检测成功项（组合 BatchResultItem 和 FaceData）
interface BatchSuccessItem {
  index: number;
  filename: string;
  valid: true;
  bbox: [number, number, number, number];
  kps: KeyPoints5;
  det_score: number;
  embedding: number[];
  pose: Pose;
  pose_type: PoseType;
  image_width: number;
  image_height: number;
  bbox_size: number;
}

// 批量检测错误项
interface BatchErrorItem extends BatchResultItem {
  valid: false;
  code: ErrorTypeValue;
  message: string;
  pose?: Pose;
}

// 批量检测响应
interface BatchDetectionResponse {
  success: boolean;
  total: number;
  detected: number;
  failed: number;
  results: (BatchSuccessItem | BatchErrorItem)[];
  errors: BatchErrorItem[];
}

// 批量检测请求响应（当没有图片时）
interface BatchDetectionErrorResponse {
  success: false;
  code: ErrorTypeValue;
  msg: string;
}

type BatchDetectionResult =
  | BatchDetectionResponse
  | BatchDetectionErrorResponse;

// 目标姿态接口
interface TargetPose {
  p: number;
  y: number;
  r: number;
}

class FaceSanityClient {
  private modelsLoaded: boolean = false;
  private modelPath: string;
  private config: Config;

  constructor() {
    this.modelsLoaded = false;
    // 使用 vladmandic 的 face-api 构建
    // this.modelPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
    // 使用相对路径，兼容开发环境和生产环境（file:// 协议）
    this.modelPath = './models';

    // 配置参数
    this.config = {
      minConfidence: 0.5,
      minFaceSize: 100, // 对应 FACE_BBOX_SIZE_ERROR
      poseThresholds: {
        yaw: 50,
        pitch: 30,
        roll: 30,
      },
    };
  }

  getErrorMsg(code: ErrorTypeValue): string {
    // 优先从映射表中获取，未匹配到则返回默认提示
    return ErrorMsg[code] || `未知错误,错误码：${code}`;
  }

  /**
   * 初始化模型
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;
    console.log('Loading face-api models...');
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath),
      ]);
      this.modelsLoaded = true;
      console.log('Models loaded successfully');
    } catch (error) {
      console.error('Failed to load models:', error);
      throw new Error(
        'Failed to load face detection models. Please check network connection.',
      );
    }
  }
  async warmUp() {
    if (!this.modelsLoaded) await this.loadModels();
    // 创建一个很小的虚拟图像
    const warmupCanvas = document.createElement('canvas');
    warmupCanvas.width = 50;
    warmupCanvas.height = 50;
    const ctx = warmupCanvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 50, 50);
    
    try {
      // 执行一次虚拟检测来预热
      await faceapi
        .detectAllFaces(
          warmupCanvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      console.log('人脸检测已预热');
    } catch (error) {
      console.warn('预热失败:', error);
    }
  }
  /**
   * 处理单张图片 - 严格遵循 FaceSanity 错误逻辑
   */
  async detectSingleFace(imageInput: ImageInput): Promise<DetectionResponse> {
    if (!this.modelsLoaded) await this.loadModels();
    console.log('Starting single face detection...');
    const img = await this._loadImage(imageInput);
    // 1. 检测所有人脸 (为了判断 MULTIPLE_FACES)
    const detections = await faceapi
      .detectAllFaces(
        img,
        new faceapi.SsdMobilenetv1Options({
          minConfidence: this.config.minConfidence,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    // 错误检查 1: 未检测到人脸
    if (!detections || detections.length === 0) {
      return this._makeError(
        ErrorType.FACE_NO_FACE_DETECTED,
        'No face detected',
      );
    }
    // 错误检查 2: 检测到多张人脸 - 智能筛选策略
    let targetDetection = detections[0];

    if (detections.length > 1) {
      // 按面积大小排序 (降序)
      const sorted = detections.sort((a, b) => {
        const areaA = a.detection.box.width * a.detection.box.height;
        const areaB = b.detection.box.width * b.detection.box.height;
        return areaB - areaA;
      });

      const primary = sorted[0];
      const secondary = sorted[1];

      const areaPri =
        primary.detection.box.width * primary.detection.box.height;
      const areaSec =
        secondary.detection.box.width * secondary.detection.box.height;

      // 策略: 只有当第二张脸足够大 (例如 > 主脸的 50%) 时，才认为是"多脸错误"
      // 否则，我们假设它是背景路人，直接忽略，只处理主脸
      if (areaSec > areaPri * 0.5) {
        return this._makeError(
          ErrorType.FACE_MULTIPLE_FACES_DETECTED,
          `Multiple prominent faces detected (Secondary is ${Math.round((areaSec / areaPri) * 100)}% of Primary)`,
        );
      }

      // 智能选定主脸
      targetDetection = primary;
      console.log(
        `Ignored ${detections.length - 1} background faces. Processing primary face.`,
      );
    }

    const detection = targetDetection;
    const box = detection.detection.box;

    // 错误检查 3: 人脸太小
    const maxSize = Math.max(box.width, box.height);
    if (maxSize < this.config.minFaceSize) {
      return this._makeError(
        ErrorType.FACE_BBOX_SIZE_ERROR,
        `Face too small: ${Math.round(maxSize)}px < ${this.config.minFaceSize}px`,
      );
    }

    // 错误检查 4: 边界框超出 (face-api通常不会输出负数坐标，但为了严谨)
    if (
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > img.width ||
      box.y + box.height > img.height
    ) {
      // 注意：face-api 可能略微超出，这里可以做个宽容度或者直接截断
      // 这里为了严谨，如果严重超出则报错，轻微超出则修正
      // 实际实现：修正坐标，不报错，但在 face_data 里记录修正后的
    }

    // 提取数据
    const kps = this._extractKeyPoints5(detection.landmarks);
    const pose = this._estimatePose(detection.landmarks, box);

    // 错误检查 5: 姿态错误
    const poseCheck = this.checkPoseValidity(pose);
    if (!poseCheck.valid) {
      return this._makeError(
        ErrorType.FACE_POSE_ERROR,
        `Bad pose: ${poseCheck.issues.join(', ')}`,
        { pose },
      );
    }

    const poseType = this._determinePoseType(pose);

    // 构建成功数据
    const faceData: FaceData = {
      bbox: [
        Math.max(0, box.x),
        Math.max(0, box.y),
        Math.min(img.width, box.x + box.width),
        Math.min(img.height, box.y + box.height),
      ],
      kps: kps,
      det_score: detection.detection.score,
      embedding: Array.from(detection.descriptor),
      pose: pose,
      pose_type: poseType, // 新增字段
      image_width: img.width,
      image_height: img.height,
      bbox_size: maxSize,
    };

    return {
      code: ErrorType.NONE,
      msg: 'OK',
      success: true,
      face_data: faceData,
    };
  }

  /**
   * 批量处理
   */
  async detectMultipleFaces(images: File[]): Promise<BatchDetectionResult> {
    if (!this.modelsLoaded) await this.loadModels();

    if (!images || images.length === 0) {
      return {
        success: false,
        code: ErrorType.MALFORMED_REQUEST,
        msg: 'No images provided',
      };
    }

    const results: (BatchSuccessItem | BatchErrorItem)[] = [];
    const errors: BatchErrorItem[] = [];
    let successCount = 0;

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const filename = file.name || `image_${i + 1}.jpg`;

      try {
        const result = await this.detectSingleFace(file);

        if (result.code === ErrorType.NONE && result.success) {
          results.push({
            index: i,
            filename: filename,
            ...result.face_data,
            valid: true,
          });
          successCount++;
        } else {
          const errorData: BatchErrorItem = {
            index: i,
            filename: filename,
            code: result.code,
            message: result.msg,
            valid: false,
          };
          // 如果有部分数据（如姿态错误但检测到了脸），也带上
          if (!result.success && result.data && result.data.pose) {
            errorData.pose = result.data.pose;
          }

          errors.push(errorData);
          results.push(errorData); // 结果列表包含所有项
        }
      } catch (e) {
        const error = e as Error;
        console.error(`Error processing ${filename}:`, error);
        const sysError: BatchErrorItem = {
          index: i,
          filename: filename,
          code: ErrorType.INTERNAL_ERROR,
          message: error.message,
          valid: false,
        };
        errors.push(sysError);
        results.push(sysError);
      }
    }

    return {
      success: successCount > 0,
      total: images.length,
      detected: successCount,
      failed: errors.length,
      results: results,
      errors: errors,
    };
  }

  /**
   * 辅助：构造标准错误响应
   */
  private _makeError(
    code: ErrorTypeValue,
    msg: string,
    data: any = {},
  ): ErrorResponse {
    return {
      code: code,
      msg: msg,
      success: false,
      data: data,
    };
  }

  /**
   * 发送到服务器
   */
  async sendToServer(
    images: (File | Blob)[],
    detectionResults: BatchDetectionResponse,
    endpoint: string = '/face_id_sanity_check_fast',
    chunkId: string | null = null,
  ): Promise<any> {
    const formData = new FormData();

    images.forEach((img, i) => {
      if (img instanceof File) formData.append('images', img);
      else if (img instanceof Blob)
        formData.append('images', img, `image_${i}.jpg`);
    });

    // 只发送 valid 的结果
    const validResults = detectionResults.results.filter((r) => r.valid);

    formData.append('face_data', JSON.stringify(validResults));
    formData.append('chunk_id', chunkId || this._generateChunkId());
    formData.append('client_type', 'web_face_api');
    formData.append('embedding_dim', '128');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error('Failed to send to server:', e);
      throw e;
    }
  }

  private _extractKeyPoints5(landmarks: faceapi.FaceLandmarks68): KeyPoints5 {
    const positions = landmarks.positions;
    return [
      [positions[36].x, positions[36].y],
      [positions[45].x, positions[45].y],
      [positions[30].x, positions[30].y],
      [positions[48].x, positions[48].y],
      [positions[54].x, positions[54].y],
    ];
  }

  private _estimatePose(
    landmarks: faceapi.FaceLandmarks68,
    box: faceapi.Box,
  ): Pose {
    const positions = landmarks.positions;
    const leftEye = positions[36];
    const rightEye = positions[45];
    const nose = positions[30];

    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const roll = (Math.atan2(dy, dx) * 180) / Math.PI;

    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.sqrt(dx * dx + dy * dy);
    const yawRatio = (nose.x - eyeCenterX) / (eyeDist / 2);
    const yaw = yawRatio * 90;

    const noseRelY = (nose.y - box.y) / box.height;
    const pitch = (0.55 - noseRelY) * 180;

    return {
      yaw: parseFloat(yaw.toFixed(2)),
      pitch: parseFloat(pitch.toFixed(2)),
      roll: parseFloat(roll.toFixed(2)),
    };
  }

  checkPoseValidity(pose: Pose): PoseValidityResult {
    // 复用 _determinePoseType 的逻辑
    const type = this._determinePoseType(pose);
    if (type === 'Invalid') {
      // 计算与最近目标的差异
      const targetPoses: Record<string, TargetPose> = {
        front: { p: 0, y: 0, r: 0 },
        left: { p: 0, y: -40, r: 0 },
        right: { p: 0, y: 40, r: 0 },
      };
      const getL1 = (target: TargetPose): number =>
        Math.abs(pose.pitch - target.p) +
        Math.abs(pose.yaw - target.y) +
        Math.abs(pose.roll - target.r);

      const sFront = getL1(targetPoses.front);
      const sLeft = getL1(targetPoses.left);
      const sRight = getL1(targetPoses.right);
      const min = Math.min(sFront, sLeft, sRight);

      let bestMatch = 'Front';
      if (sLeft < sFront && sLeft < sRight) bestMatch = 'Left';
      if (sRight < sFront && sRight < sLeft) bestMatch = 'Right';

      const t = targetPoses[bestMatch.toLowerCase()];
      const dP = (pose.pitch - t.p).toFixed(1); // 带正负号更有用
      const dY = (pose.yaw - t.y).toFixed(1);
      const dR = (pose.roll - t.r).toFixed(1);

      return {
        valid: false,
        issues: [
          `Too far from ${bestMatch} (L1:${min.toFixed(1)}>40). Diff: P=${dP}, Y=${dY}, R=${dR}`,
        ],
      };
    }
    return { valid: true, issues: [] };
  }

  private _determinePoseType(pose: Pose): PoseType {
    const targetPoses: Record<string, TargetPose> = {
      front: { p: 0, y: 0, r: 0 },
      left: { p: 0, y: -40, r: 0 }, // FaceSanity: Left is negative
      right: { p: 0, y: 40, r: 0 }, // FaceSanity: Right is positive
    };

    const getL1 = (target: TargetPose): number =>
      Math.abs(pose.pitch - target.p) +
      Math.abs(pose.yaw - target.y) / 2.0 +
      Math.abs(pose.roll - target.r);

    const scoreFront = getL1(targetPoses.front);
    const scoreLeft = getL1(targetPoses.left);
    const scoreRight = getL1(targetPoses.right);

    const minScore = Math.min(scoreFront, scoreLeft, scoreRight);

    if (minScore > 40) return 'Invalid';

    // 找出最佳匹配
    if (scoreFront <= scoreLeft && scoreFront <= scoreRight) return 'Front';
    if (scoreLeft < scoreFront && scoreLeft < scoreRight) return 'Left';
    return 'Right';
  }

  private async _loadImage(input: ImageInput): Promise<HTMLImageElement> {
    if (input instanceof HTMLImageElement) {
      if (!input.complete) {
        await new Promise<void>((resolve) => {
          input.onload = () => resolve();
        });
      }
      return input;
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      if (input instanceof File || input instanceof Blob)
        img.src = URL.createObjectURL(input);
      else if (typeof input === 'string') img.src = input;
      else reject(new Error('Invalid input type'));
    });
  }

  private _generateChunkId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
const faceSanityClient = new FaceSanityClient();
// faceSanityClient.loadModels();
// faceSanityClient.warmUp();
export { FaceSanityClient, faceSanityClient };
