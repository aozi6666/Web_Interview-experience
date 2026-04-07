import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { UEStateService } from './UEStateService';

export const ueStateModule = new ContainerModule(({ bind }) => {
  bind(TYPES.UEStateService).to(UEStateService).inSingletonScope();
});
