import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppearance } from '../../contexts/AppearanceContext';
import { usePanelPageStyles } from '../../styles/panelPageStyles';
import { FullscreenStatusPanel } from './FullscreenStatusPanel';
import RTCChatTest from './RTCChatTest';
import SystemControl, { type LogMessage } from './SystemControl';
import SystemStatusPanel from './SystemStatusPanel';

function Home() {
  useAppearance();
  const navigate = useNavigate();
  const { styles } = usePanelPageStyles();

  const noopAddLogMessage: (message: LogMessage) => void = () => {};

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageContent}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button type="primary" onClick={() => navigate('/for-vc')}>
            前往 ForVc
          </Button>
        </div>
        <div className={styles.mainPanel}>
          <div className={styles.controlSection}>
            <h3>全屏应用检测</h3>
            <FullscreenStatusPanel />
          </div>

          <div className={styles.controlSection}>
            <h3>系统状态</h3>
            <SystemStatusPanel />
          </div>

          <div className={styles.controlSection}>
            <h3>RTC 语音测试</h3>
            <RTCChatTest />
          </div>

          {/* 第二分区：系统控制（动态壁纸和窗口控制） */}
          <SystemControl onAddLogMessage={noopAddLogMessage} />
        </div>
      </div>
    </div>
  );
}

export default Home;
