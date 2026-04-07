import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { FullscreenService } from './FullscreenService';

export const fullscreenModule = new ContainerModule(({ bind }) => {
  bind(TYPES.FullscreenService).to(FullscreenService).inSingletonScope();
});
