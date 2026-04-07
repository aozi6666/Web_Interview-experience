import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import type { Color3, Vec2Like, Vec3Like } from '../../math';

export function buildScriptLayerProxy(layer: any): Record<string, unknown> {
  const self = layer;
  const proxy: Record<string, unknown> = {};
  const safeVec = (v: unknown): [number, number, number] => {
    if (v == null) return [0, 0, 0];
    if (typeof v === 'number') return [v, v, v];
    const o = v as Record<string, unknown>;
    return [Number(o.x ?? 0), Number(o.y ?? 0), Number(o.z ?? 0)];
  };
  const makeVec3 = (x: number, y: number, z: number): Record<string, unknown> => ({
    x,
    y,
    z,
    copy() { return makeVec3(x, y, z); },
    add(v: unknown) { const p = safeVec(v); return makeVec3(x + p[0], y + p[1], z + p[2]); },
    subtract(v: unknown) { const p = safeVec(v); return makeVec3(x - p[0], y - p[1], z - p[2]); },
    multiply(s: unknown) { const n = Number(s ?? 1); return makeVec3(x * n, y * n, z * n); },
    divide(s: unknown) { const n = Number(s ?? 1); return n === 0 ? makeVec3(x, y, z) : makeVec3(x / n, y / n, z / n); },
    length() { return Math.hypot(x, y, z); },
    normalize() { const len = Math.hypot(x, y, z); return len === 0 ? makeVec3(0, 0, 0) : makeVec3(x / len, y / len, z / len); },
    negate() { return makeVec3(-x, -y, -z); },
    dot(v: unknown) { const p = safeVec(v); return x * p[0] + y * p[1] + z * p[2]; },
    toString() { return `(${x}, ${y}, ${z})`; },
  });
  const makeScriptMat4 = (arr?: ArrayLike<number> | null): Record<string, unknown> => {
    const m = new Array<number>(16).fill(0);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    if (arr) {
      const n = Math.min(16, arr.length ?? 0);
      for (let i = 0; i < n; i++) m[i] = Number(arr[i] ?? m[i]);
    }
    return {
      m,
      translation(value?: { x?: number; y?: number; z?: number }): unknown {
        if (value === undefined) return makeVec3(m[12], m[13], m[14]);
        m[12] = Number(value.x ?? m[12]);
        m[13] = Number(value.y ?? m[13]);
        m[14] = Number(value.z ?? m[14]);
        return this;
      },
    };
  };
  const getSceneOrigin = () => {
    const so = self._sourceOrigin as [number, number] | undefined;
    return makeVec3(Number(so?.[0] ?? 0), Number(so?.[1] ?? 0), 0);
  };
  const setSceneOrigin = (v: unknown) => {
    const vec = self._parseVec3(v);
    const cs = Number(self._sourceCoverScale ?? 1) || 1;
    const so = (self._sceneOffset as [number, number] | undefined) ?? [0, 0];
    self.setPosition(vec[0] * cs - Number(so[0] ?? 0), vec[1] * cs - Number(so[1] ?? 0));
  };

  Object.defineProperties(proxy, {
    visible: {
      get: () => self.visible,
      set: (v: unknown) => { self.visible = Boolean(v); },
    },
    alpha: {
      get: () => self.opacity,
      set: (v: unknown) => { self.opacity = Number(v ?? 0); },
    },
    origin: {
      get: () => getSceneOrigin(),
      set: (v: unknown) => setSceneOrigin(v),
    },
    position: {
      get: () => getSceneOrigin(),
      set: (v: unknown) => setSceneOrigin(v),
    },
    originalOrigin: {
      get: () => {
        const initial = (self._initialTransform as { x?: number; y?: number } | undefined) ?? {};
        const cs = Number(self._sourceCoverScale ?? 1) || 1;
        const so = (self._sceneOffset as [number, number] | undefined) ?? [0, 0];
        return makeVec3(
          (Number(initial.x ?? 0) + Number(so[0] ?? 0)) / cs,
          (Number(initial.y ?? 0) + Number(so[1] ?? 0)) / cs,
          0,
        );
      },
    },
    scale: {
      get: () => makeVec3(self.scaleX, self.scaleY, 1),
      set: (v: unknown) => {
        const vec = self._parseVec3(v);
        self.setScale(vec[0], vec[1]);
      },
    },
    angles: {
      get: () => makeVec3(0, 0, self.rotation),
      set: (v: unknown) => {
        const vec = self._parseVec3(v);
        self.rotation = vec[2];
      },
    },
    parallaxDepth: {
      get: () => ({ x: self._parallaxDepth[0], y: self._parallaxDepth[1] }),
      set: (v: unknown) => {
        const vec = self._parseVec3(v);
        self.setParallaxDepth(vec[0], vec[1]);
      },
    },
    name: {
      get: () => self.name,
    },
    id: {
      get: () => self.id,
    },
    verticalalign: {
      get: () => (self as unknown as Record<string, unknown>)._vAlign,
      set: (v: unknown) => { (self as unknown as Record<string, unknown>)._vAlign = v as string; },
    },
    horizontalalign: {
      get: () => (self as unknown as Record<string, unknown>)._hAlign,
      set: (v: unknown) => { (self as unknown as Record<string, unknown>)._hAlign = v as string; },
    },
    text: {
      get: () => {
        const anyLayer = self as unknown as { getScriptText?: () => string };
        return typeof anyLayer.getScriptText === 'function' ? anyLayer.getScriptText() : undefined;
      },
      set: (v: unknown) => {
        const anyLayer = self as unknown as { setScriptText?: (value: string) => void };
        if (typeof anyLayer.setScriptText === 'function') anyLayer.setScriptText(String(v ?? ''));
      },
    },
    color: {
      get: () => {
        const anyLayer = self as unknown as { getScriptColor?: () => Color3 };
        return typeof anyLayer.getScriptColor === 'function' ? anyLayer.getScriptColor() : undefined;
      },
      set: (v: unknown) => {
        const anyLayer = self as unknown as { setScriptColor?: (r: number, g: number, b: number) => void };
        if (typeof anyLayer.setScriptColor === 'function') {
          const [r, g, b] = self._parseVec3(v);
          anyLayer.setScriptColor(r, g, b);
        }
      },
    },
  });
  proxy.getParent = (): Record<string, unknown> | null => {
    if (!self._engine || !self._weParentId) return null;
    const parent = self._engine.getLayer(self._weParentId);
    return parent ? parent.getScriptLayerProxy() : null;
  };
  proxy.getChildren = (): Record<string, unknown>[] => self.getChildren().map((item: any) => item.getScriptLayerProxy());
  proxy.setParent = (parent: string | number | Record<string, unknown> | undefined) => {
    if (parent === undefined || parent === null) {
      self.setParent(undefined);
      return;
    }
    if (typeof parent === 'number') {
      const candidate = self._engine?.layers[parent];
      self.setParent(candidate?.id);
      return;
    }
    if (typeof parent === 'string') {
      const byId = self._engine?.getLayer(parent);
      if (byId) {
        self.setParent(byId.id);
        return;
      }
      const byName = self._engine?.layers.find((item: any) => item.name === parent);
      self.setParent(byName?.id);
      return;
    }
    if (typeof parent === 'object' && 'id' in parent) {
      self.setParent(String((parent as Record<string, unknown>).id));
    }
  };
  proxy.rotateObjectSpace = (angles: unknown) => {
    const vec = self._parseVec3(angles);
    self.rotation += vec[2];
  };
  proxy.getAnimation = (name: string) => {
    const animation = self.getAnimationByName(name);
    if (!animation) return null;
    const group = () => {
      const items = self.getAnimationsByName(name);
      return items.length > 0 ? items : [animation];
    };
    return {
      get fps() { return animation.fps; },
      get frameCount() { return animation.frameCount; },
      get duration() { return animation.duration; },
      get name() { return animation.name; },
      get rate() { return animation.rate; },
      set rate(v: number) { animation.rate = v; },
      play: () => {
        for (const item of group()) {
          item.setFrame(0);
          item.play();
        }
      },
      stop: () => {
        for (const item of group()) item.stop();
      },
      pause: () => {
        for (const item of group()) item.pause();
      },
      isPlaying: () => group().some((item: any) => item.isPlaying()),
      getFrame: () => animation.getFrame(),
      setFrame: (frame: number) => animation.setFrame(frame),
    };
  };
  proxy.getBoneCount = () => (typeof self.getBoneCount === 'function' ? self.getBoneCount() : 0);
  proxy.getBoneTransform = (bone: string | number) => (typeof self.getBoneTransform === 'function' ? makeScriptMat4(self.getBoneTransform(bone)) : makeScriptMat4());
  proxy.setBoneTransform = (bone: string | number, transform: ArrayLike<number>) => {
    if (typeof self.setBoneTransform !== 'function') return;
    const t = transform as unknown as { m?: ArrayLike<number> };
    self.setBoneTransform(bone, t?.m ?? transform);
  };
  proxy.getLocalBoneTransform = (bone: string | number) => (typeof self.getLocalBoneTransform === 'function' ? makeScriptMat4(self.getLocalBoneTransform(bone)) : makeScriptMat4());
  proxy.setLocalBoneTransform = (bone: string | number, transform: ArrayLike<number>) => {
    if (typeof self.setLocalBoneTransform !== 'function') return;
    const t = transform as unknown as { m?: ArrayLike<number> };
    self.setLocalBoneTransform(bone, t?.m ?? transform);
  };
  proxy.getLocalBoneAngles = (bone: string | number) => (typeof self.getLocalBoneAngles === 'function' ? self.getLocalBoneAngles(bone) : { x: 0, y: 0, z: 0 });
  proxy.setLocalBoneAngles = (bone: string | number, angles: Partial<Vec3Like>) => {
    if (typeof self.setLocalBoneAngles === 'function') self.setLocalBoneAngles(bone, angles);
  };
  proxy.getLocalBoneOrigin = (bone: string | number) => (typeof self.getLocalBoneOrigin === 'function' ? self.getLocalBoneOrigin(bone) : { x: 0, y: 0, z: 0 });
  proxy.setLocalBoneOrigin = (bone: string | number, origin: Partial<Vec3Like>) => {
    if (typeof self.setLocalBoneOrigin === 'function') self.setLocalBoneOrigin(bone, origin);
  };
  proxy.getBoneIndex = (name: string) => (typeof self.getBoneIndex === 'function' ? self.getBoneIndex(name) : -1);
  proxy.getBoneParentIndex = (child: string | number) => (typeof self.getBoneParentIndex === 'function' ? self.getBoneParentIndex(child) : -1);
  proxy.applyBonePhysicsImpulse = (bone: string | number | undefined, directionalImpulse: Partial<Vec2Like>, angularImpulse: Partial<Vec3Like>) => {
    if (typeof self.applyBonePhysicsImpulse === 'function') self.applyBonePhysicsImpulse(bone, directionalImpulse, angularImpulse);
  };
  proxy.resetBonePhysicsSimulation = (bone?: string | number) => {
    if (typeof self.resetBonePhysicsSimulation === 'function') self.resetBonePhysicsSimulation(bone);
  };
  proxy.getBlendShapeIndex = (name: string) => (typeof self.getBlendShapeIndex === 'function' ? self.getBlendShapeIndex(name) : -1);
  proxy.getBlendShapeWeight = (blendShape: string | number) => (typeof self.getBlendShapeWeight === 'function' ? self.getBlendShapeWeight(blendShape) : 0);
  proxy.setBlendShapeWeight = (blendShape: string | number, weight: number) => {
    if (typeof self.setBlendShapeWeight === 'function') self.setBlendShapeWeight(blendShape, weight);
  };
  proxy.playSingleAnimation = (animation: string | Record<string, unknown>, config?: Record<string, unknown>) => (typeof self.playSingleAnimation === 'function' ? self.playSingleAnimation(animation, config) : null);
  proxy.getAnimationLayerCount = () => (typeof self.getAnimationLayerCount === 'function' ? self.getAnimationLayerCount() : 0);
  proxy.getAnimationLayer = (nameOrIndex: string | number) => (typeof self.getAnimationLayer === 'function' ? self.getAnimationLayer(nameOrIndex) : null);
  proxy.createAnimationLayer = (animation: string | Record<string, unknown>) => (typeof self.createAnimationLayer === 'function' ? self.createAnimationLayer(animation) : null);
  proxy.destroyAnimationLayer = (animationLayer: string | number | unknown) => (typeof self.destroyAnimationLayer === 'function' ? self.destroyAnimationLayer(animationLayer) : false);
  proxy.getTransformMatrix = () => {
    const m = new Array<number>(16).fill(0);
    m[0] = self.scaleX;
    m[5] = self.scaleY;
    m[10] = 1;
    m[15] = 1;
    const cos = Math.cos(self.rotation);
    const sin = Math.sin(self.rotation);
    const sx = m[0];
    const sy = m[5];
    m[0] = sx * cos;
    m[1] = sx * sin;
    m[4] = -sy * sin;
    m[5] = sy * cos;
    m[12] = self.x;
    m[13] = self.y;
    m[14] = 0;
    return makeScriptMat4(m);
  };
  proxy.getTextureAnimation = () => {
    const player = self._spritesheetPlayer;
    if (!player) return null;
    return {
      get frame() { return player.currentFrame ?? 0; },
      set frame(v: number) { if (player) (player as Record<string, unknown>).currentFrame = v; },
      get frameCount() { return player.frameCount ?? 1; },
      play: () => { if (typeof player.play === 'function') player.play(); },
      stop: () => { if (typeof player.stop === 'function') player.stop(); },
      pause: () => { if (typeof player.pause === 'function') player.pause(); },
      isPlaying: () => (typeof player.isPlaying === 'function' ? player.isPlaying() : false),
      getFrame: () => player.currentFrame ?? 0,
      setFrame: (frame: number) => { if (typeof player.setFrame === 'function') player.setFrame(frame); else (player as Record<string, unknown>).currentFrame = frame; },
      get rate() { return (player as unknown as { rate?: number }).rate ?? 1; },
      set rate(v: number) { (player as unknown as { rate?: number }).rate = v; },
      get fps() { return (player as unknown as { fps?: number }).fps ?? 30; },
      get duration() { return (player as unknown as { duration?: number }).duration ?? 0; },
      get name() { return 'texture_animation'; },
    };
  };
  if (self.constructor.name === 'ImageLayer') {
    Object.defineProperties(proxy, {
      size: {
        get: () => ({ x: self.width, y: self.height }),
      },
      perspective: {
        get: () => Boolean(self._perspective ?? false),
        set: (v: unknown) => { self._perspective = Boolean(v); },
      },
      solid: {
        get: () => Boolean(self._solid ?? true),
        set: (v: unknown) => { self._solid = Boolean(v); },
      },
    });
    proxy.getEffectCount = () => {
      const pipeline = self._effectPassConfigs;
      return Array.isArray(pipeline) ? pipeline.length : 0;
    };
    proxy.getEffect = (nameOrIndex: string | number) => {
      const list = self._effectPassConfigs ?? [];
      let index = -1;
      if (typeof nameOrIndex === 'number') index = nameOrIndex;
      else index = list.findIndex((item: any) => item?.effectName === nameOrIndex);
      if (index < 0 || index >= list.length) return null;
      const effectName = list[index]?.effectName ?? `effect_${index}`;
      const createMaterialProxy = (mat: IMaterial | null): Record<string, unknown> | null => {
        if (!mat) return null;
        return new Proxy<Record<string, unknown>>({}, {
          get(_target, prop) {
            if (typeof prop !== 'string') return undefined;
            return mat.getUniform(prop);
          },
          set(_target, prop, value) {
            if (typeof prop !== 'string') return true;
            mat.setUniform(prop, value as any);
            return true;
          },
        });
      };
      return {
        visible: true,
        name: effectName,
        getMaterialCount: () => 1,
        getMaterial: () => createMaterialProxy(self._effectPipeline?.getMaterial?.(index) ?? null),
        setMaterialProperty: (propertyName: string, value: unknown) => {
          const mat = self._effectPipeline?.getMaterial?.(index);
          if (mat) mat.setUniform(propertyName, value as any);
        },
        executeMaterialFunction: () => undefined,
      };
    };
  }
  return proxy;
}
