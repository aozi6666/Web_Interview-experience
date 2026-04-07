import { createIPCRegistrar } from '../../../ipc-events';
import { registerIpcBridge } from '../bridge/ipc-bridge';
import { wsService } from '../core/ws-service';

export const registerWebSocketHandlers = () => {
  registerIpcBridge(wsService);
};

export const registerWebSocketIPCHandlers = createIPCRegistrar(() => {
  registerWebSocketHandlers();
});
