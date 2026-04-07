import type { IEngineLike } from '../../interfaces';
import { FBORegistry } from '../effects/FBORegistry';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import { getTransparent1x1Texture } from '../../rendering/EffectDefaults';
import { ThumbnailColorExtractor } from './ThumbnailColorExtractor';
import type {
  MediaColor,
  MediaPropertiesData,
  MediaStatusEventData,
  MediaThumbnailEventData,
  MediaThumbnailSource,
  MediaTimelineEventData,
} from './types';

const ALBUM_COVER_TEXTURE = '_rt_AlbumCover';
const ALBUM_COVER_PREVIOUS_TEXTURE = '_rt_AlbumCoverPrevious';

function blackColor(): MediaColor {
  return { x: 0, y: 0, z: 0 };
}

function whiteColor(): MediaColor {
  return { x: 1, y: 1, z: 1 };
}

function emptyThumbnailEvent(): MediaThumbnailEventData {
  const black = blackColor();
  return {
    hasThumbnail: false,
    primaryColor: black,
    secondaryColor: black,
    tertiaryColor: black,
    textColor: whiteColor(),
    highContrastColor: whiteColor(),
  };
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, imageData.width);
  canvas.height = Math.max(1, imageData.height);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export class MediaIntegrationProvider {
  private readonly _engine: IEngineLike;
  private _enabled = true;
  private _playbackState = 0;
  private _timeline: MediaTimelineEventData = { position: 0, duration: 0 };
  private _testMode = false;
  private _testTimer = 0;

  private readonly _emptyTexture: ITexture;
  private _currentTexture: ITexture;
  private _previousTexture: ITexture;

  constructor(engine: IEngineLike) {
    this._engine = engine;
    this._emptyTexture = getTransparent1x1Texture(this._engine.backend);
    this._currentTexture = this._emptyTexture;
    this._previousTexture = this._emptyTexture;
    this._syncGlobalTextures();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    const event: MediaStatusEventData = { enabled };
    this._engine.dispatchMediaStatusChanged(event);
  }

  setPlaybackState(state: number): void {
    this._playbackState = state;
    this._engine.dispatchMediaPlaybackChanged(state);
  }

  setMediaProperties(properties: MediaPropertiesData): void {
    this._engine.dispatchMediaPropertiesChanged(properties);
  }

  setTimelinePosition(position: number, duration: number): void {
    this._timeline = { position, duration };
    this._engine.dispatchMediaTimelineChanged(this._timeline);
  }

  setTestMode(enabled: boolean): void {
    this._testMode = enabled;
    this._testTimer = 0;
  }

  async setThumbnail(source: MediaThumbnailSource | null): Promise<void> {
    if (!source) {
      this._currentTexture = this._emptyTexture;
      this._syncGlobalTextures();
      this._engine.dispatchMediaThumbnailChanged(emptyThumbnailEvent());
      return;
    }

    const mediaSource = typeof source === 'string' ? await loadImageFromUrl(source) : source;
    const textureSource = mediaSource instanceof ImageData ? imageDataToCanvas(mediaSource) : mediaSource;
    const nextTexture = this._engine.backend.createTexture({ source: textureSource });

    const oldPrevious = this._previousTexture;
    this._previousTexture = this._currentTexture;
    this._currentTexture = nextTexture;
    this._syncGlobalTextures();

    if (oldPrevious !== this._emptyTexture && oldPrevious !== this._previousTexture && oldPrevious !== this._currentTexture) {
      oldPrevious.dispose();
    }

    const palette = ThumbnailColorExtractor.extract(textureSource);
    this._engine.dispatchMediaThumbnailChanged(palette);
  }

  update(deltaTime: number): void {
    if (!this._testMode) return;
    this._testTimer += deltaTime;
    if (this._testTimer < 1 / 2) return;
    this._testTimer = 0;

    const t = this._engine.time;
    const cycle = (Math.sin(t * 1.3) + 1) * 0.5;
    this.setPlaybackState(1);
    this.setTimelinePosition((this._timeline.position + 0.5) % 180, 180);
    this.setMediaProperties({
      title: `Test Track ${Math.floor((t * 10) % 100)}`,
      artist: 'Wallpaper Engine Web',
      albumTitle: 'Audio Visualization',
      albumArtist: 'System',
      contentType: 'music',
      genres: 'Electronic',
      subTitle: '',
    });
    this._engine.dispatchMediaThumbnailChanged({
      hasThumbnail: true,
      primaryColor: { x: cycle, y: 0.2, z: 1 - cycle },
      secondaryColor: { x: 0.2, y: 1 - cycle, z: cycle },
      tertiaryColor: { x: 1 - cycle, y: cycle, z: 0.2 },
      textColor: whiteColor(),
      highContrastColor: whiteColor(),
    });
  }

  dispose(): void {
    if (this._currentTexture !== this._emptyTexture) this._currentTexture.dispose();
    if (this._previousTexture !== this._emptyTexture && this._previousTexture !== this._currentTexture) {
      this._previousTexture.dispose();
    }
    this._emptyTexture.dispose();
  }

  private _syncGlobalTextures(): void {
    FBORegistry.setGlobalTexture(ALBUM_COVER_TEXTURE, this._currentTexture);
    FBORegistry.setGlobalTexture(ALBUM_COVER_PREVIOUS_TEXTURE, this._previousTexture);
  }
}
