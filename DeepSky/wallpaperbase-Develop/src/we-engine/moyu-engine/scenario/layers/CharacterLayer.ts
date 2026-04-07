import { Layer, type LayerConfig } from './Layer';
import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import type { IMesh } from '../../rendering/interfaces/IMesh';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import { RenderObjectHint, type RenderObject } from '../../rendering/interfaces/IRenderBackend';
import { DeformMesh } from '../../avatar/puppet/deform';
import { Skeleton, SkinWeights } from '../../avatar/puppet/rig';
import { AutoAnimator } from '../../avatar/puppet/character/AutoAnimator';
import { CharacterBuilder } from '../../avatar/puppet/character/CharacterBuilder';
import { DeformerSystem } from '../../avatar/puppet/character/DeformerSystem';
import { ParameterManager } from '../../avatar/puppet/character/ParameterManager';
import { PartManager } from '../../avatar/puppet/character/PartManager';
import { PhysicsSystem } from '../../avatar/puppet/character/PhysicsSystem';
import type { CharacterAnimationDef, CharacterDef, CharacterTrack, PartDef } from '../../avatar/puppet/character/types';

export interface CharacterLayerConfig extends LayerConfig {
  characterDef: CharacterDef;
  textureBaseUrl?: string;
  autoAnimate?: boolean;
  defaultAnimation?: string;
}

interface PartRuntime {
  part: PartDef;
  deformMesh: DeformMesh;
  mesh: IMesh;
  material: IMaterial;
  texture: ITexture;
}

interface AnimationState {
  clip: CharacterAnimationDef;
  time: number;
  speed: number;
  playing: boolean;
}

export class CharacterLayer extends Layer {
  readonly kind = 'character';
  private _characterDef: CharacterDef;
  private _textureBaseUrl: string;
  private _autoAnimate: boolean;
  private _hasAutoAnimate: boolean;
  private _defaultAnimation: string | null;

  private _skeleton: Skeleton;
  private _paramManager = new ParameterManager();
  private _partManager = new PartManager();
  private _deformerSystem = new DeformerSystem();
  private _autoAnimator = new AutoAnimator();
  private _physicsSystem = new PhysicsSystem();
  private _builder = new CharacterBuilder();
  private _partRuntimes = new Map<string, PartRuntime>();
  private _animations = new Map<string, CharacterAnimationDef>();
  private _animState: AnimationState | null = null;

  constructor(config: CharacterLayerConfig) {
    super(config);
    this._characterDef = config.characterDef;
    this._textureBaseUrl = config.textureBaseUrl ?? '';
    this._autoAnimate = config.autoAnimate ?? true;
    this._hasAutoAnimate = this._autoAnimate;
    this._defaultAnimation = config.defaultAnimation ?? null;
    this._skeleton = new Skeleton(this._characterDef.skeleton);
  }

  get skeleton(): Skeleton {
    return this._skeleton;
  }

  get parameters(): ParameterManager {
    return this._paramManager;
  }

  playAnimation(name: string, speed = 1): void {
    const clip = this._animations.get(name);
    if (!clip) return;
    this._animState = {
      clip,
      time: 0,
      speed,
      playing: true,
    };
  }

  stopAnimation(): void {
    if (this._animState) {
      this._animState.playing = false;
      this._animState.time = 0;
    }
  }

  playExpression(name: string): void {
    this.playAnimation(name, 1);
  }

  setPart(slotId: string, partId: string): void {
    this._partManager.setActivePart(slotId, partId);
  }

  getActivePart(slotId: string): PartDef | null {
    return this._partManager.getActivePart(slotId);
  }

  getAvailableParts(slotId: string): PartDef[] {
    return this._partManager.getAvailableParts(slotId);
  }

  async swapPart(slotId: string, newPart: PartDef): Promise<void> {
    if (!this._backend || !this._loaded) return;
    const previous = this._partManager.getActivePart(slotId);
    if (previous && previous.id === newPart.id) return;

    if (previous) {
      const oldRuntime = this._partRuntimes.get(previous.id);
      if (oldRuntime) {
        oldRuntime.mesh.dispose();
        oldRuntime.material.dispose();
        oldRuntime.texture.dispose();
        this._partRuntimes.delete(previous.id);
      }
    }

    this._partManager.registerPart(newPart);
    if (!this._partRuntimes.has(newPart.id)) {
      const runtime = await this.createPartRuntime(newPart);
      this._partRuntimes.set(newPart.id, runtime);
    }
    this._partManager.setActivePart(slotId, newPart.id);
  }

  setParameter(paramId: string, value: number): void {
    this._paramManager.setValue(paramId, value);
  }

  protected async onInitialize(): Promise<void> {
    if (!this._backend) return;
    const built = this._builder.build(this._characterDef);

    for (const slot of built.slotOrder) {
      this._partManager.registerSlot(slot.slotId, slot.zIndex);
    }
    this._paramManager.registerParameters(built.parameters);
    this._physicsSystem.setGroups(built.physics);
    this._physicsSystem.captureBindPose(this._skeleton);

    for (const animation of built.animations) {
      this._animations.set(animation.name, animation);
    }

    for (const part of built.parts) {
      this._partManager.registerPart(part);
      const runtime = await this.createPartRuntime(part);
      this._partRuntimes.set(part.id, runtime);
    }

    if (this._defaultAnimation) {
      this.playAnimation(this._defaultAnimation);
    }

    this._loaded = true;
  }

  protected onUpdate(deltaTime: number): void {
    if (!this._backend || !this._loaded) return;
    if (this._hasAutoAnimate) {
      this._autoAnimator.update(deltaTime, this._paramManager);
    }
    this.updateAnimation(deltaTime);
    this._physicsSystem.update(deltaTime, this._paramManager, this._skeleton);

    const activeParts = this._partManager.getActiveRenderParts();
    const targets = activeParts
      .map(({ part }) => {
        const runtime = this._partRuntimes.get(part.id);
        if (!runtime) return null;
        return {
          part,
          mesh: runtime.deformMesh,
          skeleton: this._skeleton,
        };
      })
      .filter((item): item is { part: PartDef; mesh: DeformMesh; skeleton: Skeleton } => item !== null);

    this._deformerSystem.update(targets, this._paramManager);

    for (const { part } of activeParts) {
      const runtime = this._partRuntimes.get(part.id);
      if (!runtime) continue;
      this._backend.updateMeshVertices(runtime.mesh, runtime.deformMesh.deformedVertices);
    }
  }

  getRenderObjects(): RenderObject[] {
    if (!this._loaded || !this._visible) return [];
    const objects: RenderObject[] = [];
    const activeParts = this._partManager.getActiveRenderParts();
    for (const { slotId, part } of activeParts) {
      const runtime = this._partRuntimes.get(part.id);
      if (!runtime) continue;
      runtime.material.opacity = this._opacity;
      objects.push({
        id: `${this.id}:${part.id}`,
        mesh: runtime.mesh,
        material: runtime.material,
        transform: this._transformMatrix,
        zIndex: this._zIndex + this._partManager.getSlotZIndex(slotId) + part.zIndex,
        visible: this._visible,
        opacity: this._opacity,
        hint: RenderObjectHint.SingleMesh,
      });
    }
    return objects;
  }

  protected onDispose(): void {
    this._loaded = false;
    for (const runtime of this._partRuntimes.values()) {
      runtime.mesh.dispose();
      runtime.material.dispose();
      runtime.texture.dispose();
    }
    this._partRuntimes.clear();
    this._animations.clear();
    this._animState = null;
  }

  private resolveTexturePath(texture: string): string {
    if (!this._textureBaseUrl) return texture;
    if (/^(https?:)?\/\//.test(texture) || texture.startsWith('/')) {
      return texture;
    }
    return `${this._textureBaseUrl.replace(/\/$/, '')}/${texture.replace(/^\.\//, '')}`;
  }

  private createDeformMesh(part: PartDef): DeformMesh {
    const vertexCount = part.mesh.vertices.length / 3;
    let skinWeights: SkinWeights | undefined;
    if (part.mesh.boneIndices && part.mesh.boneWeights) {
      skinWeights = new SkinWeights(vertexCount);
      skinWeights.setFromArrays(Array.from(part.mesh.boneIndices), Array.from(part.mesh.boneWeights));
    }
    return new DeformMesh({
      vertices: part.mesh.vertices,
      uvs: part.mesh.uvs,
      indices: part.mesh.indices,
      skinWeights,
    });
  }

  private async createPartRuntime(part: PartDef): Promise<PartRuntime> {
    if (!this._backend) {
      throw new Error('CharacterLayer: backend not initialized');
    }
    const texturePath = this.resolveTexturePath(part.texture);
    const texture = await this._backend.createTextureFromURL(texturePath);
    const deformMesh = this.createDeformMesh(part);
    const mesh = this._backend.createDeformableMesh(
      deformMesh.deformedVertices,
      deformMesh.uvs,
      deformMesh.indices,
    );
    const material = this._backend.createSpriteMaterial(texture, true);
    if (part.blendMode !== undefined) {
      material.setBlendMode(part.blendMode);
    }
    material.opacity = this._opacity;
    return {
      part,
      deformMesh,
      mesh,
      material,
      texture,
    };
  }

  private updateAnimation(deltaTime: number): void {
    const state = this._animState;
    if (!state || !state.playing) return;

    state.time += deltaTime * state.speed;
    const clip = state.clip;
    if (clip.loop ?? true) {
      state.time = clip.duration > 0 ? state.time % clip.duration : 0;
    } else if (state.time > clip.duration) {
      state.time = clip.duration;
      state.playing = false;
    }

    for (const track of clip.tracks) {
      const value = this.sampleTrack(track, state.time);
      if (track.targetType === 'parameter') {
        this._paramManager.setValue(track.targetId, value);
      } else if (track.targetType === 'bone') {
        const bone = this._skeleton.getBone(track.targetId);
        if (!bone) continue;
        this.applyBoneProperty(bone, track.property, value);
      }
    }
  }

  private applyBoneProperty(
    bone: ReturnType<Skeleton['getBone']> extends infer T ? Exclude<T, undefined> : never,
    property: string,
    value: number,
  ): void {
    switch (property) {
      case 'x':
        bone.localX = value;
        break;
      case 'y':
        bone.localY = value;
        break;
      case 'rotation':
        bone.localRotation = value;
        break;
      case 'scaleX':
        bone.localScaleX = value;
        break;
      case 'scaleY':
        bone.localScaleY = value;
        break;
      default:
        break;
    }
  }

  private sampleTrack(track: CharacterTrack, time: number): number {
    if (track.keyframes.length === 0) return 0;
    if (track.keyframes.length === 1) return track.keyframes[0].value;
    if (time <= track.keyframes[0].time) return track.keyframes[0].value;
    const last = track.keyframes[track.keyframes.length - 1];
    if (time >= last.time) return last.value;

    for (let i = 0; i < track.keyframes.length - 1; i += 1) {
      const left = track.keyframes[i];
      const right = track.keyframes[i + 1];
      if (time >= left.time && time <= right.time) {
        const t = (time - left.time) / Math.max(1e-6, right.time - left.time);
        return left.value + (right.value - left.value) * t;
      }
    }

    return last.value;
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      loaded: this._loaded,
      partCount: this._partRuntimes.size,
      animationCount: this._animations.size,
      hasActiveAnimation: this._animState?.playing === true,
      autoAnimate: this._autoAnimate,
      defaultAnimation: this._defaultAnimation ?? undefined,
    };
  }

  override toDescriptor(): Record<string, unknown> {
    return {
      kind: this.kind,
      ...this.buildBaseDescriptor(),
      textureBaseUrl: this._textureBaseUrl,
      autoAnimate: this._autoAnimate,
      defaultAnimation: this._defaultAnimation ?? undefined,
      loaded: this._loaded,
      partCount: this._partRuntimes.size,
    };
  }
}

export function createCharacterLayer(config: CharacterLayerConfig): CharacterLayer {
  return new CharacterLayer(config);
}
