import close from '$assets/images/uploadPhoto/icon-close_state_nor.png';
// import qrcodeimg from '$assets/images/uploadPhoto/qrcode.png';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
// import './index.css';
import { useStyles } from './styles';
interface QrcodeProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}
const Qrcode = ({ isOpen, url, onClose }: QrcodeProps) => {
  const { styles } = useStyles();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  // 加载状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // 错误信息
  const [error, setError] = useState<string>('');
  const qrConfig = {
    size: 256,
    margin: 2,
    errorCorrectionLevel: 'H' as const,
  };

  // 生成二维码
  const generateQRCode = async (content: string) => {
    // 清空之前的错误
    setError('');

    // 验证内容
    if (!content.trim()) {
      setError('URL 不能为空');
      return;
    }

    setIsLoading(true);

    try {
      // 生成二维码的 base64 图片
      const qrUrl = await QRCode.toDataURL(content, {
        width: qrConfig.size,
        margin: qrConfig.margin,
        errorCorrectionLevel: qrConfig.errorCorrectionLevel,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setQrCodeUrl(qrUrl);
    } catch (err) {
      setError('生成二维码失败，请重试');
      console.error('二维码生成错误:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 当 url 变化或组件显示时重新生成二维码
  useEffect(() => {
    if (isOpen && url) {
      generateQRCode(url);
    }
  }, [url, isOpen, generateQRCode]);

  if (!isOpen) return null;

  return (
    <div className={styles.qrOverlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.qrContent}>
        <div className={styles.qrTitle}>移动设备上传</div>
        <div className={styles.qrDesc}>使用移动设备， 扫描下方二维码， 上传照片</div>
        <div className={styles.qrClose} onClick={onClose}>
          <img className={styles.qrCloseIcon} src={close} alt="关闭" />
        </div>
        <div className={styles.qrImgBg}>
          <img className={styles.qrImg} src={qrCodeUrl} alt="二维码" />
        </div>
      </div>
    </div>
  );
};

export default Qrcode;
