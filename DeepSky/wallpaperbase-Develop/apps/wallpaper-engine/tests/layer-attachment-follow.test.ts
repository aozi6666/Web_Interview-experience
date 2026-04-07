import { describe, expect, it } from 'vitest';

import { Layer } from 'moyu-engine/scenario/layers/Layer';

class DummyLayer extends Layer {
  readonly kind = 'dummy';

  toDescriptor(): unknown {
    return { kind: this.kind };
  }

  getTransformPosition(): [number, number] {
    return [this._transformMatrix[12] ?? 0, this._transformMatrix[13] ?? 0];
  }

  getAttachmentBoneDelta(): [number, number] {
    return [this._attachmentBoneDelta.x, this._attachmentBoneDelta.y];
  }

  getAttachmentBoneRotDelta(): number {
    return this._attachmentBoneRotDelta;
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  protected onUpdate(): void {}

  protected onDispose(): void {}
}

class DummyPuppetParentLayer extends DummyLayer {
  private _boneTransform: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  get hasPuppet(): boolean {
    return true;
  }

  setBoneTransform(transform: number[]): void {
    this._boneTransform = transform;
  }

  getBoneTransform(): number[] {
    return this._boneTransform;
  }
}

function createTransformMatrix(
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
): Float32Array {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return new Float32Array([
    c * scaleX, s * scaleX, 0, 0,
    -s * scaleY, c * scaleY, 0, 0,
    0, 0, 1, 0,
    x, y, 0, 1,
  ]);
}

describe('Layer attachment follow', () => {
  it('follows puppet attachment delta from rest pose', async () => {
    const parent = new DummyPuppetParentLayer({
      id: 'layer-137',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
    } as any);
    parent.setBoneTransform(Array.from(createTransformMatrix(10, 20, 1, 1, 0)));

    const child = new DummyLayer({
      id: 'particle-404',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      weParentId: 'layer-137',
      weAttachment: '1',
      weAttachmentBoneIndex: 0,
      weAttachmentLocalOffset: [2, 3],
      weAttachmentRestPos: [5, 15],
      weParentScale: [1, 1],
      coverScale: 1,
    } as any);

    const backend = {
      createTransformMatrix,
    };
    const engine = {
      width: 1920,
      height: 1080,
      parallaxDisplacementX: 0,
      parallaxDisplacementY: 0,
      shakeDisplacementX: 0,
      shakeDisplacementY: 0,
      getLayer: (id: string) => (id === 'layer-137' ? parent : undefined),
    };

    await child.initialize(backend as any, engine as any);
    child.update(1 / 60);

    expect(child.getTransformPosition()).toEqual([7, 8]);
    expect(child.getAttachmentBoneDelta()).toEqual([7, 8]);
    expect(child.getAttachmentBoneRotDelta()).toBe(0);
  });

  it('propagates bone rotation delta to attachment', async () => {
    const boneRotation = Math.PI / 6;
    const parent = new DummyPuppetParentLayer({
      id: 'layer-137',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
    } as any);
    parent.setBoneTransform(Array.from(createTransformMatrix(10, 20, 1, 1, boneRotation)));

    const child = new DummyLayer({
      id: 'particle-404',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      weParentId: 'layer-137',
      weAttachment: '1',
      weAttachmentBoneIndex: 0,
      weAttachmentLocalOffset: [0, 0],
      weAttachmentRestPos: [10, 20],
      weParentScale: [1, 1],
      coverScale: 1,
    } as any);

    const backend = { createTransformMatrix };
    const engine = {
      width: 1920,
      height: 1080,
      parallaxDisplacementX: 0,
      parallaxDisplacementY: 0,
      shakeDisplacementX: 0,
      shakeDisplacementY: 0,
      getLayer: (id: string) => (id === 'layer-137' ? parent : undefined),
    };

    await child.initialize(backend as any, engine as any);
    child.update(1 / 60);

    expect(child.getAttachmentBoneRotDelta()).toBeCloseTo(boneRotation, 5);
  });

  it('resets attachment bone delta when parent has no puppet', async () => {
    const parent = new DummyLayer({
      id: 'layer-137',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
    } as any);

    const child = new DummyLayer({
      id: 'particle-404',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      weParentId: 'layer-137',
      weAttachmentBoneIndex: 0,
      weAttachmentLocalOffset: [2, 3],
      weAttachmentRestPos: [5, 15],
      weParentScale: [1, 1],
      coverScale: 1,
    } as any);

    const backend = {
      createTransformMatrix,
    };
    const engine = {
      width: 1920,
      height: 1080,
      parallaxDisplacementX: 0,
      parallaxDisplacementY: 0,
      shakeDisplacementX: 0,
      shakeDisplacementY: 0,
      getLayer: (id: string) => (id === 'layer-137' ? parent : undefined),
    };

    await child.initialize(backend as any, engine as any);
    child.update(1 / 60);

    expect(child.getAttachmentBoneDelta()).toEqual([0, 0]);
  });

  it('uses parent coverScale for bone matrix scene conversion', async () => {
    const parent = new DummyPuppetParentLayer({
      id: 'layer-137',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      coverScale: 0.5,
    } as any);
    // boneMat 平移分量是父图层显示坐标：x=50,y=100 -> scene 坐标应为 x=100,y=200
    parent.setBoneTransform(Array.from(createTransformMatrix(50, 100, 1, 1, 0)));

    const child = new DummyLayer({
      id: 'particle-404',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      weParentId: 'layer-137',
      weAttachment: '1',
      weAttachmentBoneIndex: 0,
      weAttachmentLocalOffset: [0, 0],
      weAttachmentRestPos: [90, 190],
      weParentScale: [1, 1],
      coverScale: 1,
    } as any);

    const backend = { createTransformMatrix };
    const engine = {
      width: 1920,
      height: 1080,
      parallaxDisplacementX: 0,
      parallaxDisplacementY: 0,
      shakeDisplacementX: 0,
      shakeDisplacementY: 0,
      getLayer: (id: string) => (id === 'layer-137' ? parent : undefined),
    };

    await child.initialize(backend as any, engine as any);
    child.update(1 / 60);

    // 期望 scene delta=(10,10)，按 child coverScale=1 映射到显示坐标仍为 (10,10)
    expect(child.getAttachmentBoneDelta()).toEqual([10, 10]);
    expect(child.getTransformPosition()).toEqual([10, 10]);
  });

  it('applies parent runtime rotation/scale delta for non-attachment child', async () => {
    const parent = new DummyLayer({
      id: 'layer-100',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      sourceScale: [1, 1, 1],
      sourceAngles: [0, 0, 0],
      coverScale: 1,
    } as any);
    parent.setScale(2, 2);
    parent.rotation = Math.PI / 2;

    const child = new DummyLayer({
      id: 'layer-200',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      weParentId: 'layer-100',
      weRelativeOrigin: [10, 0],
      coverScale: 1,
    } as any);

    const backend = { createTransformMatrix };
    const engine = {
      width: 1920,
      height: 1080,
      parallaxDisplacementX: 0,
      parallaxDisplacementY: 0,
      shakeDisplacementX: 0,
      shakeDisplacementY: 0,
      getLayer: (id: string) => (id === 'layer-100' ? parent : undefined),
    };

    await child.initialize(backend as any, engine as any);
    child.update(1 / 60);

    // rel(10,0) from initial (10,0) -> current rotate90+scale2 => (0,20), delta=(-10,+20)
    expect(child.getTransformPosition()[0]).toBeCloseTo(-10, 6);
    expect(child.getTransformPosition()[1]).toBeCloseTo(20, 6);
  });
});
