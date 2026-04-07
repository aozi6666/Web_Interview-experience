import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { DownloadService } from './DownloadService';

export const downloadModule = new ContainerModule(({ bind }) => {
  bind(TYPES.DownloadService).to(DownloadService).inSingletonScope();
});
