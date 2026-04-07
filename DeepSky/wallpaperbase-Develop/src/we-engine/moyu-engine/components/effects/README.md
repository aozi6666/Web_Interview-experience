# 特效管线 (Effects)

管理图层级别和全局级别的后处理效果，基于 FBO（Frame Buffer Object）多 Pass 渲染。

## 目录结构

```
effects/
├── EffectPipeline.ts      # 多 Pass 特效管线
├── FBORegistry.ts         # 全局 FBO 注册表
├── BloomPostProcessor.ts  # Bloom 后处理
├── AudioAnalyzer.ts       # 音频 FFT 分析
├── AudioDataProvider.ts   # 音频数据提供器（供脚本/Uniform）
├── SpritesheetPlayer.ts   # 精灵表动画播放器
└── index.ts
```

## EffectPipeline — 多 Pass 特效管线

WE 壁纸中的每个图片对象可以附带多个效果（shake、pulse、water ripple、depth parallax、shine 等）。每个效果由一个或多个 `GenericEffectPassConfig` 描述：

```
GenericEffectPassConfig:
  effectName       — 效果名称（用于调试）
  vertexShader     — 顶点着色器 GLSL 源码
  fragmentShader   — 片段着色器 GLSL 源码
  builtinEffect    — 或使用内置效果枚举
  uniforms         — Uniform 值表
  binds            — 纹理槽绑定（FBO 名称 → 纹理槽索引）
  command          — 'render' | 'copy' | 'swap'
  target           — 目标 FBO 名称
```

### 渲染流程

```
基础纹理 (baseTexture)
  ↓
Pass 0 [effectName=shake, target=_rt_imageLayerComposite]
  — 将 baseTexture 绑定到 g_Texture0，渲染到 FBO A
  ↓
Pass 1 [command=copy]
  — 将 FBO A 的内容复制到 FBO B
  ↓
Pass 2 [effectName=pulse, binds={1: "_rt_imageLayerComposite"}]
  — 从 FBO B 读取，渲染到 FBO A
  ↓
...
  ↓
最终 FBO → 作为图层纹理输出
```

### FBO 管理

每个 `EffectPipeline` 实例维护自己的 FBO 集合。FBO 尺寸可通过 `scale` 参数缩小（如 0.5 = 半分辨率），用于高斯模糊等需要多级降采样的效果。

### Uniform 系统

每个 Pass 的 Uniform 可以来自：
- 静态配置值
- 脚本绑定 (`ScriptBindingConfig`) — 壁纸脚本实时修改
- 时间轴绑定 (`TimelineAnimation`) — 基于时间自动变化
- 引擎内置值 — `g_Time`、`g_Texture0Resolution`、`g_PointerPosition` 等

## FBORegistry — 全局 FBO 注册表

全局单例，管理跨图层/跨效果共享的命名纹理：

| 纹理名称 | 用途 |
| --- | --- |
| `_rt_FullFrameBuffer` | 场景捕获后的完整帧缓冲纹理 |
| `_rt_FullFrameBuffer_preBloom` | Bloom 处理前的原始场景纹理 |
| `_rt_AlbumCover` | 媒体专辑封面纹理 |
| `_rt_AlbumCoverPrevious` | 上一张媒体封面纹理 |
| 自定义名称 | 效果自定义 FBO（如 `_rt_imageLayerComposite`） |

图层效果 Pass 可通过 `binds` 引用这些全局纹理。

## BloomPostProcessor — Bloom 后处理

全局级别的 Bloom 效果，在普通图层渲染完成后执行：

1. 亮度提取（threshold 过滤）
2. 多级高斯模糊（可配 HDR 迭代次数）
3. 叠加回原场景

配置参数：`strength` / `threshold` / `tint` / HDR 相关（`hdrEnabled` / `hdrFeather` / `hdrIterations` / `hdrScatter` / `hdrStrength` / `hdrThreshold`）。

## AudioAnalyzer — 音频分析

连接 `HTMLMediaElement` 或 `MediaStream`，使用 Web Audio API 的 `AnalyserNode` 进行 FFT 分析：

- 提供 64-band 频谱数据（left/right/average）
- 支持测试模式（生成模拟频谱）
- 通过 `AudioDataProvider` 向脚本和 Uniform 暴露音频数据

## SpritesheetPlayer — 精灵表动画

播放 TEX 文件中 TEXS 段定义的精灵表动画。根据每帧的 `frametime` 推进动画，计算当前帧的 UV 偏移和缩放，更新到材质 Uniform。
