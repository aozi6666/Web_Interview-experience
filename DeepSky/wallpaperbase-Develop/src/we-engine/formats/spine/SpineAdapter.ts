import type { BlendMode } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { BoneConfig, SkeletonConfig } from 'moyu-engine/avatar/puppet/rig';
import type {
  CharacterAnimationDef,
  CharacterDef,
  CharacterTrack,
  DeformerBinding,
  KeyformDef,
  MeshDef,
  ParameterDef,
  PartDef,
} from 'moyu-engine/avatar/puppet/character';
import type { SpineAttachment, SpineData, SpineSlotData } from './SpineImporter';

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export class SpineAdapter {
  convert(spineData: SpineData, baseTexturePath = ''): CharacterDef {
    const skeleton = this.convertSkeleton(spineData);
    const [parts, drawOrder] = this.convertParts(spineData, baseTexturePath);
    const parameters = this.createDefaultParameters();
    const animations = this.convertAnimations(spineData);

    return {
      meta: {
        name: 'SpineImportedCharacter',
        version: String(spineData.skeleton.spine ?? '4.x'),
        width: Number(spineData.skeleton.width ?? 1024),
        height: Number(spineData.skeleton.height ?? 1024),
      },
      skeleton,
      parameters,
      parts,
      drawOrder,
      animations,
      physics: [],
    };
  }

  private convertSkeleton(spineData: SpineData): SkeletonConfig {
    const bones: BoneConfig[] = spineData.bones.map((bone) => ({
      id: bone.name,
      name: bone.name,
      parentId: bone.parent ?? null,
      length: bone.length ?? 0,
      localTransform: {
        pos: { x: bone.x ?? 0, y: bone.y ?? 0 },
        rotation: degToRad(bone.rotation ?? 0),
        scale: { x: bone.scaleX ?? 1, y: bone.scaleY ?? 1 },
      },
    }));
    return { bones };
  }

  private convertParts(spineData: SpineData, baseTexturePath: string): [PartDef[], Array<{ slotId: string; zIndex: number }>] {
    const defaultSkin = spineData.skins.find((skin) => skin.name === 'default') ?? spineData.skins[0];
    const parts: PartDef[] = [];
    const drawOrder: Array<{ slotId: string; zIndex: number }> = [];

    for (let i = 0; i < spineData.slots.length; i++) {
      const slot = spineData.slots[i];
      drawOrder.push({ slotId: slot.name, zIndex: i * 10 });
      if (!defaultSkin) continue;
      const slotAttachments = defaultSkin.attachments[slot.name];
      if (!slotAttachments) continue;
      for (const [attachmentName, attachment] of Object.entries(slotAttachments)) {
        const part = this.convertAttachmentToPart(slot, attachmentName, attachment, i, spineData, baseTexturePath);
        if (part) parts.push(part);
      }
    }
    return [parts, drawOrder];
  }

  private convertAttachmentToPart(
    slot: SpineSlotData,
    attachmentName: string,
    attachment: SpineAttachment,
    slotIndex: number,
    spineData: SpineData,
    baseTexturePath: string,
  ): PartDef | null {
    let mesh: MeshDef | null = null;
    if (attachment.type === 'mesh') {
      mesh = this.buildMeshAttachmentMesh(attachment);
    } else {
      mesh = this.buildRegionMesh(attachment, spineData);
    }
    if (!mesh) return null;

    const textureName = attachment.path ?? attachment.name ?? attachmentName;
    const texturePath = baseTexturePath
      ? `${baseTexturePath.replace(/\/$/, '')}/${textureName}.png`
      : `${textureName}.png`;

    return {
      id: `${slot.name}_${attachmentName}`,
      slot: slot.name,
      texture: texturePath,
      mesh,
      deformers: this.createDefaultDeformer(mesh),
      zIndex: slotIndex * 10,
      blendMode: this.mapBlendMode(slot.blend),
      visible: true,
    };
  }

  private buildRegionMesh(attachment: SpineAttachment, spineData: SpineData): MeshDef {
    const width = attachment.width ?? 128;
    const height = attachment.height ?? 128;
    const x = attachment.x ?? 0;
    const y = attachment.y ?? 0;
    const halfW = width / 2;
    const halfH = height / 2;

    const vertices = new Float32Array([
      x - halfW, y - halfH, 0,
      x + halfW, y - halfH, 0,
      x + halfW, y + halfH, 0,
      x - halfW, y + halfH, 0,
    ]);

    let uvs = new Float32Array([
      0, 1,
      1, 1,
      1, 0,
      0, 0,
    ]);

    const region = spineData.atlas[attachment.path ?? attachment.name ?? ''];
    if (region) {
      const texW = Number(spineData.skeleton.width ?? 1024);
      const texH = Number(spineData.skeleton.height ?? 1024);
      const u0 = region.x / texW;
      const v0 = region.y / texH;
      const u1 = (region.x + region.width) / texW;
      const v1 = (region.y + region.height) / texH;
      uvs = new Float32Array([u0, v1, u1, v1, u1, v0, u0, v0]);
    }

    return {
      vertices,
      uvs,
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
  }

  private buildMeshAttachmentMesh(attachment: SpineAttachment): MeshDef | null {
    if (!attachment.vertices || !attachment.triangles || !attachment.uvs) return null;
    const rawVertices = attachment.vertices;
    const vertices = new Float32Array((rawVertices.length / 2) * 3);
    for (let i = 0; i < rawVertices.length / 2; i++) {
      vertices[i * 3] = rawVertices[i * 2];
      vertices[i * 3 + 1] = rawVertices[i * 2 + 1];
      vertices[i * 3 + 2] = 0;
    }
    return {
      vertices,
      uvs: new Float32Array(attachment.uvs),
      indices: new Uint16Array(attachment.triangles),
    };
  }

  private createDefaultDeformer(mesh: MeshDef): DeformerBinding[] {
    const key0: KeyformDef = {
      paramValue: 0,
      vertexDeltas: new Float32Array((mesh.vertices.length / 3) * 2),
    };
    return [
      {
        parameterId: 'ParamMouthOpenY',
        keyforms: [key0],
      },
    ];
  }

  private mapBlendMode(blend: string | undefined): BlendMode {
    switch (blend) {
      case 'additive':
        return 'additive' as BlendMode;
      case 'multiply':
        return 'multiply' as BlendMode;
      case 'screen':
        return 'screen' as BlendMode;
      default:
        return 'normal' as BlendMode;
    }
  }

  private createDefaultParameters(): ParameterDef[] {
    return [
      { id: 'ParamEyeLOpen', name: 'Eye L Open', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamEyeROpen', name: 'Eye R Open', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamMouthOpenY', name: 'Mouth Open', min: 0, max: 1, default: 0, group: 'mouth' },
      { id: 'ParamBreath', name: 'Breath', min: 0, max: 1, default: 0.5, group: 'body' },
      { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleZ', name: 'Angle Z', min: -30, max: 30, default: 0, group: 'face' },
    ];
  }

  private convertAnimations(spineData: SpineData): CharacterAnimationDef[] {
    return spineData.animations.map((anim) => {
      const tracks: CharacterTrack[] = [];
      let duration = 0;
      const bones = (anim.data.bones as Record<string, Record<string, Array<{ time: number; angle?: number; x?: number; y?: number; value?: number }>>>) ?? {};
      for (const [boneName, timelines] of Object.entries(bones)) {
        for (const [timelineName, keyframes] of Object.entries(timelines)) {
          const property = this.mapBoneTimeline(timelineName);
          if (!property) continue;
          const mapped = keyframes.map((frame) => ({
            time: frame.time ?? 0,
            value: this.pickTimelineValue(frame, property),
          }));
          if (mapped.length === 0) continue;
          duration = Math.max(duration, mapped[mapped.length - 1].time);
          tracks.push({
            targetType: 'bone',
            targetId: boneName,
            property,
            keyframes: mapped,
          });
        }
      }

      return {
        name: anim.name,
        duration: Math.max(0.01, duration),
        loop: true,
        tracks,
      };
    });
  }

  private mapBoneTimeline(timelineName: string): string | null {
    switch (timelineName) {
      case 'rotate':
        return 'rotation';
      case 'translate':
        return 'x';
      case 'scale':
        return 'scaleX';
      default:
        return null;
    }
  }

  private pickTimelineValue(
    frame: { angle?: number; x?: number; y?: number; value?: number },
    property: string,
  ): number {
    if (property === 'rotation') {
      return degToRad(frame.angle ?? frame.value ?? 0);
    }
    if (property === 'x') {
      return frame.x ?? frame.value ?? 0;
    }
    if (property === 'scaleX') {
      return frame.x ?? frame.value ?? 1;
    }
    return frame.value ?? 0;
  }
}
