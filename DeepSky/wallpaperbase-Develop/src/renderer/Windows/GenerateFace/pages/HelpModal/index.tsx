import error from '$assets/images/uploadPhoto/icon-false_state_nor_state_choose__size_32.png';
import right from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose__size_32.png';
// import './index.css';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useStyles } from './styles';
import help_bg from '$assets/images/uploadPhoto/help_bg.png';
import sample_1 from '$assets/images/uploadPhoto/sample_1.png';
import sample_2 from '$assets/images/uploadPhoto/sample_2.png';
import sample_3 from '$assets/images/uploadPhoto/sample_3.png';
import sample_4 from '$assets/images/uploadPhoto/sample_4.png';
import sample_5 from '$assets/images/uploadPhoto/sample_5.png';
import sample_6 from '$assets/images/uploadPhoto/sample_6.png';
import sample_7 from '$assets/images/uploadPhoto/sample_7.png';
import sample_8 from '$assets/images/uploadPhoto/sample_8.png';
import sample_9 from '$assets/images/uploadPhoto/sample_9.png';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal = ({ isOpen, onClose }: HelpModalProps) => {
  const { styles } = useStyles();
  if (!isOpen) return null;

  return (
    <div className={styles.helpOverlay} onClick={() => {
              analytics.track(AnalyticsEvent.CREATE_TIPS_CLOSE_CLICK,
                {},
              ).catch(() => {});
              onClose();
            }}>
      <div className={styles.helpBg}>
        <div className={styles.helpContent} style={{
        backgroundImage: `url(${help_bg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}>
          <div className={styles.helpTitle}></div>
          {/* <div className="helpClose" onClick={onClose}>
          <img className="qrCloseIcon" src={close} alt="关闭" />
        </div> */}
          <div>
            <div className={styles.helpImg}>
              {/* <img className={styles.helpIcon} src={right} /> */}
              <div className={styles.helpText1}>正确示例</div>
            </div>
            <div className={styles.HelpContainer}>
              <div className={styles.helpImgContainer}>
                <img src={sample_1} className={styles.imgShow} />
                <div className={styles.helpText2}>单人正面</div>
              </div>
              <div className={styles.helpImgContainer}>
                <img src={sample_2} className={styles.imgShow} />
                <div className={styles.helpText2}>右侧面部</div>
              </div>
              <div className={styles.helpImgContainer}>
                <img src={sample_3} className={styles.imgShow} />
                <div className={styles.helpText2}>左侧面部</div>
              </div>
              
            </div>
          </div>
          <div className={styles.helpImg}>
            {/* <img className={styles.helpIcon} src={error} /> */}
            <div className={styles.helpText1}>错误示例</div>
          </div>
          <div className={styles.HelpContainer}>
            <div className={styles.helpImgContainer}>
              <img src={sample_4} className={styles.imgShow} />
              <div className={styles.helpText2}>摘掉眼镜</div>
            </div>
            <div className={styles.helpImgContainer}>
              <img src={sample_5} className={styles.imgShow} />
              <div className={styles.helpText2}>露出面部</div>
            </div>
            <div className={styles.helpImgContainer}>
              <img src={sample_6} className={styles.imgShow} />
              <div className={styles.helpText2}>光线正常</div>
            </div>
            <div className={styles.helpImgContainer}>
              <img src={sample_7} className={styles.imgShow} />
              <div className={styles.helpText2}>平淡表情</div>
            </div>
            <div className={styles.helpImgContainer}>
              <img src={sample_8} className={styles.imgShow} />
              <div className={styles.helpText2}>人脸清晰</div>
            </div>
            <div className={styles.helpImgContainer}>
              <img src={sample_9} className={styles.imgShow} />
              <div className={styles.helpText2}>平视镜头</div>
            </div>
            
          </div>
          {/* <div
            className={styles.helpButton}
            onClick={() => {
              analytics.track(AnalyticsEvent.CREATE_TIPS_CLOSE_CLICK,
                {},
              ).catch(() => {});
              onClose();
            }}
          >
            知道了
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
