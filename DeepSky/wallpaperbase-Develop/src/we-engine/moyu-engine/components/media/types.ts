export interface MediaColor {
  x: number;
  y: number;
  z: number;
}

export interface MediaPropertiesData {
  title?: string;
  artist?: string;
  contentType?: string;
  albumTitle?: string;
  subTitle?: string;
  albumArtist?: string;
  genres?: string;
}

export interface MediaThumbnailEventData {
  hasThumbnail: boolean;
  primaryColor: MediaColor;
  secondaryColor: MediaColor;
  tertiaryColor: MediaColor;
  textColor: MediaColor;
  highContrastColor: MediaColor;
}

export interface MediaStatusEventData {
  enabled: boolean;
}

export interface MediaTimelineEventData {
  position: number;
  duration: number;
}

export type MediaThumbnailSource = string | ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap;
