import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { NativeService } from './NativeService';

export const nativeModule = new ContainerModule(({ bind }) => {
  bind(TYPES.NativeService).to(NativeService).inSingletonScope();
});
