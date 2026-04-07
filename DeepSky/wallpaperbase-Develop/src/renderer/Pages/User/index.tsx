import { useUser } from '@contexts/UserContext';
import { AutoLaunchSettings } from './components/AutoLaunchSettings';
import { LoginPrompt } from './components/LoginPrompt';
import { LogoutButton } from './components/LogoutButton';
import { UserProfile } from './components/UserProfile';
import { VersionInfo } from './components/VersionInfo';
import { useUserStyles } from './styles';

function User() {
  const { styles } = useUserStyles();
  const { user, isLoggedIn } = useUser();

  // 如果未登录，显示登录提示界面
  if (!isLoggedIn) {
    return <LoginPrompt />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 用户头像和信息 */}
        <UserProfile user={user} />

        {/* 自启动设置 */}
        <AutoLaunchSettings />

        {/* 版本信息 */}
        <VersionInfo />

        {/* 退出登录按钮 */}
        <LogoutButton />
      </div>
    </div>
  );
}

export default User;
