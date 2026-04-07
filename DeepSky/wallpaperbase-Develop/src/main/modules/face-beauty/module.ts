import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { FaceBeautyService } from './FaceBeautyService';

export const faceBeautyModule = new ContainerModule(({ bind }) => {
  bind(TYPES.FaceBeautyService).to(FaceBeautyService).inSingletonScope();
});
