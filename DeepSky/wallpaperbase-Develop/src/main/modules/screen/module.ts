import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { ScreenService } from './ScreenService';

export const screenModule = new ContainerModule(({ bind }) => {
  bind(TYPES.ScreenService).to(ScreenService).inSingletonScope();
});
