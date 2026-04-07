import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { WindowService } from './WindowService';

export const windowModule = new ContainerModule(({ bind }) => {
  bind(TYPES.WindowService).to(WindowService).inSingletonScope();
});
