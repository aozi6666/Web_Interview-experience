import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { TrayService } from './TrayService';

export const trayModule = new ContainerModule(({ bind }) => {
  bind(TYPES.TrayService).to(TrayService).inSingletonScope();
});
