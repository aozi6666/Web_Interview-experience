import { UESence_AppearShowBlank } from '@api/IPCRequest/selectUESence';
import { useEffect, useRef, useState } from 'react';
import type { RestoreTaskData } from '../../utils/createCharacter';

// import './index.css';
import { ExLoading } from '@components/ExLoading';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import Creating from './pages/Creating';
import HelpModal from './pages/HelpModal';
import Qrcode from './pages/Qrcode';
import UploadPhoto, { UploadPhotoRef } from './pages/UploadPhoto';
import {
  useModalState,
  useQrcode,
  useUploadProgress,
} from './pages/UploadPhoto/hooks';
import { injectGlobalStyles, useStyles } from './styles';

const ipcEvents = getIpcEvents();

function App() {
  const { styles } = useStyles();
  // 状态管理
  const { progress, updateProgress } = useUploadProgress();
  const { modals, openModal, closeModal } = useModalState();
  const { qrcode, setQcode } = useQrcode();
  const [loadingMessage, setLoadingMessage] = useState('正在加载数据，请稍候');

  // UploadPhoto 组件的引用
  const uploadPhotoRef = useRef<UploadPhotoRef>(null);
  useEffect(() => {
    const cleanup = injectGlobalStyles();
    return cleanup;
  }, []);
  // 🎧 监听任务恢复消息（从主窗口发来）
  useEffect(() => {
    if (!window.electron) {
      console.warn('⚠️ GenerateFace窗口: 跨窗口通信API不可用');
      return undefined;
    }

    console.log('🎧 GenerateFace窗口: 开始监听任务恢复消息');

    const handleRestoreTaskState = (data: RestoreTaskData) => {
      console.log('📨 GenerateFace窗口: 收到任务恢复消息', data);

      try {
        // 调用 UploadPhoto 组件的恢复方法
        if (uploadPhotoRef.current?.restoreTaskState) {
          uploadPhotoRef.current.restoreTaskState(data);
          console.log('✅ 任务状态已恢复到UploadPhoto组件');
        } else {
          console.error('❌ UploadPhoto组件的restoreTaskState方法不可用');
        }
      } catch (error) {
        console.error('❌ 恢复任务状态失败:', error);
      }
    };
    ipcEvents.on(IpcTarget.ANY, 'restoreTaskState', handleRestoreTaskState);

    return () => {
      ipcEvents.off(IpcTarget.ANY, 'restoreTaskState', handleRestoreTaskState);
      console.log('🔇 GenerateFace窗口: 任务恢复消息监听器已卸载');
    };
  }, []);

  return (
    <div className={styles.generateFaceContainer}>
      {/* 主页面 - 上传照片 */}
      <UploadPhoto
        ref={uploadPhotoRef}
        progress={progress}
        updateProgress={updateProgress}
        // modals={modals}
        qrcode={qrcode}
        openModal={openModal}
        closeModal={closeModal}
        // loadingMessage={loadingMessage}
        setLoadingMessage={setLoadingMessage}
      />

      {/* 生成进度弹窗 */}
      <Creating
        isOpen={progress.isGenerating}
        onClose={() => uploadPhotoRef.current?.handleBack()}
        onNext={() => uploadPhotoRef.current?.handleGenerateDynamic()}
        onRetry={() => uploadPhotoRef.current?.handleRetry()}
        onConfirm={() => uploadPhotoRef.current?.handleConfirm()}
        onDressUp={() => uploadPhotoRef.current?.handleDressUp()}
        onPreviewStatic={() => UESence_AppearShowBlank()}
        progress={progress.progress}
        generateStep={progress.step}
        waitCount={progress.waitCount}
      />

      {/* 帮助弹窗 */}
      <HelpModal
        isOpen={modals.isHelpOpen}
        onClose={() => closeModal('isHelpOpen')}
      />

      {/* 加载弹窗 */}
      <ExLoading
        visible={progress.isLoading}
        progress={progress.progress}
        message={loadingMessage}
        closable
        delay={progress.delay}
      />

      {/* 二维码弹窗 */}
      <Qrcode
        isOpen={modals.isQrcodeOpen}
        url={qrcode.url}
        onClose={() => closeModal('isQrcodeOpen')}
      />
    </div>
  );
}

export default App;
