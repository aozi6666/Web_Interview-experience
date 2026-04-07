import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { StoreService } from './StoreService';

export const storeModule = new ContainerModule(({ bind }) => {
  bind(TYPES.StoreService).to(StoreService).inSingletonScope();
});
