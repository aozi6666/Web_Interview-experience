import type { ILayerScriptDispatch } from '../../interfaces';
import type { Vec3Like } from '../../math';
import type {
  MediaPropertiesData,
  MediaStatusEventData,
  MediaThumbnailEventData,
  MediaTimelineEventData,
} from './types';

function dispatchScriptEventToLayers(
  layers: ILayerScriptDispatch[],
  eventName: 'mediaPlaybackChanged' | 'mediaThumbnailChanged' | 'mediaPropertiesChanged' | 'mediaStatusChanged' | 'mediaTimelineChanged' | 'applyUserProperties' | 'applyGeneralSettings',
  payload: unknown,
): void {
  for (const layer of layers) {
    layer.dispatchScriptEvent(eventName, payload);
  }
}

export function dispatchMediaPlaybackChangedToLayers(layers: ILayerScriptDispatch[], state: number): void {
  dispatchScriptEventToLayers(layers, 'mediaPlaybackChanged', { state });
}

export function normalizeMediaThumbnailEvent(
  eventLike: MediaThumbnailEventData | Vec3Like | null,
): MediaThumbnailEventData {
  const colorFromLegacy = (input: Vec3Like | null): MediaThumbnailEventData => {
    const color = input ?? { x: 0, y: 0, z: 0 };
    return {
      hasThumbnail: !!input,
      primaryColor: color,
      secondaryColor: color,
      tertiaryColor: color,
      textColor: { x: 1, y: 1, z: 1 },
      highContrastColor: { x: 1, y: 1, z: 1 },
    };
  };
  return (
    eventLike && 'hasThumbnail' in eventLike
      ? eventLike
      : colorFromLegacy((eventLike as Vec3Like | null) ?? null)
  );
}

export function dispatchMediaThumbnailChangedToLayers(
  layers: ILayerScriptDispatch[],
  eventLike: MediaThumbnailEventData | Vec3Like | null,
): void {
  dispatchScriptEventToLayers(layers, 'mediaThumbnailChanged', normalizeMediaThumbnailEvent(eventLike));
}

export function dispatchMediaPropertiesChangedToLayers(layers: ILayerScriptDispatch[], properties: MediaPropertiesData): void {
  const event = {
    title: properties.title ?? '',
    artist: properties.artist ?? '',
    contentType: properties.contentType ?? '',
    albumTitle: properties.albumTitle ?? '',
    subTitle: properties.subTitle ?? '',
    albumArtist: properties.albumArtist ?? '',
    genres: properties.genres ?? '',
  };
  dispatchScriptEventToLayers(layers, 'mediaPropertiesChanged', event);
}

export function dispatchMediaStatusChangedToLayers(layers: ILayerScriptDispatch[], status: MediaStatusEventData | boolean): void {
  const event = typeof status === 'boolean' ? { enabled: status } : { enabled: !!status.enabled };
  dispatchScriptEventToLayers(layers, 'mediaStatusChanged', event);
}

export function normalizeMediaTimelineEvent(
  timeline: MediaTimelineEventData | { position: number; duration: number },
  duration?: number,
): { position: number; duration: number } {
  return typeof duration === 'number'
    ? { position: Number((timeline as { position: number }).position ?? 0), duration: Number(duration) }
    : {
      position: Number((timeline as MediaTimelineEventData).position ?? 0),
      duration: Number((timeline as MediaTimelineEventData).duration ?? 0),
    };
}

export function dispatchMediaTimelineChangedToLayers(
  layers: ILayerScriptDispatch[],
  timeline: MediaTimelineEventData | { position: number; duration: number },
  duration?: number,
): void {
  dispatchScriptEventToLayers(layers, 'mediaTimelineChanged', normalizeMediaTimelineEvent(timeline, duration));
}

export function dispatchApplyUserPropertiesToLayers(layers: ILayerScriptDispatch[], properties: Record<string, unknown>): void {
  dispatchScriptEventToLayers(layers, 'applyUserProperties', properties);
}

export function dispatchApplyGeneralSettingsToLayers(layers: ILayerScriptDispatch[], settings: Record<string, unknown>): void {
  dispatchScriptEventToLayers(layers, 'applyGeneralSettings', settings);
}
