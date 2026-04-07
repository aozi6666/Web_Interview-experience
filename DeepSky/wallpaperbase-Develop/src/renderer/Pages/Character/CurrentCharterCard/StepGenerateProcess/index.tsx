import { formatWaitTime } from '@stores/CharacterGenerateTaskStore';
import { Progress } from 'antd';
import { useStyles } from './styles';

interface StepGenerateProcessProps {
  status: 'static' | 'model';
  progress: number;
  waitTime: number; // 等待时间（秒）
  error?: string; // 错误信息（可选）
  waitCount?: number; // 前方排队人数（可选）
}

function StepGenerateProcess({
  status,
  progress,
  waitTime,
  error,
  waitCount,
}: StepGenerateProcessProps) {
  const { styles } = useStyles();

  // 生成排队提示文本
  const waitText =
    typeof waitCount === 'number' && waitCount > 0
      ? `前面有${waitCount}人正在创建角色，`
      : '';

  // 如果有错误，显示失败状态
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div
            className={styles.headerTitle}
            style={{ color: 'rgba(255, 77, 79, 1)' }}
          >
            {status === 'static' ? '预览角色生成失败' : '可驱动角色生成失败'}
          </div>
        </div>
        <div className={styles.progress}>
          <Progress
            percent={100}
            showInfo={false}
            strokeColor="rgba(255, 77, 79, 1)"
            railColor="rgba(51, 51, 51, 1)"
            status="exception"
          />
        </div>
        {/* <div className={styles.footer} style={{ color: 'rgba(255, 77, 79, 1)' }}>
          {error}
        </div> */}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          {status === 'static' ? '预览角色生成中...' : '可驱动角色生成中...'}
        </div>
        <div className={styles.headerProgress}>{progress}%</div>
      </div>
      <div className={styles.progress}>
        <Progress
          percent={progress}
          showInfo={false}
          strokeColor="rgba(21, 180, 180, 1)"
          railColor="rgba(51, 51, 51, 1)"
        />
      </div>
      <div className={styles.footerTextTips}>
        <div className={styles.textTips}>{waitText}</div>
        <div className={styles.textTips}>预计还需等待 {formatWaitTime(waitTime)}</div>
      </div>
    </div>
  );
}

export default StepGenerateProcess;
