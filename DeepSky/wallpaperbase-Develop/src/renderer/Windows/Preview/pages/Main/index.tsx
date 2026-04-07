import close from '$assets/images/uploadPhoto/icon-close_state_nor.png';
import del from '$assets/images/uploadPhoto/icon-trash_state_nor_24_trash-03__36_Default.png';
import left from '$assets/images/uploadPhoto/icon-chevron-right_state_nor.png';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'antd';
import { useStyles } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


const Preview = () => {
  const { styles } = useStyles();
  const [images, setImages] = useState<string[]>([]);
  const [url, setUrl] = useState<string>('');
  const [showNavigation, setShowNavigation] = useState<boolean>(true); // 默认显示导航按钮
  const [showDelete, setShowDelete] = useState<boolean>(true); // 默认显示删除按钮
  const [analyticsContext, setAnalyticsContext] = useState<string | undefined>();
  const displayIndex = useRef<number>(0);

  useEffect(() => {
    const getPreviewParams = async () => {
      try {
        const params = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.PREVIEW_WINDOW_PARAMS);
        // eslint-disable-next-line no-console
        console.log('React 组件获取 IPC 参数：', params);
        setImages(params.images);
        displayIndex.current = params.index;
        setUrl(params.images[params.index]);
        // 如果传入了 showNavigation 参数，使用该值；如果未传入，默认为 true
        if (params.showNavigation !== undefined) {
          setShowNavigation(params.showNavigation);
        } else {
          setShowNavigation(true); // 默认显示导航按钮
        }
        // 如果传入了 showDelete 参数，使用该值；如果未传入，默认为 true
        if (params.showDelete !== undefined) {
          setShowDelete(params.showDelete);
        } else {
          setShowDelete(true); // 默认显示删除按钮
        }
        if (params.analyticsContext !== undefined) {
          setAnalyticsContext(params.analyticsContext);
        }
        // eslint-disable-next-line no-console
        console.log(
          'showNavigation 值：',
          params.showNavigation,
          '最终显示：',
          params.showNavigation !== undefined ? params.showNavigation : true,
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('获取预览参数失败：', error);
      }
    };
    getPreviewParams();
  }, []);

  const onClose = () => {
    if (analyticsContext === 'create') {
      analytics.track(AnalyticsEvent.CREATE_PHOTO_PREVIEW_CLOSE_CLICK,
        {},
      ).catch(() => {});
    }
    window.close();
  };

  const onLeftClick = () => {
    if (displayIndex.current > 0) {
      analytics.track(analyticsContext === 'create'
          ? AnalyticsEvent.CREATE_PHOTO_UPLOAD_PREVIEW_LEFT_CLICK
          : AnalyticsEvent.WALLPAPER_PAGE_TURN_CLICK,
        {},
      ).catch(() => {});
      displayIndex.current -= 1;
      setUrl(images[displayIndex.current]);
      // eslint-disable-next-line no-console
      console.log(' --------', displayIndex.current);
    }
  };

  const onRightClick = () => {
    if (displayIndex.current < images.length - 1) {
      analytics.track(analyticsContext === 'create'
          ? AnalyticsEvent.CREATE_PHOTO_UPLOAD_PREVIEW_RIGHT_CLICK
          : AnalyticsEvent.WALLPAPER_PAGE_TURN_CLICK,
        {},
      ).catch(() => {});
      displayIndex.current += 1;
      setUrl(images[displayIndex.current]);
      // eslint-disable-next-line no-console
      console.log(' --------', displayIndex.current);
    }
  };

  const onDelClick = () => {
    if (analyticsContext === 'create') {
      analytics.track(AnalyticsEvent.CREATE_PHOTO_PREVIEW_DELETE_CLICK,
        {},
      ).catch(() => {});
    }
    images.splice(displayIndex.current, 1);
    if (images.length === 0) {
      onClose();
    } else if (displayIndex.current >= images.length) {
        displayIndex.current = images.length - 1;
      }
    
    setUrl(images[displayIndex.current]);
    ipcEvents.emitTo(
      WindowName.GENERATE_FACE,
      'deleteImage',
      displayIndex.current,
    );
  };
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.title}>预览</div>
        {showDelete && (
        <div className={styles.delBg} onClick={onDelClick}>
            <img className={styles.delIcon} src={del} alt="删除" />
        </div>
        )}
        <div className={styles.imgBg}>
          <Image
            className={styles.img}
            src={url}
            alt="预览图片"
            preview={false}
          />
        </div>
        {showDelete && <div className={styles.line} />}
        <div className={styles.close} onClick={onClose}>
          <img className={styles.closeIcon} src={close} alt="关闭" />
        </div>
        {showNavigation && (
          <>
        <div className={styles.left} onClick={onLeftClick}>
              <img className={styles.leftIcon} src={left} alt="上一张" />
        </div>
        <div className={styles.right} onClick={onRightClick}>
              <img className={styles.rightIcon} src={left} alt="下一张" />
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Preview;
