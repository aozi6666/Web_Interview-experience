import type { CharacterDef, DeformerBinding, KeyformDef, MeshDef, PartDef } from '../types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface RawCharacterDef extends Omit<CharacterDef, 'parts'> {
  parts: RawPartDef[];
}

interface RawPartDef extends Omit<PartDef, 'mesh' | 'deformers'> {
  mesh: {
    vertices: number[];
    uvs: number[];
    indices: number[];
    boneIndices?: number[];
    boneWeights?: number[];
  };
  deformers: Array<{
    parameterId: string;
    keyforms: Array<{
      paramValue: number;
      vertexDeltas: number[];
      opacity?: number;
    }>;
  }>;
}

export class NativeCharacterLoader {
  async loadFromUrl(url: string): Promise<CharacterDef> {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`NativeCharacterLoader: 加载失败 ${resp.status} ${url}`);
    }
    const json = (await resp.json()) as JsonValue;
    return this.parse(json);
  }

  parse(json: JsonValue): CharacterDef {
    const raw = json as unknown as RawCharacterDef;
    const parts = raw.parts.map((part) => this.parsePart(part));
    return {
      ...raw,
      parts,
    };
  }

  private parsePart(raw: RawPartDef): PartDef {
    return {
      ...raw,
      mesh: this.parseMesh(raw.mesh),
      deformers: raw.deformers.map((deformer) => this.parseDeformer(deformer)),
    };
  }

  private parseMesh(raw: RawPartDef['mesh']): MeshDef {
    return {
      vertices: new Float32Array(raw.vertices),
      uvs: new Float32Array(raw.uvs),
      indices: new Uint16Array(raw.indices),
      boneIndices: raw.boneIndices ? new Uint8Array(raw.boneIndices) : undefined,
      boneWeights: raw.boneWeights ? new Float32Array(raw.boneWeights) : undefined,
    };
  }

  private parseDeformer(raw: RawPartDef['deformers'][number]): DeformerBinding {
    return {
      parameterId: raw.parameterId,
      keyforms: raw.keyforms.map((k) => this.parseKeyform(k)),
    };
  }

  private parseKeyform(raw: RawPartDef['deformers'][number]['keyforms'][number]): KeyformDef {
    return {
      paramValue: raw.paramValue,
      vertexDeltas: new Float32Array(raw.vertexDeltas),
      opacity: raw.opacity,
    };
  }
}
