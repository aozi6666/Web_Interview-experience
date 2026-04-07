import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { UpdateService } from './UpdateService';

export const updateModule = new ContainerModule(({ bind }) => {
  bind(TYPES.UpdateService).to(UpdateService).inSingletonScope();
});
