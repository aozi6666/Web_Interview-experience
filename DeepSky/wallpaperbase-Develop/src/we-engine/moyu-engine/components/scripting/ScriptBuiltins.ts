import { Vec3 } from '../../math';

export class MediaPlaybackEvent {
  static PLAYBACK_STOPPED = 0;
  static PLAYBACK_PLAYING = 1;
  static PLAYBACK_PAUSED = 2;
}

export class MediaPropertiesEvent {
  title = '';
  artist = '';
  contentType = '';
  albumTitle = '';
  subTitle = '';
  albumArtist = '';
  genres = '';
  constructor(data?: Partial<MediaPropertiesEvent>) {
    if (data) Object.assign(this, data);
  }
}

export class MediaThumbnailEvent {
  hasThumbnail = false;
  primaryColor = new Vec3(0, 0, 0);
  secondaryColor = new Vec3(0, 0, 0);
  tertiaryColor = new Vec3(0, 0, 0);
  textColor = new Vec3(1, 1, 1);
  highContrastColor = new Vec3(1, 1, 1);
  constructor(data?: Partial<MediaThumbnailEvent>) {
    if (data) Object.assign(this, data);
  }
}

export class MediaStatusEvent {
  enabled = false;
  constructor(data?: Partial<MediaStatusEvent>) {
    if (data) Object.assign(this, data);
  }
}

export class MediaTimelineEvent {
  position = 0;
  duration = 0;
  constructor(data?: Partial<MediaTimelineEvent>) {
    if (data) Object.assign(this, data);
  }
}

export class ScriptPropertiesBuilder {
  private readonly _input: Record<string, unknown>;
  private readonly _vars: Record<string, unknown> = {};
  constructor(input: Record<string, unknown>) {
    this._input = input;
  }
  private _pick(name: string, fallback: unknown): unknown {
    const val = this._input[name];
    if (val === undefined) return fallback;
    if (typeof val === 'object' && val !== null && !Array.isArray(val) && 'value' in (val as Record<string, unknown>)) {
      return (val as { value: unknown }).value;
    }
    return val;
  }
  addSlider(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  addCheckbox(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  addText(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  addCombo(opt: { name: string; value?: unknown; options?: Array<{ value: unknown }> }): this {
    const fallback = opt.value !== undefined ? opt.value : opt.options?.[0]?.value;
    this._vars[opt.name] = this._pick(opt.name, fallback);
    return this;
  }
  addColor(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  addFile(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  addDirectory(opt: { name: string; value?: unknown }): this { this._vars[opt.name] = this._pick(opt.name, opt.value); return this; }
  finish(): Record<string, unknown> { return this._vars; }
}
