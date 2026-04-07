import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { RTCChatService } from './RTCChatService';

export const rtcChatModule = new ContainerModule(({ bind }) => {
  bind(TYPES.RTCChatService).to(RTCChatService).inSingletonScope();
});
