import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { ShortcutService } from './ShortcutService';

export const shortcutModule = new ContainerModule(({ bind }) => {
  bind(TYPES.ShortcutService).to(ShortcutService).inSingletonScope();
});
