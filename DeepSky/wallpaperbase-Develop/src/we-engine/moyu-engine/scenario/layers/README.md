# 图层系统 (Layers)

图层是引擎渲染的基本单元。每种类型的壁纸内容（图片、视频、粒子、文本等）对应一种图层实现。引擎按依赖拓扑 + z-index 排序后逐层渲染。

## 目录结构

```
layers/
├── Layer.ts               # 图层基类
├── ImageLayer.ts          # 图片/精灵图层（含多 Pass 特效管线、Puppet 动画）
├── VideoLayer.ts          # 视频图层
├── ParticleLayer.ts       # 粒子图层
├── PuppetLayer.ts         # Puppet Warp 骨骼动画图层
├── EffectLayer.ts         # 纯特效图层（compose/fullscreen 后处理）
├── TextLayer.ts           # 文本图层
├── ScriptLayerProxy.ts    # 脚本 thisLayer 代理对象构建
├── SharedUniforms.ts      # 共享 Uniform 注入（光照等）
└── particle/              # 粒子子系统
    ├── ParticleTypes.ts           # 粒子类型定义（Particle、EmitterConfig 等）
    ├── ControlPointManager.ts     # 控制点管理
    ├── EventFollowSystem.ts       # 事件跟随系统（鼠标追踪）
    ├── ParticleEmitter.ts         # 粒子发射逻辑
    ├── ParticleEmissionSystem.ts  # 固定速率 & 鼠标跟随发射
    ├── ParticleOperators.ts       # 操作器（fade/size/color change 等）
    ├── ParticleUpdateSystem.ts    # 每帧更新前置处理
    ├── ParticleSimLoop.ts         # 粒子模拟主循环
    ├── ParticleSimulator.ts       # 帧信息管理
    ├── ParticleVisuals.ts         # 视觉效果（alpha fade 等）
    ├── NoiseUtils.ts              # 噪声工具（turbulence 用）
    ├── SpriteRenderer.ts          # Sprite 粒子渲染
    ├── RopeRenderer.ts            # Rope/Trail 粒子渲染
    └── index.ts
```

## Layer 基类

所有图层继承 `Layer`，实现标准生命周期：

```
initialize(backend, engine)  →  update(deltaTime)  →  getRenderObjects()  →  dispose()
```

### 关键属性

| 属性 | 说明 |
| --- | --- |
| `id` / `name` | 标识与名称 |
| `zIndex` | 渲染顺序 |
| `visible` / `opacity` | 可见性与透明度 |
| `transform` | LayerTransform（位置、缩放、旋转、锚点） |
| `parallaxDepth` | 视差深度 `[x, y]`，乘以引擎的 parallaxDisplacement 计算偏移 |
| `renderPhase` | `Normal` 或 `PostProcess`，决定在哪个渲染阶段绘制 |

### 渲染阶段 (RenderPhase)

- `Normal` — 大部分图层，渲染到主场景
- `PostProcess` — compose/fullscreen 类型图层，在场景捕获之后渲染，可访问 `_rt_FullFrameBuffer`

### 脚本集成

每个图层可携带 `ScriptProgram`（由 `ScriptEngine` 编译的壁纸自定义脚本），在 `update` 时调用 `script.update()`，并通过 `dispatchScriptEvent` 接收输入/媒体等事件。

## 图层类型详解

### ImageLayer

最复杂的图层类型，承担了 WE 中 image object 的所有功能：

- **基础渲染** — 加载纹理，创建 PlaneGeometry + SpriteMaterial 进行贴图渲染
- **特效管线** — 通过 `EffectPipeline` 支持任意数量的效果 Pass（shake、pulse、water ripple、depth parallax 等），每个 Pass 是一个着色器渲染操作，通过 FBO ping-pong 链式处理
- **Spritesheet** — 支持精灵表动画（来自 TEX 的 TEXS 段），自动按帧率切换帧
- **Puppet 动画** — 当提供 MDL mesh 数据时，替换平面为骨骼网格，运行 `PuppetAnimator` 驱动骨骼动画和蒙皮变形
- **copybackground** — 将当前已渲染的场景内容复制为自身纹理（用于折射等效果）
- **脚本绑定** — Uniform 值可通过 `PropertyScriptBinding` 与壁纸脚本/用户属性双向绑定
- **Timeline 绑定** — Uniform 值可绑定 `TimelineAnimation` 进行时间轴驱动

### VideoLayer

从 URL 或 TEX 内嵌视频创建 `<video>` 元素，使用 `createVideoTexture` 逐帧更新纹理。支持循环播放、静音控制。

### ParticleLayer

完整的 GPU 粒子系统：

- **发射器** — 支持 `rate`（持续发射）和 `instantaneous`（瞬发）模式，支持 box / sphere 形状、方向约束
- **初始化器** — `lifetimerandom` / `sizerandom` / `velocityrandom` / `colorrandom` / `alpharandom` / `rotationrandom` / `turbulentvelocityrandom` 等
- **操作器** — `movement`（重力+阻力）/ `alphafade` / `sizechange` / `colorchange` / `turbulence` / `vortex` / `controlpointattract` / `angularmovement` / `oscillate*` 等
- **控制点** — 支持鼠标锁定、世界空间偏移
- **渲染器** — `sprite`（Instanced Mesh 批量渲染）/ `rope`（细分线条）/ `spritetrail`（拖尾）
- **折射** — 粒子可携带法线贴图实现背景折射效果
- **子粒子** — 支持嵌套子粒子系统

### PuppetLayer

专用于 Puppet Warp 动画的图层（当需要独立于 ImageLayer 使用时）。接收 MDL 解析后的 mesh/bone/animation 数据，驱动骨骼动画。

### EffectLayer

不持有自身纹理，而是对已渲染的场景内容执行后处理效果。对应 WE 中的 `composelayer` 和 `fullscreenlayer` 对象。

### TextLayer

使用 Canvas 2D API 渲染文本到纹理，再作为普通 sprite 渲染。支持文本内容和字号配置。

## 粒子子系统 (particle/)

粒子系统的核心模拟循环：

```
每帧 update:
  1. ParticleEmissionSystem  — 根据 rate/instantaneous 计算需要发射的粒子数
  2. ParticleEmitter          — 初始化新粒子（位置/速度/大小/颜色/生命）
  3. ParticleSimLoop          — 对所有存活粒子执行操作器（movement/fade/size/turbulence/...）
  4. 移除死亡粒子
  5. SpriteRenderer / RopeRenderer — 将粒子状态写入 Instanced Mesh 数据
```

### 渲染策略

- **Sprite** — 使用 `InstancedMesh`，每个粒子一个实例，通过 instance attribute 传递变换矩阵、透明度、帧索引、颜色
- **Rope** — 将粒子串联为折线，细分后构建 strip mesh
- **Refraction** — 粒子可附加法线贴图，通过特殊的折射材质扭曲背后场景
