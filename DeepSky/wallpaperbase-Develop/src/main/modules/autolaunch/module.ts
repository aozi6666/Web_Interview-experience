import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { AutoLaunchService } from './AutoLaunchService';

export const autolaunchModule = new ContainerModule(({ bind }) => {
  bind(TYPES.AutoLaunchService).to(AutoLaunchService).inSingletonScope();
});
