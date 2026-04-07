// 错误码常量
export const ErrorCode = {
  NONE: 0,
  SENSITIVE: 90001,
  BUSINESS_LOGIC: 300001,
  INTERNAL_ERROR: 100001,
  INVALID_IMAGE: 100002,
  FILES_NUMBER_MISSMATCH: 100003,
  MALFORMED_REQUEST: 100004,
  FACE_NO_FACE_DETECTED: 201001,
  FACE_MULTIPLE_FACES_DETECTED: 201002,
  FACE_POSE_ERROR: 201003,
  FACE_BBOX_SIZE_ERROR: 201004,
  FACE_CLARITY_ERROR : 201005,
  FACE_GLASSES_DETECTED: 201006,
  FACE_LIGHTING_ERROR: 201007,
  FACE_ID_MISMATCH: 201008,
  FACE_NOT_SAME_PERSON: 201009,
  FACE_MISSING_FRONT_POSE: 201010,
  FACE_EXPOSURE_ZEBRA: 201011,
  FACE_OCCLUSION_DETECTED: 201012,
  EYE_CLOSED_DETECTED : 201013,
  FACE_MISSING_SIDE_POSE: 201014,
  FACE_EMBEDDING_MISSING : 201015,//  # skip - embedding 缺失/不可用（拒绝 dummy）
  FACE_BBOX_OUT_OF_BOUNDS : 201016,//  # skip - 人脸超出边界（拒绝 dummy）
};

// 错误码到错误信息的映射
export const errorMap = new Map<number, string>([
  [ErrorCode.NONE, '无错误'],
  [ErrorCode.SENSITIVE, '涉敏感内容'],
  [ErrorCode.BUSINESS_LOGIC, '人脸业务错误'],
  [ErrorCode.INTERNAL_ERROR, '内部错误'],
  [ErrorCode.INVALID_IMAGE, '图片不合法'],
  [ErrorCode.FILES_NUMBER_MISSMATCH, '图片数量不匹配'],
  [ErrorCode.MALFORMED_REQUEST, '请求错误'],
  [ErrorCode.FACE_NO_FACE_DETECTED, '未检测到人脸'],
  [ErrorCode.FACE_MULTIPLE_FACES_DETECTED, '检测到多张人脸'],
  [ErrorCode.FACE_POSE_ERROR, '角度错误'],
  [ErrorCode.FACE_BBOX_SIZE_ERROR, '人脸过小'],
  [ErrorCode.FACE_CLARITY_ERROR,'清晰度不足'],
  [ErrorCode.FACE_GLASSES_DETECTED, '检测到眼镜'],
  [ErrorCode.FACE_LIGHTING_ERROR, '光照过度'],
  [ErrorCode.FACE_ID_MISMATCH, '不是同一个人'],
  [ErrorCode.FACE_NOT_SAME_PERSON, '不是同一个人'],
  [ErrorCode.FACE_MISSING_FRONT_POSE, '缺少正面照'],
  [ErrorCode.FACE_EXPOSURE_ZEBRA, '斑马线含量高'],
  [ErrorCode.FACE_OCCLUSION_DETECTED, '检测到遮挡'],
  [ErrorCode. EYE_CLOSED_DETECTED, '不能闭眼'],
  [ErrorCode. FACE_MISSING_SIDE_POSE, '缺少侧面照'],
  [ErrorCode. FACE_EMBEDDING_MISSING, '算法出错'],
  [ErrorCode. FACE_BBOX_OUT_OF_BOUNDS, '人脸超出边界'],
]);

// 获取错误信息的辅助函数
export const getErrorMessage = (code: number): string => {
  return errorMap.get(code) || '未知错误';
};
