export interface SpineBoneData {
  name: string;
  parent?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  length?: number;
}

export interface SpineSlotData {
  name: string;
  bone: string;
  attachment?: string;
  blend?: string;
}

export interface SpineAttachment {
  name: string;
  type: 'region' | 'mesh' | string;
  path?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  uvs?: number[];
  triangles?: number[];
  vertices?: number[];
}

export interface SpineSkinData {
  name: string;
  attachments: Record<string, Record<string, SpineAttachment>>;
}

export interface SpineAnimationData {
  name: string;
  data: Record<string, unknown>;
}

export interface SpineAtlasRegion {
  name: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: boolean;
}

export interface SpineData {
  skeleton: Record<string, unknown>;
  bones: SpineBoneData[];
  slots: SpineSlotData[];
  skins: SpineSkinData[];
  animations: SpineAnimationData[];
  ik?: Array<Record<string, unknown>>;
  atlas: Record<string, SpineAtlasRegion>;
}

export class SpineImporter {
  parse(json: unknown, atlasText: string): SpineData {
    const data = json as Record<string, unknown>;
    const bones = (data.bones as SpineBoneData[]) ?? [];
    const slots = (data.slots as SpineSlotData[]) ?? [];
    const skins = this.parseSkins(data.skins);
    const animations: SpineAnimationData[] = Object.entries(
      (data.animations as Record<string, Record<string, unknown>>) ?? {},
    ).map(([name, value]) => ({ name, data: value }));

    return {
      skeleton: (data.skeleton as Record<string, unknown>) ?? {},
      bones,
      slots,
      skins,
      animations,
      ik: (data.ik as Array<Record<string, unknown>>) ?? [],
      atlas: this.parseAtlas(atlasText),
    };
  }

  private parseSkins(rawSkins: unknown): SpineSkinData[] {
    if (Array.isArray(rawSkins)) {
      return rawSkins.map((skin) => {
        const typed = skin as { name?: string; attachments?: Record<string, Record<string, SpineAttachment>> };
        return {
          name: typed.name ?? 'default',
          attachments: typed.attachments ?? {},
        };
      });
    }

    const obj = (rawSkins as Record<string, Record<string, Record<string, SpineAttachment>>>) ?? {};
    return Object.entries(obj).map(([name, attachments]) => ({
      name,
      attachments,
    }));
  }

  private parseAtlas(atlasText: string): Record<string, SpineAtlasRegion> {
    const lines = atlasText.split(/\r?\n/);
    const regions: Record<string, SpineAtlasRegion> = {};
    let currentPage = '';
    let currentRegion: SpineAtlasRegion | null = null;

    const flushRegion = (): void => {
      if (currentRegion) {
        regions[currentRegion.name] = currentRegion;
        currentRegion = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushRegion();
        continue;
      }

      if (!line.includes(':') && !line.includes(',')) {
        if (line.endsWith('.png') || line.endsWith('.jpg') || line.endsWith('.webp')) {
          flushRegion();
          currentPage = line;
        } else {
          flushRegion();
          currentRegion = {
            name: line,
            page: currentPage,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotate: false,
          };
        }
        continue;
      }

      if (!currentRegion) continue;
      if (line.startsWith('bounds:')) {
        const [, value] = line.split(':');
        const [x, y, width, height] = value.split(',').map((v) => Number(v.trim()));
        currentRegion.x = x;
        currentRegion.y = y;
        currentRegion.width = width;
        currentRegion.height = height;
      } else if (line.startsWith('xy:')) {
        const [, value] = line.split(':');
        const [x, y] = value.split(',').map((v) => Number(v.trim()));
        currentRegion.x = x;
        currentRegion.y = y;
      } else if (line.startsWith('size:')) {
        const [, value] = line.split(':');
        const [width, height] = value.split(',').map((v) => Number(v.trim()));
        currentRegion.width = width;
        currentRegion.height = height;
      } else if (line.startsWith('rotate:')) {
        const [, value] = line.split(':');
        currentRegion.rotate = value.trim() === 'true' || value.trim() === '90';
      }
    }
    flushRegion();

    return regions;
  }
}
