import type { DisplayCoordinatorState } from '../../backend/DisplayCoordinator';

type ActiveWallpaperKind = 'moyu' | 'we' | 'video' | null;
type DisplayMode = 'Interactive' | 'EnergySaving';

export type ActiveWallpaperEffectiveMode =
  | 'moyu_3d'
  | 'moyu_energy_saving'
  | 'we'
  | 'video'
  | 'unknown';

export interface ActiveWallpaperRuntimeCharacter {
  id: string;
  name: string;
  identity?: string;
  personality?: string;
  languageStyle?: string;
  relationships?: string;
  experience?: string;
  background?: string;
  voice_id?: string;
  bot_id?: string;
  activeReplyRules?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActiveWallpaperRuntimePayload {
  sceneKey?: string | null;
  wallpaperTitle?: string | null;
  character?: ActiveWallpaperRuntimeCharacter | null;
}

export interface ActiveWallpaperRuntimeSnapshot {
  wallpaperKind: ActiveWallpaperKind;
  displayMode: DisplayMode;
  effectiveMode: ActiveWallpaperEffectiveMode;
  sceneKey: string | null;
  wallpaperTitle: string | null;
  character: ActiveWallpaperRuntimeCharacter | null;
  updatedAt: number;
}

class ActiveWallpaperRuntimeStore {
  private sceneKey: string | null = null;

  private wallpaperTitle: string | null = null;

  private character: ActiveWallpaperRuntimeCharacter | null = null;

  private updatedAt: number = Date.now();

  setSnapshotPartial(payload: ActiveWallpaperRuntimePayload): void {
    if ('sceneKey' in payload) {
      this.sceneKey = payload.sceneKey ?? null;
    }
    if ('wallpaperTitle' in payload) {
      this.wallpaperTitle = payload.wallpaperTitle ?? null;
    }
    if ('character' in payload) {
      this.character = payload.character ?? null;
    }
    this.updatedAt = Date.now();
  }

  clear(): void {
    this.sceneKey = null;
    this.wallpaperTitle = null;
    this.character = null;
    this.updatedAt = Date.now();
  }

  getSnapshot(
    displayState: DisplayCoordinatorState,
  ): ActiveWallpaperRuntimeSnapshot {
    const wallpaperKind = displayState.activeWallpaperKind;
    const displayMode = displayState.displayMode;

    return {
      wallpaperKind,
      displayMode,
      effectiveMode: this.toEffectiveMode(wallpaperKind, displayMode),
      sceneKey: this.sceneKey,
      wallpaperTitle: this.wallpaperTitle,
      character: this.character,
      updatedAt: this.updatedAt,
    };
  }

  private toEffectiveMode(
    wallpaperKind: ActiveWallpaperKind,
    displayMode: DisplayMode,
  ): ActiveWallpaperEffectiveMode {
    if (wallpaperKind === 'we') {
      return 'we';
    }
    if (wallpaperKind === 'video') {
      return 'video';
    }
    if (wallpaperKind === 'moyu' && displayMode === 'Interactive') {
      return 'moyu_3d';
    }
    if (wallpaperKind === 'moyu' && displayMode === 'EnergySaving') {
      return 'moyu_energy_saving';
    }
    return 'unknown';
  }
}

let activeWallpaperRuntimeStore: ActiveWallpaperRuntimeStore | null = null;

export function getActiveWallpaperRuntimeStore(): ActiveWallpaperRuntimeStore {
  if (!activeWallpaperRuntimeStore) {
    activeWallpaperRuntimeStore = new ActiveWallpaperRuntimeStore();
  }
  return activeWallpaperRuntimeStore;
}
