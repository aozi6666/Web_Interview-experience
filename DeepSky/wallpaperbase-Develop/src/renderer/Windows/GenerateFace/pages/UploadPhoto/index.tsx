/* eslint-disable camelcase */
import {
  clearDownloadMark,
  generateCharacter,
  generateCharacterDynamic,
  generatePose,
  getBodyNameList,
  getChunkId,
  getImageCheckProgress,
  getMobileToken,
  getTaskProgress,
  getToken,
  markAsDownloaded,
  roleDelete,
  roleRename,
  sanityCheck,
  setFaceAppUrl,
  uploadImage,
} from '@api';
import {
  UEAppearanceChange_AppearBuildDynamic,
  UEAppearanceChange_AppearBuildStatic,
  UEAppearanceChange_AppearEditDynamic,
  UEAppearanceChange_AppearEditStatic,
  UEAppearanceChange_AppearShowDynamic,
  UESence_AppearShowBlank,
} from '@api/IPCRequest/selectUESence';
import { IPCChannels } from '@shared/channels';
import { logRenderer } from '@utils/logRenderer';
import { message, Typography } from 'antd';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { downloadWithValidation } from '../../../../utils/downloadWithValidation';
import { getErrorMessage } from '../../utils/errorMap';
import {
  sendRefreshTaskListMessage,
  sendResetWallpaperMessage,
} from '../../utils/sendMsgToMain';
import { notificationAPI, NotificationManager } from '../Tip';
import {
  BackButton,
  GenderSelector,
  ImageGrid,
  SampleImages,
} from './components';
import { useImageUpload } from './hooks';
import { useStyles } from './styles';
import {
  GenerateStep,
  ImageUpload as ImageUploadType,
  ModalState, // 保留用于 openModal 参数类型
  QrCodeState,
  UploadProgress,
} from './types';

// 示例图片
import arrow from '$assets/images/uploadPhoto/icon-chevron-right_state_nor.png';
import sample1 from '$assets/images/uploadPhoto/sample_1.png';
import sample2 from '$assets/images/uploadPhoto/sample_2.png';
import sample3 from '$assets/images/uploadPhoto/sample_3.png';
import sample4 from '$assets/images/uploadPhoto/sample_4.png';
import {
  FACE_APP_URL_EXTERNAL,
  FACE_APP_URL_INTERNAL,
} from '@shared/config';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { DEFAULT_APPEARANCE_DATA } from '../../../../pages/Character/constance';
import { blobToBase64, blobToFile, download } from '../../utils/beauty';
import { faceSanityClient } from '../../utils/faceSanity';
import { WsClient } from '../../utils/wsclient';

const ipcEvents = getIpcEvents();

const { Text } = Typography;

// 常量提取到组件外部
const MAX_IMAGES = 7;
const PROGRESS_INTERVAL_MS = 3000;

// Props 接口定义
interface UploadPhotoProps {
  progress: UploadProgress;
  updateProgress: (updates: Partial<UploadProgress>) => void;
  qrcode: QrCodeState;
  openModal: (modal: keyof ModalState) => void;
  closeModal: (modal: keyof ModalState) => void;
  setLoadingMessage: (message: string) => void;
}

// 暴露给父组件的方法接口
export interface UploadPhotoRef {
  handleBack: () => Promise<void>;
  handleGenerateDynamic: () => Promise<void>;
  handleRetry: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleDressUp: () => Promise<void>;
  restoreTaskState: (data: any) => void;
}

// 工具函数提取到组件外部
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error(`读取文件 "${file.name}" 失败`));
    reader.readAsDataURL(file);
  });
};

const downloadImage = async (
  url: string,
  poseType: string,
): Promise<ImageUploadType> => {
  const blob = await download(url);
  const finalCompressed = await blobToBase64(blob);
  return {
    id: `${Date.now()}-${Math.random()}`,
    base64: finalCompressed,
    url,
    isChecking: false,
    progress: 0,
    isChecked: true,
    poseType,
    // rank: 0,
  };
};

const UploadPhoto = forwardRef<UploadPhotoRef, UploadPhotoProps>(
  (
    {
      progress,
      updateProgress,
      qrcode,
      openModal,
      closeModal,
      setLoadingMessage,
    },
    ref,
  ) => {
    const { styles } = useStyles();

    // Custom hooks
    const {
      images,
      unacceptableImages,
      addUnacceptableImage,
      errors,
      addImage,
      removeImage,
      moveToUnacceptable,
      clearImages,
      updateImage,
      setImages,
      // setImageProgress,
    } = useImageUpload();

    // State
    // 默认固定走外网服务
    const [faceAppServerUrl, setFaceAppServerUrl] = useState(
      FACE_APP_URL_EXTERNAL,
    );
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [roleName, setRoleName] = useState<string>('');
    const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
    const [submitText, setSubmitText] = useState('开始生成');
    const [isCheckEnabled] = useState(true);
    const [, setGenerateMessage] =
      useState('请耐心等待，生成过程可能需要几分钟');
    const [, setIsGenerateComplete] = useState(false);
    const [currentModelId, setCurrentModelId] = useState<string>('');
    const [bodyType, setBodyType] = useState<string>('joker');
    const [maleOptions, setMaleOptions] = useState<
      { label: string; value: string }[]
    >([]);
    const [femaleOptions, setFemaleOptions] = useState<
      { label: string; value: string }[]
    >([]);

    // Refs
    const wsClient = useRef<WsClient | null>(null);
    const pcToken = useRef<string>('');
    const mobileToken = useRef<string>('');
    const uploadFromMobile = useRef<number>(0);
    // 用于记录开始生成的埋点数据
    const generateAnalyticsRef = useRef<{
      chunkId: number;
      gender: string;
      startTime: string;
      bodyType?: string; // 体型样式
      imageCount?: number; // 照片数量
    } | null>(null);
    // 用于记录静态预览下一步按钮的埋点数据
    const staticPreviewNextAnalyticsRef = useRef<{
      chunkId: number;
      gender: string;
      startTime: string;
    } | null>(null);
    interface imgInfo {
      id: string;
      url: string;
      poseType: string;
      rank: number;
    }
    const prevImagesLength = useRef(0);
    const chunkId = useRef<number>(523828);
    const taskId = useRef<string>('');
    const missingPose = useRef<string>('');
    const imageExtra = useRef<Record<string, imgInfo>>({});
    // const selectedUrls = useRef<Record<string, string>>({});
    const isProgressActive = useRef<boolean>(false);
    const progressRef = useRef({ progress: 0, step: GenerateStep.IDLE });
    const notificationManagerRef = useRef<any>(null);
    const staticCompletedRef = useRef<boolean>(false);
    const dynamicCompletedRef = useRef<boolean>(false);
    // 用于确保下载只执行一次
    const staticDownloadCompletedRef = useRef<boolean>(false);
    const dynamicDownloadCompletedRef = useRef<boolean>(false);
    // 用于跟踪等待 pendingDownload 的次数（防止无限等待）
    const staticWaitForDownloadCount = useRef<number>(0);
    const dynamicWaitForDownloadCount = useRef<number>(0);
    const MAX_WAIT_FOR_DOWNLOAD = 5; // 最多等待5次轮询（15秒）
    // 用于 interval 内部访问最新值，避免依赖频繁变化
    const imagesRef = useRef(images);
    const genderRef = useRef(gender);
    const roleNameRef = useRef(roleName);
    // 用于存储稳定的函数引用
    const updateImageRef = useRef(updateImage);
    const updateProgressRef = useRef(updateProgress);
    const checkedTaskList = useRef<string[]>([]);
    // Sample data - 使用 useMemo 避免每次渲染创建新数组
    const sampleImages = useMemo(
      () => [
        { src: sample1, title: '单人正面', isGood: true },
        { src: sample2, title: '右侧面部', isGood: true },
        { src: sample3, title: '左侧面部', isGood: false },
        { src: sample4, title: '摘掉眼镜', isGood: false },
      ],
      [],
    );
    const addImageExtra = (
      url: string,
      id: string,
      poseType: string,
      rank: number,
    ) => {
      imageExtra.current[url] = {
        id,
        poseType,
        url,
        rank,
      };
    };
    const checkPoseType = (_images: ImageUploadType[]) => {
      let frontUrl = '';
      let rankMax = 99;
      let hasFront = false;
      let hasLeft = false;
      let hasRight = false;
      _images.forEach((item) => {
        if (item.url && item.url in imageExtra.current) {
          const { poseType } = imageExtra.current[item.url];
          const { rank } = imageExtra.current[item.url];
          // console.log('-----', poseType,rank);
          if (poseType === 'front' && rank < rankMax) {
            frontUrl = item.url;
            rankMax = rank;
            hasFront = true;
          } else if (poseType === 'left') {
            hasLeft = true;
          } else if (poseType === 'right') {
            hasRight = true;
          }
        }
      });
      if (!hasLeft && !hasRight) {
        missingPose.current = 'both';
      } else if (!hasLeft) {
        missingPose.current = 'left';
      } else if (!hasRight) {
        missingPose.current = 'right';
      }
      if (hasLeft && hasRight) {
        missingPose.current = '';
      }
      return {
        hasFront,
        frontUrl,
        hasLeft,
        hasRight,
      };
    };
    // 同步函数引用到 ref
    useEffect(() => {
      updateImageRef.current = updateImage;
    }, [updateImage]);

    useEffect(() => {
      updateProgressRef.current = updateProgress;
    }, [updateProgress]);

    // 同步 progress/images/gender 到 ref
    useEffect(() => {
      progressRef.current = {
        progress: progress.progress,
        step: progress.step,
      };
    }, [progress.progress, progress.step]);

    useEffect(() => {
      imagesRef.current = images;
    }, [images]);

    useEffect(() => {
      genderRef.current = gender;
    }, [gender]);

    useEffect(() => {
      roleNameRef.current = roleName;
    }, [roleName]);

    // const handleModelPublishConfirm = useCallback(async () => {
    //   try {
    //     const res = await api.modelPublishConfirm({
    //       chunk_id: chunkId.current,
    //     });

    //     const { code, data } = res;
    //     console.log('模型动态生成结束后，确认模型发布结果', res);

    //     if (code === 0) {
    //       console.log('模型动态生成结束后，确认模型发布成功');
    //       setCurrentModelId(data.model_id || '');
    //     } else {
    //       console.log('模型动态生成结束后，确认模型发布失败', res.error);
    //     }
    //   } catch (error) {
    //     console.log('模型动态生成结束后，确认模型发布失败', error);
    //   }
    // }, []);

    const sanityCheckResult = useCallback(
      (result: any) => {
        console.log('--------------------sanityCheckResult');
        const currentImages = imagesRef.current;
        const urls = currentImages.map((img) => img.url!).filter(Boolean);
        if (!result || !result.errors) {
          return;
        }
        if (result.errors?.skip_errors) {
          result.errors.skip_errors.forEach((error: any) => {
            if (error.filename) {
              const imageIndex = currentImages.findIndex((img) =>
                img.url?.includes(error.filename),
              );
              if (imageIndex !== -1) {
                moveToUnacceptable(
                  currentImages[imageIndex],
                  getErrorMessage(error.error_code),
                );
              }
            }
          });
        }
        if (result.errors?.warning_errors) {
          result.errors.warning_errors.forEach((error: any) => {
            if (error.filename) {
              const imageIndex = currentImages.findIndex((img) =>
                img.url?.includes(error.filename),
              );
              if (imageIndex !== -1) {
                moveToUnacceptable(
                  currentImages[imageIndex],
                  getErrorMessage(error.error_code),
                );
              }
            }
          });
        }
        if (result.errors?.fatal_errors) {
          if (Array.isArray(result.errors.fatal_errors)) {
            if (result.errors.fatal_errors.length > 0) {
              const code = result.errors.fatal_errors[0].error_code;
              notificationAPI.error(getErrorMessage(code));
              if (code === 201014 || code === 201009) {
                if (
                  result.errors.fatal_errors[0].skipped_images &&
                  Array.isArray(result.errors.fatal_errors[0].skipped_images)
                ) {
                  result.errors.fatal_errors[0].skipped_images.forEach(
                    (image: any) => {
                      const imageIndex = currentImages.findIndex((img) =>
                        img.url?.includes(image.filename),
                      );
                      moveToUnacceptable(
                        currentImages[imageIndex],
                        getErrorMessage(201009),
                      );
                    },
                  );
                }
                // const [first, ...restToMove] = currentImages;
                // restToMove.forEach((image) => {
                //   moveToUnacceptable(image, getErrorMessage(code));
                // });
              }
            }
          }
        }
        // if (result.reference_image) {
        //   const { filename: referenceFilename } = result.reference_image;
        //   const referenceUrl = urls.find((url) =>
        //     url.includes(referenceFilename),
        //   );
        //   if (referenceUrl) {
        //     selectedUrls.current.front = referenceUrl;
        //   }
        // }

        if (result.imglist && Array.isArray(result.imglist)) {
          result.imglist.forEach((imageInfo: any) => {
            const matchedUrl = urls.find((url) =>
              url.includes(imageInfo.filename),
            );
            if (matchedUrl) {
              currentImages.forEach((img) => {
                if (img.url === matchedUrl) {
                  updateImage(img.id, {
                    poseType: imageInfo.pose_category,
                  });
                  if (matchedUrl in imageExtra.current) {
                    imageExtra.current[matchedUrl].poseType =
                      imageInfo.pose_category;
                    imageExtra.current[matchedUrl].rank = imageInfo.rank;
                  }
                  console.log(
                    img.id,
                    img.url,
                    imageInfo.pose_category,
                    imageInfo.rank,
                  );
                }
              });
            }
          });
        }
      },
      [moveToUnacceptable],
    );

    const handleSanityCheck = useCallback(
      async (imageInfos?: ImageUploadType[]) => {
        try {
          const imageData = imageInfos || imagesRef.current;
          const urls = imageData.map((img) => img.url!).filter(Boolean);

          const result = await sanityCheck({
            image_urls: urls,
            chunk_id: chunkId.current,
          });

          imageData.forEach((img) => {
            if (!img.isChecked && !img.taskId) {
              img.taskId = result.task_id;
              updateImage(img.id, {
                isChecking: true,
                progress: 1,
                taskId: result.task_id,
              });
              // setImageProgress(img.id, 1);
            }
          });
        } catch (error: any) {
          console.log('handleSanityCheck error', error);
        }
      },
      [updateImage],
    );

    const handleFileSelect = useCallback(async () => {
      analytics
        .track(AnalyticsEvent.CREATE_PHOTO_UPLOAD_ADD_CLICK, {})
        .catch(() => {});
      // 记录开始时间（点击添加按钮时）
      const startTime = new Date().toISOString();
      console.log('handleFileSelect', startTime);
      try {
        if (!checkChuckId()) {
          return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;

        input.onchange = async (e) => {
          const { files } = e.target as HTMLInputElement;
          if (!files) return;

          // 计算文件总大小和类型信息
          let totalFileSize = 0;
          const fileTypes: string[] = [];
          Array.from(files).forEach((file) => {
            totalFileSize += file.size;
            const fileType = file.type || 'unknown';
            if (!fileTypes.includes(fileType)) {
              fileTypes.push(fileType);
            }
          });

          try {
            updateProgress({ isLoading: true, progress: 0, delay: 3 });
            setLoadingMessage('正在上传照片，请稍候');
            console.log('正在上传照片，请稍候------');
            const fileArray = Array.from(files);
            const newUploadedImages: ImageUploadType[] = [];
            let uploadedCount = 0;
            const currentImages = imagesRef.current;

            // updateProgress({ progress: Math.floor(Math.random() * 33 + 1) });

            await fileArray.reduce(async (previousPromise, file) => {
              await previousPromise;

              if (
                currentImages.length + newUploadedImages.length >=
                MAX_IMAGES
              ) {
                notificationAPI.warning(`最多上传${MAX_IMAGES}张照片`);
                return;
              }

              try {
                const base64 = await fileToBase64(file);
                // updateProgress({
                //   progress: Math.floor(Math.random() * 33 + 1),
                // });

                const imageUploadData: ImageUploadType = {
                  id: `${Date.now()}-${Math.random()}`,
                  base64,
                  url: '',
                  isChecking: true,
                  progress: 0,
                  isChecked: false,
                  // rank:0,
                };
                const result = await faceSanityClient.detectSingleFace(file);
                // console.log('result------', result);
                if (!result.success) {
                  addUnacceptableImage(
                    imageUploadData,
                    faceSanityClient.getErrorMsg(result.code),
                  );
                  notificationAPI.warning('已过滤不可用照片');
                  return;
                }

                // imageUploadData.poseType = result.face_data.pose_type;
                const url: string = await uploadImage(file, chunkId.current);
                imageUploadData.url = url;
                addImageExtra(url, imageUploadData.id, '', 0);
                // addImage(imageUploadData);
                newUploadedImages.push(imageUploadData);
                uploadedCount += 1;
                updateProgress({
                  progress: Math.floor(
                    (uploadedCount * 100) / fileArray.length,
                  ),
                });
              } catch {
                message.error(`上传 ${file.name} 失败`);
              }
            }, Promise.resolve());
            // console.log('newUploadedImages', newUploadedImages.length);
            if (newUploadedImages.length > 0) {
              setImages([...currentImages, ...newUploadedImages]);
              const skipSanityCheck =
                faceAppServerUrl === FACE_APP_URL_INTERNAL;
              if (isCheckEnabled && !skipSanityCheck) {
                setLoadingMessage('正在检查照片，请稍候');
                const allImages = [...currentImages, ...newUploadedImages];
                await handleSanityCheck(allImages);
                updateProgress({ step: GenerateStep.IMAGE_CHECKING });
              } else {
                // 内网无服务端姿态检测：首张新图视为正面，满足提交流程校验
                const firstNew = newUploadedImages[0];
                if (firstNew?.url) {
                  imageExtra.current[firstNew.url] = {
                    id: firstNew.id,
                    poseType: 'front',
                    url: firstNew.url,
                    rank: 0,
                  };
                }
                setIsSubmitEnabled(true);
              }

              // 发送PC端上传照片埋点（上传完成后）
              const visitorId = getVisitorId();
              analytics
                .track(AnalyticsEvent.PHOTO_UPLOAD_PC, {
                  photo_count: newUploadedImages.length,
                  file_size: totalFileSize, // 总文件大小（字节）
                  file_size_mb:
                    Math.round((totalFileSize / 1024 / 1024) * 100) / 100, // 转换为MB，保留两位小数
                  file_type: fileTypes.join(','), // 文件类型列表
                  visitor_id: visitorId || 'unknown',
                })
                .catch((err) => {
                  // eslint-disable-next-line no-console
                  console.error('PC端上传照片埋点失败:', err);
                });
            }
          } catch {
            message.error('上传或检查照片失败');
          } finally {
            updateProgress({ isLoading: false });
          }
        };

        input.click();
      } catch {
        message.error('选择文件失败');
      }
    }, [
      addImage,
      updateProgress,
      handleSanityCheck,
      isCheckEnabled,
      addUnacceptableImage,
      setLoadingMessage,
      faceAppServerUrl,
    ]);

    const handleGenerate = useCallback(async () => {
      try {
        const checkResult = checkPoseType(imagesRef.current);

        if (!checkResult.hasFront) {
          message.error('没有找到正面照');
          setIsSubmitEnabled(false);
          return;
        }

        const skipAutoComplete = faceAppServerUrl === FACE_APP_URL_INTERNAL;

        if (missingPose.current !== '' && !skipAutoComplete) {
          // 记录自动补全的开始时间
          const startTime = new Date().toISOString();
          const missingPoseType = missingPose.current; // 'both' | 'left' | 'right'

          updateProgress({ isLoading: true, progress: 0, delay: 8 });
          setLoadingMessage('正在生成缺失角度的照片，请稍候');

          try {
            const imgs = await generatePose(
              chunkId.current,
              missingPose.current,
              checkResult.frontUrl,
            );

            const [firstImg, secondImg] = imgs;
            if (missingPose.current.includes('left')) {
              // selectedUrls.current.left = firstImg;
              const image = await downloadImage(firstImg, 'left');

              addImageExtra(firstImg, image.id, 'left', 0);
              addImage(image);
            } else if (missingPose.current.includes('right')) {
              // selectedUrls.current.right = firstImg;
              const image = await downloadImage(firstImg, 'right');
              addImageExtra(firstImg, image.id, 'right', 0);
              addImage(image);
            } else {
              // selectedUrls.current.left = firstImg;
              const image = await downloadImage(firstImg, 'left');
              addImageExtra(firstImg, image.id, 'left', 0);
              // addImage(image);
              // selectedUrls.current.right = secondImg;
              const image2 = await downloadImage(secondImg, 'right');
              addImageExtra(secondImg, image2.id, 'right', 0);
              // addImage(image2);
              setImages((prev) => [...prev, image, image2]);
            }
            // console.log('✅ 姿态生成完成:', selectedUrls.current);

            // 记录自动补全的结束时间
            const endTime = new Date().toISOString();

            // 发送自动补全埋点
            const visitorId = getVisitorId();
            const eventData = {
              missing_pose: missingPoseType,
              visitor_id: visitorId || 'unknown',
            };

            // eslint-disable-next-line no-console
            console.log('📊 [UploadPhoto] 准备发送 auto_complete_photo 埋点:', {
              event: AnalyticsEvent.AUTO_COMPLETE_PHOTO,
              data: eventData,
            });

            analytics
              .track(AnalyticsEvent.AUTO_COMPLETE_PHOTO, eventData)
              .then((success) => {
                if (success) {
                  // eslint-disable-next-line no-console
                  console.log(
                    '✅ [UploadPhoto] auto_complete_photo 埋点发送成功',
                  );
                  logRenderer
                    .info(
                      '[UploadPhoto] auto_complete_photo 埋点发送成功',
                      eventData,
                    )
                    .catch(() => {});
                } else {
                  // eslint-disable-next-line no-console
                  console.warn(
                    '⚠️ [UploadPhoto] auto_complete_photo 埋点发送返回失败',
                  );
                  logRenderer
                    .warn(
                      '[UploadPhoto] auto_complete_photo 埋点发送返回失败',
                      eventData,
                    )
                    .catch(() => {});
                }
                return success;
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error(
                  '❌ [UploadPhoto] auto_complete_photo 埋点发送失败:',
                  err,
                );
                logRenderer
                  .error('[UploadPhoto] auto_complete_photo 埋点发送失败', {
                    error: err,
                    data: eventData,
                  })
                  .catch(() => {});
              });
          } catch (error) {
            console.error('❌ 姿态生成失败:', error);
            // updateProgress({ isLoading: false });
            updateProgress({ progress: 100, isLoading: false });
            message.error('生成缺失角度的照片失败，请重试');

            // 即使失败也记录埋点
            const endTime = new Date().toISOString();
            const visitorId = getVisitorId();
            const eventData = {
              missing_pose: missingPoseType,
              success: false,
              visitor_id: visitorId || 'unknown',
            };

            // eslint-disable-next-line no-console
            console.log(
              '📊 [UploadPhoto] 准备发送 auto_complete_photo 埋点(失败):',
              {
                event: AnalyticsEvent.AUTO_COMPLETE_PHOTO,
                data: eventData,
              },
            );

            analytics
              .track(AnalyticsEvent.AUTO_COMPLETE_PHOTO, eventData)
              .then((success) => {
                if (success) {
                  // eslint-disable-next-line no-console
                  console.log(
                    '✅ [UploadPhoto] auto_complete_photo 埋点发送成功(失败)',
                  );
                  logRenderer
                    .info(
                      '[UploadPhoto] auto_complete_photo 埋点发送成功(失败)',
                      eventData,
                    )
                    .catch(() => {});
                } else {
                  // eslint-disable-next-line no-console
                  console.warn(
                    '⚠️ [UploadPhoto] auto_complete_photo 埋点发送返回失败(失败)',
                  );
                  logRenderer
                    .warn(
                      '[UploadPhoto] auto_complete_photo 埋点发送返回失败(失败)',
                      eventData,
                    )
                    .catch(() => {});
                }
                return success;
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error(
                  '❌ [UploadPhoto] auto_complete_photo 埋点发送失败(失败):',
                  err,
                );
                logRenderer
                  .error(
                    '[UploadPhoto] auto_complete_photo 埋点发送失败(失败)',
                    {
                      error: err,
                      data: eventData,
                    },
                  )
                  .catch(() => {});
              });

            return;
          }

          // updateProgress({ isLoading: false });
          updateProgress({ progress: 100, isLoading: false });
        } else {
          // 记录开始生成的时间
          const startTime = new Date().toISOString();
          const currentChunkId = chunkId.current;
          const currentGender = genderRef.current;
          const currentBodyType = bodyType; // 获取当前选择的体型样式

          // 保存埋点数据到 ref，以便在完成时使用
          generateAnalyticsRef.current = {
            chunkId: currentChunkId,
            gender: currentGender,
            startTime,
            bodyType: currentBodyType, // 保存体型样式
            imageCount: images.length, // 保存照片数量
          };

          staticCompletedRef.current = false;
          updateProgress({
            isGenerating: true,
            step: GenerateStep.STATIC_GENERATING,
            progress: 0,
          });
          setGenerateMessage('请耐心等待，生成过程可能需要几分钟');
          setIsGenerateComplete(false);

          // const order = ['front', 'left', 'right'];
          const list = images.map((item) => {
            // 提取字段，可选：添加默认值避免 undefined
            return {
              image_url: item.url || '', // 无值时默认空字符串
              image_type: '',
            };
          });

          console.log(list);
          const generateRequest = {
            chunk_id: currentChunkId,
            gender: currentGender,
            images: list,
          };

          // await generateHair(generateRequest);
          const result = await generateCharacter(generateRequest);
          console.log('result', result);
          if (result.code !== 0) {
            message.error(`生成失败:${getErrorMessage(result.code)}`);
            updateProgress({ isGenerating: false, isLoading: false });
          } else {
            taskId.current = result.data.task_id;
            isProgressActive.current = true;

            // 重命名角色（如果用户输入了名称）
            if (roleNameRef.current && roleNameRef.current.trim()) {
              roleRename(currentChunkId, roleNameRef.current.trim()).catch(
                (error) => {
                  console.error('⚠️ 角色重命名失败:', error);
                },
              );
            }

            UEAppearanceChange_AppearBuildStatic(currentChunkId, currentGender);
          }
        }
      } catch (error) {
        console.error('❌ 生成失败:', error);
        updateProgress({ isGenerating: false, isLoading: false });
        setGenerateMessage('请耐心等待，生成过程可能需要几分钟');
        message.error('开始生成失败');

        // 即使失败也记录埋点
        if (generateAnalyticsRef.current) {
          const endTime = new Date().toISOString();
          const analyticsData = generateAnalyticsRef.current;
          const visitorId = getVisitorId();
          analytics
            .track(AnalyticsEvent.CHARACTER_GENERATE, {
              chunk_id: analyticsData.chunkId,
              gender: analyticsData.gender,
              style: analyticsData.bodyType || 'unknown', // 体型样式
              options: {
                image_count: analyticsData.imageCount || 0,
                body_type: analyticsData.bodyType || 'unknown',
              },
              success: false,
              visitor_id: visitorId || 'unknown',
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('开始生成失败埋点失败:', err);
            });
          // 清空 ref
          generateAnalyticsRef.current = null;
        }
      }
    }, [updateProgress, addImage, setLoadingMessage, images, faceAppServerUrl]);

    const retry = useCallback(async () => {
      try {
        updateProgress({ isLoading: true, delay: 3 });
        setLoadingMessage('正在重置，请稍候');

        isProgressActive.current = false;
        await roleDelete(chunkId.current);

        const id = await getChunkId();
        chunkId.current = id;
        clearImages();

        // 重置所有 refs
        taskId.current = '';
        missingPose.current = '';
        // selectedUrls.current = {};
        progressRef.current = { progress: 0, step: GenerateStep.IDLE };
        staticCompletedRef.current = false;
        dynamicCompletedRef.current = false;
        staticDownloadCompletedRef.current = false;
        dynamicDownloadCompletedRef.current = false;
        staticWaitForDownloadCount.current = 0;
        dynamicWaitForDownloadCount.current = 0;

        clearDownloadMark(chunkId.current);

        updateProgress({
          isGenerating: false,
          step: GenerateStep.IDLE,
          progress: 0,
        });
        setGenerateMessage('请耐心等待，生成过程可能需要几分钟');
        setIsGenerateComplete(false);

        UESence_AppearShowBlank();
        console.log('✅ 重置完成，页面已恢复到初始状态');
      } catch (error) {
        console.error('❌ 重置失败:', error);
        message.error('重置失败，请重试');
      } finally {
        updateProgress({ isLoading: false });
      }
    }, [clearImages, updateProgress, setLoadingMessage]);

    // 显示窗口的辅助函数
    const showWindows = useCallback(async () => {
      try {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_MAIN_WINDOW);
        logRenderer.info('显示主窗口', {
          type: 'showMainWindow',
        });
        console.log('✅ 主窗口已显示');
      } catch (e) {
        console.warn('⚠️ 显示主窗口失败:', e);
      }
      try {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_LIVE_WINDOW);
        logRenderer.info('显示Live窗口', {
          type: 'showLiveWindow',
        });
        console.log('✅ Live窗口已显示');
      } catch (e) {
        console.warn('⚠️ 显示Live窗口失败:', e);
      }
    }, []);

    const handleBack = useCallback(async () => {
      try {
        const hasEnteredGenerateFlow =
          progressRef.current.step === GenerateStep.STATIC_GENERATING ||
          progressRef.current.step === GenerateStep.STATIC_COMPLETED ||
          progressRef.current.step === GenerateStep.DYNAMIC_GENERATING ||
          progressRef.current.step === GenerateStep.DYNAMIC_COMPLETED;

        // 判断是否在静态预览阶段
        const isStaticPreviewPhase =
          progressRef.current.step === GenerateStep.STATIC_GENERATING ||
          progressRef.current.step === GenerateStep.STATIC_COMPLETED;

        // 判断是否在动态预览阶段
        const isDynamicPreviewPhase =
          progressRef.current.step === GenerateStep.DYNAMIC_GENERATING ||
          progressRef.current.step === GenerateStep.DYNAMIC_COMPLETED;

        // 如果在静态预览阶段，记录关闭埋点
        if (isStaticPreviewPhase) {
          const closeTime = new Date().toISOString();
          const currentChunkId = chunkId.current;
          const currentGender = genderRef.current;

          // 发送静态预览关闭埋点
          const visitorId = getVisitorId();
          analytics
            .track(AnalyticsEvent.STATIC_PREVIEW_CLOSE, {
              chunk_id: currentChunkId,
              gender: currentGender,
              close_time: closeTime,
              visitor_id: visitorId || 'unknown',
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('静态预览关闭埋点失败:', err);
            });
        }

        // 如果在动态预览阶段，记录关闭埋点
        if (isDynamicPreviewPhase) {
          const closeTime = new Date().toISOString();
          const currentChunkId = chunkId.current;
          const currentGender = genderRef.current;

          // 发送动态预览关闭埋点
          const visitorId = getVisitorId();
          analytics
            .track(AnalyticsEvent.DYNAMIC_PREVIEW_CLOSE, {
              chunk_id: currentChunkId,
              gender: currentGender,
              close_time: closeTime,
              visitor_id: visitorId || 'unknown',
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('动态预览关闭埋点失败:', err);
            });
        }

        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.DESKTOP_EMBEDDER_RE_EMBED,
          'wallpaper-baby',
        );
        logRenderer.info('重新嵌入壁纸窗口', {
          type: 'desktopEmbederReEmbed',
          data: 'wallpaper-baby',
        });

        console.log('ℹ️ 返回流程统一交由主窗口 resetWallpaper 恢复场景');

        await sendRefreshTaskListMessage();
        await sendResetWallpaperMessage();
        await showWindows();

        setTimeout(() => window.close(), 500);
      } catch (error) {
        console.error('❌ 发送消息失败，但仍然关闭窗口:', error);
        await showWindows();
        window.close();
      }
    }, [bodyType, showWindows]);

    const handleConfirm = useCallback(async () => {
      // 记录动态预览确定按钮的点击时间、chunk_id 和性别
      const confirmTime = new Date().toISOString();
      const currentChunkId = chunkId.current;
      const currentGender = genderRef.current;

      // 发送动态预览确定埋点
      const visitorId = getVisitorId();
      analytics
        .track(AnalyticsEvent.DYNAMIC_PREVIEW_CONFIRM, {
          chunk_id: currentChunkId,
          gender: currentGender,
          confirm_time: confirmTime,
          visitor_id: visitorId || 'unknown',
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('动态预览确定埋点失败:', err);
        });

      try {
        await sendResetWallpaperMessage();
        console.log('✅ 重置壁纸消息发送完成');

        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.DESKTOP_EMBEDDER_RE_EMBED,
          'wallpaper-baby',
        );
        logRenderer.info('重新嵌入壁纸窗口', {
          type: 'desktopEmbederReEmbed',
          data: 'wallpaper-baby',
        });

        await showWindows();
        setTimeout(() => window.close(), 100);
      } catch (error) {
        console.error('❌ 发送消息失败，但仍然关闭窗口:', error);
        await showWindows();
        window.close();
      }
    }, [showWindows]);

    const handleDressUp = useCallback(async () => {
      // 记录动态预览装扮按钮的点击时间、chunk_id 和性别
      const dressUpTime = new Date().toISOString();
      const currentChunkId = chunkId.current;
      const currentGender = genderRef.current;

      // 发送动态预览装扮埋点
      const visitorId = getVisitorId();
      analytics
        .track(AnalyticsEvent.DYNAMIC_PREVIEW_DRESS_UP, {
          chunk_id: currentChunkId,
          gender: currentGender,
          dress_up_time: dressUpTime,
          visitor_id: visitorId || 'unknown',
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('动态预览装扮埋点失败:', err);
        });
      try {
        console.log('chunkId', chunkId.current);
        console.log('gender', genderRef.current);
        console.log('currentModelId', currentModelId);
        console.log('images', images);
        await UEAppearanceChange_AppearEditDynamic({
          chunkId: chunkId.current,
          gender: genderRef.current,
          appearanceData: DEFAULT_APPEARANCE_DATA,
          modelId: currentModelId || '',
          originalImages: images.map((image) => ({
            image_type: image.poseType?.toLowerCase() || '',
            url: image.url || '',
          })),
        });

        try {
          await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.BGM_PAUSE, {
            reason: 'appearance',
          });
        } catch (pauseError) {
          console.warn('⚠️ 请求暂停背景音乐失败，继续装扮流程:', pauseError);
        }

        setTimeout(() => window.close(), 100);
      } catch (error) {
        console.error('❌ 装扮流程出错:', error);
        message.error('装扮流程失败');
      }
    }, [currentModelId]);

    const restoreTaskState = useCallback(
      (data: any) => {
        try {
          console.log('🔄 开始恢复任务状态到UploadPhoto', data);

          chunkId.current = data.chunkId;
          setGender(data.gender);
          if (data.staticTaskId) {
            taskId.current = data.staticTaskId;
          }
          if (data.bodyStyle) {
            setBodyType(data.bodyStyle);
          }

          updateProgress({
            step: GenerateStep.STATIC_COMPLETED,
            progress: 100,
            isGenerating: true,
            isLoading: false,
            waitCount: 0,
          });

          progressRef.current = {
            progress: 100,
            step: GenerateStep.STATIC_COMPLETED,
          };

          // if (data.previewImage) {
          //   selectedUrls.current.front = data.previewImage;
          // }

          setIsGenerateComplete(true);
          setGenerateMessage('静态模型已生成完成');
          console.log('✅ 任务状态恢复完成');
        } catch (error) {
          console.error('❌ 恢复任务状态失败:', error);
          message.error('恢复任务状态失败，请关闭窗口重试');
        }
      },
      [updateProgress],
    );

    const handleRetry = useCallback(async () => {
      // 记录重新生成的时间、chunk_id 和性别
      const retryTime = new Date().toISOString();
      const currentChunkId = chunkId.current;
      const currentGender = genderRef.current;

      // 发送重新生成埋点
      const visitorId = getVisitorId();
      analytics
        .track(AnalyticsEvent.STATIC_PREVIEW_RETRY, {
          chunk_id: currentChunkId,
          gender: currentGender,
          retry_time: retryTime,
          visitor_id: visitorId || 'unknown',
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('静态预览重新生成埋点失败:', err);
        });

      try {
        await retry();
      } catch {
        // 忽略错误
      }
    }, [retry]);

    const handleGenerateDynamic = useCallback(async () => {
      if (
        progress.step !== GenerateStep.STATIC_COMPLETED ||
        progress.progress !== 100
      ) {
        return;
      }

      // 记录静态预览下一步按钮的点击时间
      const startTime = new Date().toISOString();
      const currentChunkId = chunkId.current;
      const currentGender = genderRef.current;

      // 保存埋点数据到 ref，以便在完成时使用
      staticPreviewNextAnalyticsRef.current = {
        chunkId: currentChunkId,
        gender: currentGender,
        startTime,
      };

      try {
        dynamicCompletedRef.current = false;

        const generateRequest = {
          chunk_id: currentChunkId,
          // body_names:
          //   bodyType === 'male' ? ['joker'] : ['yujie', 'evehighheel'],
          body_names:
            gender === 'male'
              ? ['defaultmale', 'joker']
              : ['defaultfemale', 'yujie', 'evehighheel'],
          static_task_id: taskId.current,
          gender: currentGender,
        };
        await generateCharacterDynamic(generateRequest);

        // 🔧 方案2：延迟 1 秒后再启动轮询，给后端足够时间创建动态任务
        // 避免轮询请求比后端创建任务更快，导致获取到静态完成状态
        // eslint-disable-next-line no-console
        console.log(`⏳ [UploadPhoto] 等待 1 秒后启动动态任务轮询...`);
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1000);
        });

        // 延迟后再更新状态并激活轮询（此时才会触发 useEffect 中的轮询逻辑）
        updateProgress({
          isGenerating: true,
          step: GenerateStep.DYNAMIC_GENERATING,
          progress: 0,
        });
        // ✅ 重新启动轮询，监控动态生成进度
        isProgressActive.current = true;

        // eslint-disable-next-line no-console
        console.log(`✅ [UploadPhoto] 已启动动态任务状态，重新开始轮询`);

        UEAppearanceChange_AppearBuildDynamic(currentChunkId, currentGender);
      } catch {
        message.error('开始生成动态模型失败');

        // 即使失败也记录埋点
        const endTime = new Date().toISOString();
        if (staticPreviewNextAnalyticsRef.current) {
          const analyticsData = staticPreviewNextAnalyticsRef.current;
          const visitorId = getVisitorId();
          analytics
            .track(AnalyticsEvent.STATIC_PREVIEW_NEXT, {
              chunk_id: analyticsData.chunkId,
              gender: analyticsData.gender,
              success: false,
              visitor_id: visitorId || 'unknown',
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('静态预览下一步失败埋点失败:', err);
            });
          // 清空 ref
          staticPreviewNextAnalyticsRef.current = null;
        }
      }
    }, [progress.step, progress.progress, updateProgress, bodyType]);

    const handleOpenDevTools = useCallback(() => {
      ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.OPEN_DEVTOOLS);
      logRenderer.info('打开开发者工具', {
        type: 'openDevTools',
      });
    }, []);

    const initBodyNameList = useCallback(async () => {
      const data = await getBodyNameList();
      const newMaleOptions = data.male.map((element) => ({
        label: element,
        value: element,
      }));
      setMaleOptions(newMaleOptions);

      const newFemaleOptions = data.female.map((element) => ({
        label: element,
        value: element,
      }));
      setFemaleOptions(newFemaleOptions);
    }, []);

    const handleMsg = useCallback(
      async (msg: any) => {
        if (msg.type === 'upload_complete') {
          const { files } = msg.content;
          const photoCount = files?.length || 0;

          updateProgress({ isLoading: true, progress: 0, delay: 3 });
          uploadFromMobile.current += 1;

          // 使用 Promise.all 处理文件上传，避免 for...of 循环
          const processFile = async (fileItem: {
            url: string;
            name: string;
          }) => {
            const { url, name } = fileItem;
            const blob = await download(url);
            const finalCompressed = await blobToBase64(blob);
            const processedImage: ImageUploadType = {
              id: `${Date.now()}-${Math.random()}`,
              base64: finalCompressed,
              from: 'phone' as const,
              url,
              // rank:0,
            };

            const file = blobToFile(blob, name);
            const result = await faceSanityClient.detectSingleFace(file);
            addImageExtra(url, processedImage.id, '', 0);
            if (!result.success) {
              addUnacceptableImage(
                processedImage,
                faceSanityClient.getErrorMsg(result.code),
              );
              return null;
            }

            // processedImage.poseType = result.face_data.pose_type;
            return processedImage;
          };
          const newUploadedImages: ImageUploadType[] = [];
          // 顺序处理文件
          await files.reduce(
            async (
              prevPromise: Promise<void>,
              fileItem: { url: string; name: string },
            ) => {
              await prevPromise;
              const processedImage = await processFile(fileItem);
              if (processedImage) {
                // setImages((prevImages) => {
                //   const allImages = [...prevImages, processedImage];
                //   handleSanityCheck(allImages);
                //   return allImages;
                // });
                // updateProgress({ step: GenerateStep.IMAGE_CHECKING });
                newUploadedImages.push(processedImage);
              }
            },
            Promise.resolve(),
          );
          updateProgress({ progress: 100 });
          if (newUploadedImages.length > 0) {
            // setImages([...currentImages, ...newUploadedImages]);
            setImages((prev) => [...prev, ...newUploadedImages]);
            const skipSanityCheck = faceAppServerUrl === FACE_APP_URL_INTERNAL;
            if (!skipSanityCheck) {
              setLoadingMessage('正在检查照片，请稍候');
              const allImages = [...images, ...newUploadedImages];
              await handleSanityCheck(allImages);
              updateProgress({ step: GenerateStep.IMAGE_CHECKING });
            } else {
              const firstNew = newUploadedImages[0];
              if (firstNew?.url) {
                imageExtra.current[firstNew.url] = {
                  id: firstNew.id,
                  poseType: 'front',
                  url: firstNew.url,
                  rank: 0,
                };
              }
              setIsSubmitEnabled(true);
            }

            // 发送手机端上传照片埋点（处理完成后）
            const visitorId = getVisitorId();
            analytics
              .track(AnalyticsEvent.PHOTO_UPLOAD_PHONE, {
                photo_count: newUploadedImages.length,
                visitor_id: visitorId || 'unknown',
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error('手机端上传照片埋点失败:', err);
              });
          }

          uploadFromMobile.current -= 1;
          if (uploadFromMobile.current === 0) {
            updateProgress({ isLoading: false });
          }
        } else if (msg.type === 'qr_scanned') {
          closeModal('isQrcodeOpen');
        }
      },
      [
        addUnacceptableImage,
        closeModal,
        faceAppServerUrl,
        handleSanityCheck,
        images,
        setImages,
        setIsSubmitEnabled,
        setLoadingMessage,
        updateProgress,
      ],
    );

    const connectWs = useCallback(async () => {
      try {
        wsClient.current = new WsClient(pcToken.current);
        if (wsClient.current) {
          console.log('wsClient 已连接');
          wsClient.current.onMessage = handleMsg;
        }
      } catch (e) {
        console.log('获取token失败', e);
      }
    }, [handleMsg]);

    const getUploadToken = useCallback(async () => {
      mobileToken.current = await getMobileToken(pcToken.current);
      // qrcode.url = `http://10.15.101.111:30498/?token=${mobileToken.current}`;
      qrcode.url = `http://61.50.110.182:30498/?token=${mobileToken.current}`;
      // qrcode.url = `https://generatefaceweb.fancytech.online/?token=${mobileToken.current}`;
      console.log('二维码地址', qrcode.url);
    }, [qrcode]);

    const getPcToken = useCallback(async () => {
      pcToken.current = await getToken();
      await getUploadToken();
      await connectWs();
    }, [getUploadToken, connectWs]);

    const onOpenQrcode = useCallback(async () => {
      analytics
        .track(AnalyticsEvent.CREATE_PHOTO_UPLOAD_MOBILE_CLICK, {})
        .catch(() => {});
      if (!checkChuckId()) {
        return;
      }
      await getUploadToken();

      openModal('isQrcodeOpen');
    }, [getUploadToken, openModal]);

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        handleBack,
        handleGenerateDynamic,
        handleRetry,
        handleConfirm,
        handleDressUp,
        restoreTaskState,
      }),
      [
        handleBack,
        handleGenerateDynamic,
        handleRetry,
        handleConfirm,
        handleDressUp,
        restoreTaskState,
      ],
    );

    // 性别变化时更新体型选项
    useEffect(() => {
      const currentOptions = gender === 'male' ? maleOptions : femaleOptions;
      if (currentOptions.length > 0) {
        setBodyType(currentOptions[0].value);
      } else {
        setBodyType('');
      }
    }, [gender, maleOptions, femaleOptions]);

    // 检查状态变化时禁用提交按钮
    // useEffect(() => {
    //   if (progress.step === GenerateStep.IMAGE_CHECKING) {
    //     setIsSubmitEnabled(false);
    //   }
    // }, [progress.step]);

    // 图片变化时检查姿态
    useEffect(() => {
      // const hasFront = images.some((item) => item.poseType === 'front');
      // const hasLeft = images.some((item) => item.poseType === 'left');
      // const hasRight = images.some((item) => item.poseType === 'right');
      // imagesRef.current.map((item) => {
      //   console.log(item.id,item.url, item.poseType,item.rank);
      // });
      const checkResult = checkPoseType(images);
      if (images.length === 0) {
        missingPose.current = '';
        setIsSubmitEnabled(false);
        prevImagesLength.current = images.length;
        return;
      }
      if (!checkResult.hasFront) {
        setIsSubmitEnabled(false);
      }
      // else if (!hasLeft && !hasRight) {
      //   missingPose.current = 'both';
      // } else if (!hasLeft) {
      //   missingPose.current = 'left';
      // } else if (!hasRight) {
      //   missingPose.current = 'right';
      // } else {
      //   missingPose.current = '';
      // }
      const isInternalFaceApp = faceAppServerUrl === FACE_APP_URL_INTERNAL;
      setSubmitText(
        isInternalFaceApp || missingPose.current === ''
          ? '开始生成'
          : '自动补全',
      );
      if (images.length < prevImagesLength.current) {
        if (!checkResult.hasFront) {
          notificationAPI.error('缺少正面照');
        } else if (!checkResult.hasLeft && !checkResult.hasRight) {
          notificationAPI.error('缺少左右侧面照');
        } else if (!checkResult.hasLeft) {
          notificationAPI.error('缺少左侧面照');
        } else if (!checkResult.hasRight) {
          notificationAPI.error('缺少右侧面照');
        }
      }
      prevImagesLength.current = images.length;
    }, [images, faceAppServerUrl]);
    const checkChuckId = () => {
      if (chunkId.current === 0) {
        notificationAPI.error('当前网络差，请返回上级页面重试');
        return false;
      }
      return true;
    };
    // 初始化
    useEffect(() => {
      const initialize = async () => {
        try {
          chunkId.current = 0;
          // 暂时关闭内外网选择，初始化时统一使用外网
          setFaceAppUrl(FACE_APP_URL_EXTERNAL);
          setFaceAppServerUrl(FACE_APP_URL_EXTERNAL);
          // await initBodyNameList();
          const id = await getChunkId();
          chunkId.current = id;
          await getPcToken();
          console.log('已获取token');
          // await faceSanityClient.warmUp();
        } catch {
          message.error('初始化失败，请重试');
        }
      };
      initialize();
      ipcEvents.on(IpcTarget.ANY, 'deleteImage', (data) => {
        console.log('接收到消息:', data, typeof data);
        removeImage(data);
      });

      // updateProgress({isLoading: true,progress: 0,delay:3})
      // updateProgress({step: GenerateStep.STATIC_GENERATING,progress: 17,isGenerating: true,})
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 进度监控 - 使用 ref 访问最新值，避免依赖频繁变化
    useEffect(() => {
      const intervalId = setInterval(async () => {
        const currentStep = progressRef.current.step;
        const currentImages = imagesRef.current;
        const currentGender = genderRef.current;

        // 图片检测进度
        if (currentStep === GenerateStep.IMAGE_CHECKING) {
          try {
            const result = await getImageCheckProgress(
              chunkId.current,
              'sanitycheck',
            );
            if (result) {
              let allDone = true;
              let haveError = false;
              if (result.tasks.length === 0) {
                haveError = true;
                currentImages.forEach((image) => {
                  if (image.isChecking) {
                    updateImageRef.current(image.id, {
                      isChecking: false,
                      taskId: '',
                    });
                  }
                });
              }
              const tasks: string[] = [];
              result.tasks.forEach((item: any) => {
                console.log(
                  '---图片检测进度:',
                  item.task_id,
                  item.task_type,
                  item.status,
                  item.progress,
                );
                if (item.task_type === 'sanitycheck') {
                  // -1（失败），1（进行中），2（已完成），3（队列等待）
                  if (
                    item.status === '1' ||
                    item.status === '3' ||
                    item.status === '0'
                  ) {
                    allDone = false;
                  }
                  tasks.push(item.task_id);
                  currentImages.forEach((image) => {
                    if (image.taskId === item.task_id) {
                      if (Number(item.progress) > Number(image.progress)) {
                        updateImageRef.current(image.id, {
                          progress: Number(item.progress),
                        });
                      }
                      if (item.status === '2') {
                        updateImageRef.current(image.id, {
                          isChecking: false,
                          isChecked: true,
                        });
                      } else if (item.status === '-1' || item.status === '4') {
                        updateImageRef.current(image.id, {
                          isChecking: false,
                          taskId: '',
                        });
                        haveError = true;
                      }
                    }
                  });
                  if (haveError) {
                    notificationAPI.error('图片检测失败，请重试');
                  }
                  if (item.status === '2') {
                    console.log(item.task_id);
                    if (item.gender === 'male' || item.gender === 'female') {
                      setGender(item.gender);
                    }
                    if (!checkedTaskList.current.includes(item.task_id)) {
                      sanityCheckResult(item.result_urls.sanity_check_result);
                      checkedTaskList.current.push(item.task_id);
                    }
                  }
                }
              });

              if (allDone) {
                console.log('---所有图片检测完成');
                currentImages.forEach((image) => {
                  if (image.isChecking) {
                    // if (image.taskId && !tasks.includes(image.taskId)) {
                    updateImageRef.current(image.id, {
                      isChecking: false,
                      taskId: '',
                    });
                    // haveError = true;
                    // }
                  }
                });
                updateProgressRef.current({
                  step: GenerateStep.IMAGE_CHECKED,
                });
                // updateProgress({step: GenerateStep.IMAGE_CHECKED})
                // const hasFront = currentImages.some(
                //   (item) => item.poseType === 'front',
                // );
                const checkResult = checkPoseType(currentImages);
                if (checkResult.hasFront) {
                  setIsSubmitEnabled(true);
                }
              }
            }
          } catch (e) {
            console.error('获取图片检测进度失败:', e);
          }
        }

        // 生成任务进度
        if (isProgressActive.current) {
          // 在请求之前检查完成标志，防止并发请求导致重复处理
          if (
            (currentStep === GenerateStep.STATIC_GENERATING &&
              staticCompletedRef.current) ||
            (currentStep === GenerateStep.DYNAMIC_GENERATING &&
              dynamicCompletedRef.current)
          ) {
            return; // 已经处理过完成状态，直接返回
          }

          try {
            const task = await getTaskProgress(chunkId.current);
            const progressValue = task.progress;
            const count = task.queueWaitCount;
            const taskStatus = task.status;

            // eslint-disable-next-line no-console
            console.log(`📊 [UploadPhoto] 任务 ${chunkId.current} 进度:`, {
              progress: progressValue,
              status: taskStatus,
              queueWaitCount: count,
              step: currentStep,
            });

            // ✅ 优先判断 status 字段（白名单校验）
            // 正常状态：'0'（排队/初始化）、'1'（生成中）、'2'（已完成）、'3'（排队中）
            // 其他所有状态（-1, 3, 4, 5 等）都视为失败
            const validStatuses = ['0', '1', '2', '3'];
            if (!validStatuses.includes(taskStatus)) {
              // eslint-disable-next-line no-console
              console.error(
                `❌ [UploadPhoto] 任务 ${chunkId.current} 状态异常: status=${taskStatus}`,
              );
              isProgressActive.current = false;
              staticCompletedRef.current = false;
              dynamicCompletedRef.current = false;

              // 根据当前步骤决定回退到哪个状态
              if (currentStep === GenerateStep.STATIC_GENERATING) {
                // 静态生成失败，回到图片检测完成状态
                updateProgressRef.current({
                  isGenerating: false,
                  step: GenerateStep.IMAGE_CHECKED,
                  progress: 0,
                });
                UESence_AppearShowBlank();
              } else if (currentStep === GenerateStep.DYNAMIC_GENERATING) {
                // 动态生成失败，回到静态生成完成状态
                updateProgressRef.current({
                  isGenerating: true,
                  step: GenerateStep.STATIC_COMPLETED,
                  progress: 100,
                });
                UEAppearanceChange_AppearEditStatic(
                  chunkId.current,
                  currentGender,
                );
              }
              console.log(task);
              notificationAPI.error('生成失败，请尝试重新生成');
              return;
            }

            // ✅ 判断 progress 错误码（作为补充）
            if (progressValue === -1) {
              // eslint-disable-next-line no-console
              console.error(
                `❌ [UploadPhoto] 任务 ${chunkId.current} 资源下载失败`,
              );
              isProgressActive.current = false;
              staticCompletedRef.current = false;
              dynamicCompletedRef.current = false;

              // 根据当前步骤决定回退到哪个状态
              if (currentStep === GenerateStep.STATIC_GENERATING) {
                updateProgressRef.current({
                  isGenerating: false,
                  step: GenerateStep.IMAGE_CHECKED,
                  progress: 0,
                });
                UESence_AppearShowBlank();
              } else if (currentStep === GenerateStep.DYNAMIC_GENERATING) {
                updateProgressRef.current({
                  isGenerating: true,
                  step: GenerateStep.STATIC_COMPLETED,
                  progress: 100,
                });
                UEAppearanceChange_AppearEditStatic(
                  chunkId.current,
                  currentGender,
                );
              }

              notificationAPI.error('资源下载失败，请检查网络后重试');
              return;
            }

            updateProgressRef.current({ waitCount: Number(count) || 0 });

            // 静态生成完成
            if (
              currentStep === GenerateStep.STATIC_GENERATING &&
              progressValue === 100 &&
              !staticCompletedRef.current
            ) {
              // ✅ 检查是否有待下载资源
              if (task.pendingDownload?.type === 'static') {
                // 情况1: 有 pendingDownload，执行下载
                if (!staticDownloadCompletedRef.current) {
                  // 立即设置完成标志，防止并发请求重复处理
                  staticCompletedRef.current = true;

                  console.log(
                    `📥 开始下载静态资源 (chunkId: ${chunkId.current})`,
                  );
                  const downloadResult = await downloadWithValidation({
                    chunkId: chunkId.current,
                    type: 'static',
                    url: task.pendingDownload.url,
                    maxRetries: 3,
                  });

                  if (!downloadResult.success) {
                    console.error('静态资源下载失败:', downloadResult.error);
                    staticCompletedRef.current = false; // 重置，允许重试
                    // ✅ 保持 isProgressActive.current = true，允许继续轮询重试
                    notificationAPI.error(
                      `静态资源下载失败: ${downloadResult.error}`,
                    );
                    return; // 继续轮询，不停止
                  }

                  console.log(
                    `✅ 静态资源下载并验证成功: ${downloadResult.path} (${downloadResult.size} bytes)`,
                  );
                  markAsDownloaded(chunkId.current, 'static');
                  staticDownloadCompletedRef.current = true;

                  // ✅ 下载成功，现在可以停止轮询
                  isProgressActive.current = false;
                  console.log('🛑 静态生成完成并下载成功，停止轮询');
                } else {
                  // 已经下载过了，直接停止轮询
                  staticCompletedRef.current = true;
                  isProgressActive.current = false;
                  console.log('🛑 静态资源已下载，停止轮询');
                }

                // 重置等待计数器
                staticWaitForDownloadCount.current = 0;

                // 更新UI状态
                updateProgressRef.current({
                  step: GenerateStep.STATIC_COMPLETED,
                  progress: 100,
                });
                UEAppearanceChange_AppearEditStatic(
                  chunkId.current,
                  currentGender,
                );
                console.log('✅ 静态生成完成');
              } else {
                // 情况2: progress=100 但 pendingDownload 为空
                // 可能是后端还没准备好下载URL，继续轮询等待
                staticWaitForDownloadCount.current += 1;

                console.warn(
                  `⏳ progress=100 但 pendingDownload 为空，继续轮询等待 (${staticWaitForDownloadCount.current}/${MAX_WAIT_FOR_DOWNLOAD})`,
                );

                if (
                  staticWaitForDownloadCount.current >= MAX_WAIT_FOR_DOWNLOAD
                ) {
                  // 等待超时，认为不需要下载（或后端异常）
                  console.error(
                    `❌ 等待 pendingDownload 超时（${MAX_WAIT_FOR_DOWNLOAD} 次轮询），停止等待`,
                  );
                  staticCompletedRef.current = true;
                  isProgressActive.current = false;

                  // 更新UI状态（允许用户继续操作）
                  updateProgressRef.current({
                    step: GenerateStep.STATIC_COMPLETED,
                    progress: 100,
                  });
                  UEAppearanceChange_AppearEditStatic(
                    chunkId.current,
                    currentGender,
                  );

                  notificationAPI.warning(
                    '静态资源下载信息获取超时，已跳过下载。如需下载，请重新生成。',
                  );
                } else {
                  // 继续轮询，不执行任何操作
                  // 不要更新UI，保持生成中状态
                }
              }
            }
            // 动态生成完成
            else if (
              currentStep === GenerateStep.DYNAMIC_GENERATING &&
              progressValue === 100 &&
              !dynamicCompletedRef.current
            ) {
              // ✅ 检查是否有待下载资源
              if (task.pendingDownload?.type === 'dynamic') {
                // 情况1: 有 pendingDownload，执行下载
                if (!dynamicDownloadCompletedRef.current) {
                  // 立即设置完成标志，防止并发请求重复处理
                  dynamicCompletedRef.current = true;

                  console.log(
                    `📥 开始下载动态资源 (chunkId: ${chunkId.current})`,
                  );
                  const downloadResult = await downloadWithValidation({
                    chunkId: chunkId.current,
                    type: 'dynamic',
                    url: task.pendingDownload.url,
                    maxRetries: 3,
                  });

                  if (!downloadResult.success) {
                    console.error('动态资源下载失败:', downloadResult.error);
                    dynamicCompletedRef.current = false; // 重置，允许重试
                    // ✅ 保持轮询继续，允许重试下载
                    notificationAPI.error(
                      `动态资源下载失败: ${downloadResult.error}`,
                    );
                    return; // 继续轮询，不停止
                  }

                  console.log(
                    `✅ 动态资源下载并验证成功: ${downloadResult.path} (${downloadResult.size} bytes)`,
                  );
                  markAsDownloaded(chunkId.current, 'dynamic');
                  dynamicDownloadCompletedRef.current = true;

                  // ✅ 下载成功，现在可以停止轮询
                  isProgressActive.current = false;
                  clearInterval(intervalId);
                  console.log('🛑 动态生成完成并下载成功，停止轮询');
                } else {
                  // 已经下载过了，直接停止轮询
                  dynamicCompletedRef.current = true;
                  isProgressActive.current = false;
                  clearInterval(intervalId);
                  console.log('🛑 动态资源已下载，停止轮询');
                }

                // 重置等待计数器
                dynamicWaitForDownloadCount.current = 0;

                // 更新UI状态
                updateProgressRef.current({
                  step: GenerateStep.DYNAMIC_COMPLETED,
                  progress: 100,
                });
                setGenerateMessage('下载完成！');
                setIsGenerateComplete(true);
                UEAppearanceChange_AppearShowDynamic(
                  chunkId.current,
                  currentGender,
                );
                // handleModelPublishConfirm();
                console.log('✅ 动态生成完成');

                // 记录开始生成的结束时间（动态生成完成时）
                if (generateAnalyticsRef.current) {
                  const endTime = new Date().toISOString();
                  const analyticsData = generateAnalyticsRef.current;
                  const visitorId = getVisitorId();
                  analytics
                    .track(AnalyticsEvent.CHARACTER_GENERATE, {
                      chunk_id: analyticsData.chunkId,
                      gender: analyticsData.gender,
                      style: analyticsData.bodyType || 'unknown', // 体型样式
                      options: {
                        image_count: analyticsData.imageCount || 0,
                        body_type: analyticsData.bodyType || 'unknown',
                      },
                      success: true,
                      visitor_id: visitorId || 'unknown',
                    })
                    .catch((err) => {
                      // eslint-disable-next-line no-console
                      console.error('开始生成埋点失败:', err);
                    });
                  // 清空 ref
                  generateAnalyticsRef.current = null;
                }

                // 记录静态预览下一步的结束时间（动态生成完成时）
                if (staticPreviewNextAnalyticsRef.current) {
                  const endTime = new Date().toISOString();
                  const analyticsData = staticPreviewNextAnalyticsRef.current;
                  const visitorId = getVisitorId();
                  analytics
                    .track(AnalyticsEvent.STATIC_PREVIEW_NEXT, {
                      chunk_id: analyticsData.chunkId,
                      gender: analyticsData.gender,
                      visitor_id: visitorId || 'unknown',
                    })
                    .catch((err) => {
                      // eslint-disable-next-line no-console
                      console.error('静态预览下一步埋点失败:', err);
                    });
                  // 清空 ref
                  staticPreviewNextAnalyticsRef.current = null;
                }

                // 动态生成完成后，刷新主页面的任务列表
                try {
                  // eslint-disable-next-line no-console
                  console.log(
                    '🔄 [UploadPhoto] 动态生成完成，发送刷新任务列表消息',
                  );
                  await sendRefreshTaskListMessage();
                  // eslint-disable-next-line no-console
                  console.log('✅ [UploadPhoto] 刷新任务列表消息发送成功');
                } catch (error) {
                  // eslint-disable-next-line no-console
                  console.error(
                    '❌ [UploadPhoto] 发送刷新任务列表消息失败:',
                    error,
                  );
                }
              } else {
                // 情况2: progress=100 但 pendingDownload 为空
                // 可能是后端还没准备好下载URL，继续轮询等待
                dynamicWaitForDownloadCount.current += 1;

                console.warn(
                  `⏳ progress=100 但 pendingDownload 为空，继续轮询等待 (${dynamicWaitForDownloadCount.current}/${MAX_WAIT_FOR_DOWNLOAD})`,
                );

                if (
                  dynamicWaitForDownloadCount.current >= MAX_WAIT_FOR_DOWNLOAD
                ) {
                  // 等待超时，认为不需要下载（或后端异常）
                  console.error(
                    `❌ 等待 pendingDownload 超时（${MAX_WAIT_FOR_DOWNLOAD} 次轮询），停止等待`,
                  );
                  dynamicCompletedRef.current = true;
                  isProgressActive.current = false;
                  clearInterval(intervalId);

                  // 更新UI状态（允许用户继续操作）
                  updateProgressRef.current({
                    step: GenerateStep.DYNAMIC_COMPLETED,
                    progress: 100,
                  });
                  setGenerateMessage('生成完成（下载信息获取超时）');
                  setIsGenerateComplete(true);
                  UEAppearanceChange_AppearShowDynamic(
                    chunkId.current,
                    currentGender,
                  );

                  notificationAPI.warning(
                    '动态资源下载信息获取超时，已跳过下载。如需下载，请重新生成。',
                  );
                } else {
                  // 继续轮询，不执行任何操作
                  // 不要更新UI，保持生成中状态
                }
              }
            }
            // 生成失败 - 重置状态，保持当前页面
            else if (progressValue === -1) {
              isProgressActive.current = false;
              staticCompletedRef.current = false;
              dynamicCompletedRef.current = false;

              // 根据当前步骤决定回退到哪个状态
              if (currentStep === GenerateStep.STATIC_GENERATING) {
                // 静态生成失败，回到图片检测完成状态
                updateProgressRef.current({
                  isGenerating: false,
                  step: GenerateStep.IMAGE_CHECKED,
                  progress: 0,
                });
                // UE 切换回空白状态
                UESence_AppearShowBlank();
              } else if (currentStep === GenerateStep.DYNAMIC_GENERATING) {
                // 动态生成失败，回到静态生成完成状态
                updateProgressRef.current({
                  isGenerating: true, // 保持 Creating 弹窗打开
                  step: GenerateStep.STATIC_COMPLETED,
                  progress: 100,
                });
                // UE 切换回静态编辑状态
                UEAppearanceChange_AppearEditStatic(
                  chunkId.current,
                  currentGender,
                );
              }

              // 显示错误提示
              notificationAPI.error('生成失败，请尝试重新生成');
            }
            // 更新进度值
            else if (progressValue === 0 && Number(count) == 0) {
              updateProgressRef.current({ progress: 1 });
            } else {
              updateProgressRef.current({ progress: progressValue });
            }
          } catch (e) {
            console.error('获取任务进度失败:', e);
          }
        }
      }, PROGRESS_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [sanityCheckResult]);

    return (
      <div className={styles.container}>
        <div className={styles.leftSide} />

        <div className={styles.centerContainer}>
          <div className={styles.header}>
            <BackButton onBack={handleBack} />
            {/* <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            > */}
            {/* <button
                type="button"
                onClick={handleOpenDevTools}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#165DFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                DevTools
              </button> */}
            {/* </div> */}
          </div>

          <div className={styles.content}>
            <div className={styles.contentInner}>
              {/* 示例区域 */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>示例&nbsp;&nbsp;</div>
                  <div
                    onClick={() => {
                      analytics
                        .track(
                          AnalyticsEvent.CREATE_PHOTO_UPLOAD_TIPS_CLICK,
                          {},
                        )
                        .catch(() => {});
                      openModal('isHelpOpen');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        analytics
                          .track(
                            AnalyticsEvent.CREATE_PHOTO_UPLOAD_TIPS_CLICK,
                            {},
                          )
                          .catch(() => {});
                        openModal('isHelpOpen');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={styles.helpButton}
                  >
                    <div className={styles.buttonText}>更多示例</div>
                    <img
                      className={styles.buttonArrow}
                      src={arrow}
                      alt="arrow"
                    />
                  </div>
                </div>
                {/* <div className={styles.sectionDescription}>
                  为生成的虚拟脸更好上妆，建议上传您的美照
                </div> */}
                <SampleImages samples={sampleImages} />
              </div>

              {/* 上传区域 */}
              <div className={styles.section2}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    上传照片&nbsp;&nbsp;
                  </div>
                  <div className={styles.sectionDescription}>
                    （1-{MAX_IMAGES}
                    张同一人照片）
                  </div>
                </div>

                <ImageGrid
                  images={images}
                  unacceptableImages={unacceptableImages}
                  errors={errors}
                  setImages={setImages}
                  maxImages={MAX_IMAGES}
                  onAddImage={handleFileSelect}
                  onRemoveImage={(index) => {
                    analytics
                      .track(
                        AnalyticsEvent.CREATE_PHOTO_UPLOAD_ICON_DELETE_CLICK,
                        {},
                      )
                      .catch(() => {});
                    removeImage(index);
                  }}
                  onUploadFromPhone={onOpenQrcode}
                  previewAnalyticsContext="create"
                />
              </div>

              {/* 不合格照片 */}
              {/* {unacceptableImages.length > 0 && (
                <div className={styles.unacceptableModalContent}>
                  <div className={styles.unacceptableTitle}>不合格的照片</div>
                  <div className={styles.unacceptableBg}>
                    {unacceptableImages.map((image, index) => (
                      <div key={image.id} className={styles.unacceptableItem}>
                        <img
                          src={image.url || image.base64}
                          alt={`unacceptable-${index}`}
                          className={styles.unacceptableImage}
                        />
                        <div className={styles.unacceptableText}>
                          {errors[index]}
                          <Text type="danger" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )} */}

              {/* 人脸生成服务地址（先隐藏内外网选择，默认统一外网） */}
              {/* <ServerSelector
                value={faceAppServerUrl}
                onChange={(url) => {
                  setFaceAppUrl(url);
                  setFaceAppServerUrl(url);
                }}
              /> */}

              {/* 性别选择 */}
              <div className={styles.genderSection}>
                <div className={styles.genderTitle}>性别</div>
                <div className={styles.genderContainer}>
                  <GenderSelector
                    value={gender}
                    onChange={(newGender) => {
                      analytics
                        .track(
                          newGender === 'male'
                            ? AnalyticsEvent.CREATE_PHOTO_UPLOAD_MALE_CLICK
                            : AnalyticsEvent.CREATE_PHOTO_UPLOAD_FEMALE_CLICK,
                          {},
                        )
                        .catch(() => {});
                      setGender(newGender);
                    }}
                  />
                </div>
              </div>
              {/* 角色名称 */}
              {/* <div className={styles.roleNameSection}>
                <div className={styles.roleNameTitle}>角色名称</div>
                <div className={styles.roleNameContainer}>
                  <RoleNameInput value={roleName} onChange={setRoleName} />
                </div>
              </div> */}
              {/* 生成按钮 */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  !isSubmitEnabled ||
                  images.length === 0 ||
                  progress.step === GenerateStep.IMAGE_CHECKING
                }
                className={styles.generateButton}
              >
                {submitText}
              </button>

              <NotificationManager ref={notificationManagerRef} />
            </div>
          </div>
        </div>

        <div className={styles.rightSide} />
      </div>
    );
  },
);

UploadPhoto.displayName = 'UploadPhoto';

export default UploadPhoto;
