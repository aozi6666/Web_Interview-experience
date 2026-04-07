import { IPCChannels } from '@shared/channels';
import { mainHandle } from '..';
import { AppPaths } from '../../utils/appPaths';

export const registerPathHandlers = () => {
  // 获取app的路径
  mainHandle(IPCChannels.PATH_GET_APP_PATH, async () => {
    try {
      const appRootPath = AppPaths.getAppRootPath();
      return appRootPath;
    } catch (error) {
      console.error(`获取app路径失败:`, error);
      return '';
    }
  });

  // 获取app的上一级路径
  mainHandle(IPCChannels.PATH_GET_PROJECT_PATH, async () => {
    try {
      return AppPaths.getUserDataOrProjectPath();
    } catch (error) {
      console.error(`获取项目路径失败:`, error);
      return '';
    }
  });
};
