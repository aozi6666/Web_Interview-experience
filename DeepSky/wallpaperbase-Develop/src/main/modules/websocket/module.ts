import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { WsService } from './core/ws-service';

export const websocketModule = new ContainerModule(({ bind }) => {
  bind(TYPES.WebSocketService).to(WsService).inSingletonScope();
});
