import upPhoneDisable from '$assets/images/uploadPhoto/icon-upPhone_state_disable.png';
import upPhone from '$assets/images/uploadPhoto/icon-upPhone_state_nor.png';
import upNormalDisable from '$assets/images/uploadPhoto/iconadd_state_disable.png';
import upNormal from '$assets/images/uploadPhoto/iconadd_state_nor.png';
import mize from '$assets/images/uploadPhoto/minimize-01.png';
// import Preview from '../Preview';
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import {
  FACE_APP_URL_EXTERNAL,
  FACE_APP_URL_INTERNAL,
} from '@shared/config';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Button, Select, Typography } from 'antd';
import type { Dispatch, SetStateAction } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { useStyles } from './styles';
import { ImageUpload } from './types';

const ipcEvents = getIpcEvents();

const { Text } = Typography;

const FACE_APP_SERVER_OPTIONS = [
  { label: '内网 (10.15.101.111)', value: FACE_APP_URL_INTERNAL },
  { label: '外网 (gpu.deepsymphony.cn)', value: FACE_APP_URL_EXTERNAL },
];

interface ServerSelectorProps {
  value: string;
  onChange: (url: string) => void;
}

function ServerSelector({
  value,
  onChange,
}: ServerSelectorProps): React.ReactElement {
  const { styles } = useStyles();

  return (
    <div className={styles.serverSection}>
      <div className={styles.serverTitle}>生成服务</div>
      <div className={styles.serverContainer}>
        <Select
          className={styles.serverSelect}
          options={FACE_APP_SERVER_OPTIONS}
          value={value}
          onChange={onChange}
          popupMatchSelectWidth={false}
        />
      </div>
    </div>
  );
}

interface ImageGridProps {
  images: ImageUpload[];
  unacceptableImages: ImageUpload[];
  errors: string[];
  setImages: Dispatch<SetStateAction<ImageUpload[]>>;
  maxImages: number;
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
  onUploadFromPhone: () => void;
  /** 预览埋点上下文：create=创建角色上传照片预览 */
  previewAnalyticsContext?: 'create';
}

function ImageGrid({
  images,
  unacceptableImages,
  errors,
  setImages,
  maxImages,
  onAddImage,
  onRemoveImage,
  onUploadFromPhone,
  previewAnalyticsContext,
}: ImageGridProps): React.ReactElement {
  const { styles } = useStyles();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [buttonStates, setButtonStates] = useState({
    //0正常1hover2按下3禁用4隐藏
    button1: 0,
    button2: 0,
    button3: 0,
  });
  const [divWidth, setDivWidth] = useState(290);
  const [divHeight, setDivHeight] = useState(290);
  const handleButtonState = (buttonId: string, state: number) => {
    setButtonStates((prev) => ({
      ...prev,
      [buttonId]: state,
    }));
  };
  const onPreview = (index: number) => {
    setIndex(index);
    // 点击照片图标打开预览埋点
    if (previewAnalyticsContext === 'create') {
      analytics
        .track(AnalyticsEvent.CREATE_PHOTO_UPLOAD_ICON_CLICK, {})
        .catch(() => {});
    }
    ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.PREVIEW_WINDOW, {
      index: index,
      images: images.map((item) => item.url),
      showNavigation: true, // 创建角色页面显示左右导航按钮
      analyticsContext: previewAnalyticsContext,
    });
  };
  const rafRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const animatetexts = ['', '.', '..', '...'];
  const updateRef = useRef<number>(0);
  const [animateText, setAnimateText] = useState<string>('.');

  useEffect(() => {
    setDivWidth(290);
    setDivHeight(290);
    if (unacceptableImages.length > 4) {
      setDivWidth(180);
      setDivHeight(200);
    }
    if (images.length > 1) {
      const num = Math.min(4, images.length);
      setDivWidth(368 / num);
    }
  }, [images, unacceptableImages]);
  useEffect(() => {
    const animate = () => {
      countRef.current += 1;

      updateRef.current += 1;
      setAnimateText(animatetexts[Math.floor(updateRef.current / 50) % 4]);
      if (updateRef.current >= 1000) {
        updateRef.current = 0;
      }
      if (countRef.current < 2) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      } else {
        countRef.current = 0;
      }
      let needRefresh = false;
      images.forEach((img) => {
        if (img.progress && img.progress >= 1 && img.progress < 99) {
          img.progress += 1;
          needRefresh = true;
        }
      });
      if (needRefresh) {
        setImages((prevImages: ImageUpload[]) => {
          const updatedImages = prevImages.map((img) => {
            // console.log("----",img.progress);
            if (img.progress && img.progress >= 1 && img.progress < 99) {
              return { ...img, progress: img.progress + 1 };
            }
            return img;
          });
          return updatedImages;
        });
      }

      // 继续动画
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [images]);
  return (
    <div className={styles.imageGrid}>
      <div className={styles.sections}>
        <div className={styles.topSection} style={{ height: `${divHeight}px` }}>
          {images.map((image, index) => (
            <div
              key={image.id}
              className={styles.imageContainer}
              style={{ width: `${divWidth}px` }}
            >
              <img
                alt={`upload-${index}`}
                src={image.base64 || image.url}
                className={styles.image}
                onClick={() => onPreview(index)}
              />
              {!image.isChecking && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onRemoveImage(index)}
                  className={styles.deleteButton}
                />
              )}
              {image.error && (
                <div className={styles.imageError}>{image.error}</div>
              )}
              {image.isChecking && (
                <div>
                  <div className={styles.loadingMask}></div>
                  <div className={styles.loadingText1}>{image.progress}%</div>
                  <div className={styles.loadingBg}>
                    <div
                      className={styles.loadingInner}
                      style={{ width: `${image.progress}%` }}
                    ></div>
                  </div>
                  <div className={styles.loadingText}>检测中{animateText}</div>
                </div>
              )}
            </div>
          ))}
          {images.length === 0 && (
            <button
              onClick={onAddImage}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onAddImage();
                }
              }}
              role="button"
              tabIndex={0}
              className={styles.add3Button}
              style={{ width: `${divWidth}px` }}
            >
              <img src={upNormal} />
            </button>
          )}
        </div>
        {unacceptableImages.length > 0 && (
          <div className={styles.centerSection}>
            {/* <div className={styles.unacceptableModalContent}> */}
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
            {/* </div> */}
          </div>
        )}
      </div>

      <div className={styles.bottomSection}>
        <button
          onClick={onUploadFromPhone}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onUploadFromPhone();
            }
          }}
          role="button"
          disabled={images.length >= maxImages}
          tabIndex={0}
          className={styles.addButton}
          // onMouseEnter={() => handleButtonState('button2', 1)}
          // onMouseLeave={() => handleButtonState('button2', 0)}
          // onMouseDown={() => handleButtonState('button2', 2)}
          // onMouseUp={() => handleButtonState('button2', 0)}
        >
          <div className={styles.phoneIcon}>
            {/* <PlusOutlined className={styles.phoneIconInner} /> */}
            <img
              src={images.length >= maxImages ? upPhoneDisable : upPhone}
              className={styles.phoneIconInner}
            />
          </div>
          <Text
            className={
              images.length >= maxImages
                ? styles.addTextDisable
                : styles.addText
            }
          >
            移动设备上传
          </Text>
        </button>
        <button
          onClick={onAddImage}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onAddImage();
            }
          }}
          role="button"
          disabled={images.length >= maxImages}
          tabIndex={0}
          className={styles.add2Button}
          // onMouseEnter={() => handleButtonState('button3', 1)}
          // onMouseLeave={() => handleButtonState('button3', 0)}
          // onMouseDown={() => handleButtonState('button3', 2)}
          // onMouseUp={() => handleButtonState('button3', 0)}
        >
          <img
            src={images.length >= maxImages ? upNormalDisable : upNormal}
            className={styles.phoneIconInner}
          />
          <Text
            className={
              images.length >= maxImages
                ? styles.addTextDisable
                : styles.addText
            }
          >
            添加
          </Text>
        </button>
      </div>
      {/* <Preview
        isOpen={isPreviewOpen}
        index={index}
        images={images}
        onRemoveImage={onRemoveImage}
        onClose={() => setIsPreviewOpen(false)}/> */}
    </div>
  );
}

export { ImageGrid };

interface SampleImagesProps {
  samples: Array<{
    src: string;
    title: string;
    isGood: boolean;
  }>;
}

function SampleImages({ samples }: SampleImagesProps): React.ReactElement {
  const { styles } = useStyles();

  return (
    <div className={styles.sampleContainer}>
      {samples.map((sample) => (
        <div key={`sample-${sample.title}`} className={styles.sampleItem}>
          <img
            alt={sample.title}
            src={sample.src}
            className={styles.sampleImage}
          />
          {/* <div
            className={`${styles.sampleBadge} ${sample.isGood ? styles.goodBadge : styles.badBadge}`}
          >
            {sample.isGood ? '✓' : '✗'}
          </div> */}
          {/* {sample.isGood ? (
            <img src={right} className={styles.imgerror} />
          ) : (
            <img src={error} className={styles.imgerror} />
          )} */}
          <div className={styles.sampleTitle}>{sample.title}</div>
        </div>
      ))}
    </div>
  );
}

export { SampleImages };

interface GenderSelectorProps {
  value: 'male' | 'female';
  onChange: (value: 'male' | 'female') => void;
}

function GenderSelector({
  value,
  onChange,
}: GenderSelectorProps): React.ReactElement {
  const { styles } = useStyles();

  return (
    <div className={styles.genderSelector}>
      <div
        onClick={() => onChange('male')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onChange('male');
          }
        }}
        role="button"
        tabIndex={0}
        className={`${styles.genderButton} ${value === 'male' ? styles.genderButtonActive : ''}`}
      >
        男
      </div>
      <div
        onClick={() => onChange('female')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onChange('female');
          }
        }}
        role="button"
        tabIndex={0}
        className={`${styles.genderButton} ${value === 'female' ? styles.genderButtonActive : ''}`}
      >
        女
      </div>
    </div>
  );
}

export { GenderSelector, ServerSelector };

interface BackButtonProps {
  onBack: () => void;
}

function BackButton({ onBack }: BackButtonProps): React.ReactElement {
  const { styles } = useStyles();

  return (
    <div
      onClick={onBack}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onBack();
        }
      }}
      role="button"
      tabIndex={0}
      className={styles.backButton}
    >
      <div className={styles.backIcon}>
        <CloseOutlined className={styles.backIconInner} />
        {/* <img src = {mize}/> */}
      </div>
      {/* <div className={styles.backText}>后台生成</div> */}
    </div>
  );
}

export { BackButton };
function BackendButton({ onBack }: BackButtonProps): React.ReactElement {
  const { styles } = useStyles();
  const handleClick = () => {
    analytics
      .track(AnalyticsEvent.CREATE_IN_BACKGROUND_CLICK, {})
      .catch(() => {});
    onBack();
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={styles.backendButton}
    >
      <div className={styles.backendIcon}>
        {/* <CloseOutlined className={styles.backIconInner} /> */}
        <img src={mize} />
      </div>
      后台生成
      {/* <div className={styles.backText}>后台生成</div> */}
    </div>
  );
}

export { BackendButton };

interface RoleNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

function RoleNameInput({
  value,
  onChange,
}: RoleNameInputProps): React.ReactElement {
  const { styles } = useStyles();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // 限制6个字符以内（中文算1个字符）
    if (newValue.length <= 6) {
      onChange(newValue);
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="请输入角色名称"
      maxLength={6}
      className={styles.roleNameInput}
    />
  );
}

export { RoleNameInput };
