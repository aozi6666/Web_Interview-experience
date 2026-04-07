# Wallpaper Engine 格式适配层

将 Wallpaper Engine 壁纸的文件格式（二进制 + JSON）解析、转换并适配到引擎核心的数据模型。

## 目录结构

```
we/
├── WEScene.ts                 # 对外统一入口
├── WEAdapter.ts               # WE 原始数据 → 引擎数据转换
├── PkgLoader.ts               # PKG 容器解包
├── TextureLoader.ts           # 纹理加载缓存 & URL 管理
├── LoaderTypes.ts             # 共享类型定义（SceneObject, LoadResult 等）
├── LoaderUtils.ts             # 加载工具（属性解析、颜色转换等）
├── types.ts                   # WE JSON Schema 类型（WESceneJson, WEObject 等）
├── scene/                     # 场景加载流水线
├── shader/                    # 着色器转译器
├── texture/                   # TEX 纹理解码
├── mdl/                       # MDL 模型解析
├── particle/                  # 粒子配置加载
└── index.ts
```

## 加载流程总览

```
WEScene.load(wallpaperPath)
  └─ WallpaperLoader.loadWallpaperFromPath(engine, path)
       │
       ├─ 1. 读取 project.json → 确定壁纸类型 (scene/video)
       │
       ├─ 2. 读取 scene.pkg → PkgLoader.parsePkg() 解包
       │     → 提取 scene.json、着色器文件、纹理等
       │
       ├─ 3. SceneSetup.applySceneSetup()
       │     → 配置引擎：背景色、视差、Shake、Bloom、光照、Camera Intro
       │
       ├─ 4. SceneHierarchyResolver.resolveSceneHierarchy()
       │     → 解析父子关系、附着点 → 计算世界坐标
       │     → 解析 MDL 骨骼位置用于附着点世界坐标
       │
       └─ 5. SceneObjectDispatcher.dispatchSceneObjects()
             → 按类型分发每个场景对象:
               ├─ ImageObjectLoader  → ImageLayer
               ├─ ParticleObjectLoader → ParticleLayer
               ├─ EffectObjectLoader → EffectLayer
               ├─ TextObjectLoader   → TextLayer
               └─ SoundObjectLoader  → SoundObject
```

## scene/ — 场景加载流水线

| 文件 | 职责 |
| --- | --- |
| `WallpaperLoader.ts` | 加载入口：读取 project.json → 解包 PKG → 注册着色器 include → 调度各步骤 |
| `SceneSetup.ts` | 从 scene.json `general` 字段提取引擎配置（相机/视差/Shake/Bloom/光照/Camera Intro） |
| `SceneHierarchyResolver.ts` | 解析场景对象的 parent/attachment 关系，计算世界坐标。可解析 MDL 骨骼获取附着点位置 |
| `SceneObjectDispatcher.ts` | 遍历排序后的场景对象，按类型分发到对应加载器。统计加载结果 |
| `ImageObjectLoader.ts` | 最复杂的加载器：加载 image 对象 → 加载纹理 (TEX) → 加载效果 (effect.json) → 加载着色器 → 配置特效管线 → 创建 ImageLayer |
| `ImageObjectLayerBranches.ts` | ImageObject 中不同模型类型的分支处理（fullscreen / solid / passthrough / puppet 等） |
| `EffectLoader.ts` | 加载 effect.json → 解析 Pass/FBO/bind → 加载和转译着色器 → 输出 GenericEffectPassConfig 列表 |
| `EffectObjectLoader.ts` | 加载独立 EffectObject（quad + DIRECTDRAW）并创建 EffectLayer |
| `TextObjectLoader.ts` | 加载文本对象并创建 TextLayer（含字体与脚本绑定） |
| `SoundObjectLoader.ts` | 加载并播放音频对象，维护音频清理钩子 |

### ImageObjectLoader 详细流程

```
loadImageObject(engine, pkg, obj, sceneSize, wallpaperPath)
  │
  ├─ 加载 model.json → 确定图层类型 (fullscreen/solid/passthrough/puppet/normal)
  │
  ├─ 加载纹理：
  │   ├─ 尝试 TEX 格式 → TexLoader 解码
  │   ├─ 回退到 JPEG/PNG URL
  │   └─ 检测精灵表 (TEXS) → 配置 spritesheet 参数
  │
  ├─ 加载效果:
  │   └─ 遍历 obj.effects → EffectLoader.loadWEEffectPasses()
  │       ├─ 读取 effect.json
  │       ├─ 遍历 passes → 加载 material.json → 加载着色器文件
  │       ├─ ShaderTranspiler 转译 WE GLSL → WebGL2 GLSL
  │       └─ 配置 Uniform (constantshadervalues + 内置 uniform)
  │
  ├─ 加载 Puppet 数据 (如有 MDL):
  │   └─ MdlLoader → 顶点/索引/骨骼/动画
  │
  ├─ 配置脚本绑定 (PropertyScriptBinding)
  │
  └─ 创建 ImageLayer → engine.addLayer()
```

## shader/ — 着色器转译器

将 WE 自定义 GLSL 方言转译为 WebGL2 兼容的标准 GLSL。

| 文件 | 职责 |
| --- | --- |
| `ShaderTranspiler.ts` | 转译器总入口与对外 API |
| `ShaderIncludeResolver.ts` | `#include` 解析与内联（支持缓存） |
| `ShaderMetadataParser.ts` | 解析 `[COMBO]` 注释提取 combo 默认值，解析纹理默认路径、uniform 映射 |
| `ShaderPreprocessor.ts` | 预处理器：根据 combo 值执行 `#if` / `#elif` / `#else` / `#endif` 条件编译 |
| `ShaderTransform.ts` | 核心语法转换：WE 特有语法 → 标准 GLSL（attribute/varying/内置变量映射等） |
| `ShaderSyntaxFixes.ts` | 语法修正：修复隐式类型转换、int/float 不匹配、vec 维度不匹配、unused sampler 清理等 |
| `ShaderEffectLoader.ts` | 效果着色器加载（combo 应用 + 转译） |

### 转译流程

```
WE 原始 .vert/.frag 源文件
  ↓ 1. fetchShaderSource — 从 PKG 或 assets 加载
  ↓ 2. parseComboDefaults — 提取 [COMBO] 默认值
  ↓ 3. resolveIncludes — 内联 #include
  ↓ 4. preprocessShader — combo 条件编译
  ↓ 5. transformWEToWebGL — WE → 标准 GLSL 语法转换
  ↓ 6. Syntax Fixes — 修复类型不匹配等问题
  ↓
WebGL2 兼容 GLSL（供 Three.js ShaderMaterial 使用）
```

## texture/ — TEX 纹理解码

| 文件 | 职责 |
| --- | --- |
| `TexLoader.ts` | TEX 容器解析入口（TEXV → TEXI → TEXB → TEXS） |
| `TexDecodePaths.ts` | 解码路径分发（RGBA / DXT / Half-Float / 视频嵌入等） |
| `TexImageProcessor.ts` | 图像数据后处理（缩放到实际尺寸、格式转换） |
| `DXTDecoder.ts` | DXT1/3/5 (BC1/2/3) 软件解码 |
| `TexUrlConverter.ts` | 解码结果 → Blob URL 转换 |

### TEX 格式概要

TEX 文件可能包含：
- 嵌入的 JPEG/PNG/MP4（直接扫描魔数提取）
- 结构化像素数据（TEXI 元信息 + TEXB 像素块），支持 DXT 压缩和 LZ4 压缩 mipmap
- 精灵表动画信息（TEXS 段，包含每帧的位置和持续时间）

## mdl/ — MDL 模型解析

| 文件 | 职责 |
| --- | --- |
| `MdlLoader.ts` | MDL 解析入口 |
| `MdlSectionParser.ts` | 各段（MDLV/MDLS/MDAT/MDLA）解析 |
| `MdlMeshParser.ts` | 顶点和索引数据解析（支持多种 vertexFormat / stride） |
| `MdlAnimationParser.ts` | 动画关键帧解析（含 shift 规则） |

MDL 是 WE Puppet Warp 使用的二进制模型格式。详细字段规范见 [WE_FORMAT_SPEC.md](./WE_FORMAT_SPEC.md)。

## particle/ — 粒子配置加载

| 文件 | 职责 |
| --- | --- |
| `ParticleConfigLoader.ts` | 解析粒子 JSON 配置 → `ParsedParticleConfig` |
| `ParticleConfigSections.ts` | 各配置区块解析（emitter/initializer/operator/renderer/controlpoint） |
| `ParticleObjectLoader.ts` | 从场景对象构建 `ParticleLayer` |
| `ParticleObjectStages.ts` | 加载流程各阶段（加载纹理/效果/配置组装） |

## PkgLoader — PKG 容器

解析 `PKGV0023` 格式的资源归档文件。提供：
- `parsePkg(buffer)` — 解析文件头和条目表
- `extractFile(pkg, name)` — 提取指定文件的 ArrayBuffer
- `extractJsonFile(pkg, name)` — 提取并解析 JSON 文件
- `listFiles(pkg)` — 列出所有文件名

## WEAdapter — 数据转换

将 WE 的原始数据格式（`WERawData`）转换为引擎可消费的标准结构，处理坐标系差异、单位转换等。
