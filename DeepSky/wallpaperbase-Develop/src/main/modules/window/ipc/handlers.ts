import { createIPCRegistrar } from '../../../ipc-events';
import { registerUEDownloadHandlers } from './ueDownloadHandlers';
import {
  closeAllWindowsExcept,
  registerWindowHandlers,
} from './windowHandlers';

export { closeAllWindowsExcept };

export const registerWindowIPCHandlers = createIPCRegistrar(() => {
  registerWindowHandlers();
  registerUEDownloadHandlers();
});
