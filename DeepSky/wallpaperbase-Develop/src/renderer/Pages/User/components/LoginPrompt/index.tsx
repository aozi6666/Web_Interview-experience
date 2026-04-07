import { logRenderer } from '@utils/logRenderer';
import { IPCChannels } from '@shared/channels';
import { useLoginPromptStyles } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


export function LoginPrompt() {
  const { styles } = useLoginPromptStyles();

  // 处理打开登录窗口
  const handleOpenLogin = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LOGIN_WINDOW);
      logRenderer.info('打开登录窗口', {
        type: 'createLoginWindow',
        data: result,
      });
      if (!result.success) {
        // 打开登录窗口失败
      }
    } catch {
      // 打开登录窗口出错
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 应用图标 */}
        <div className={styles.appIconContainer}>
          <div className={styles.appIcon}>
            <span className={styles.appIconText}>⭐</span>
          </div>
        </div>

        {/* 提示信息 */}
        <div className={styles.loginPrompt}>
          <h2 className={styles.promptTitle}>账号</h2>
          <p className={styles.promptMessage}>
            您还未登录账号，为更好的体验请尽快登录！！
          </p>
        </div>

        {/* 登录按钮 */}
        <div className={styles.actionContainer}>
          <button
            type="button"
            className={styles.loginButton}
            onClick={handleOpenLogin}
          >
            去登录
          </button>
        </div>
      </div>
    </div>
  );
}
