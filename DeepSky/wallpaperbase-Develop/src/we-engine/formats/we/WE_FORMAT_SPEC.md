# Wallpaper Engine (WE) 格式规范

本文档基于当前仓库中的解析器实现与样本资源整理，覆盖：

- 二进制：`PKG` / `TEX` / `MDL`
- JSON：`project.json` / `scene.json` / `effect.json` / `material.json` / `model.json` / 粒子配置
- 着色器：WE 自定义 GLSL 方言
- 字段级别语义、数据类型与单位说明

主要实现来源：

- `PkgLoader.ts` — PKG 容器解包
- `texture/TexLoader.ts` — TEX 纹理容器解析
- `texture/DXTDecoder.ts` — DXT 块压缩软件解码
- `texture/TexDecodePaths.ts` — 纹理解码路径分发
- `texture/TexImageProcessor.ts` — 图像数据后处理
- `mdl/MdlLoader.ts` — MDL 模型解析入口
- `mdl/MdlSectionParser.ts` — MDL 各段（MDLV/MDLS/MDAT/MDLA）解析
- `mdl/MdlMeshParser.ts` — MDL 顶点/索引数据解析
- `mdl/MdlAnimationParser.ts` — MDL 动画关键帧解析
- `particle/ParticleConfigLoader.ts` — 粒子 JSON 配置解析
- `particle/ParticleConfigSections.ts` — 粒子配置各区块解析
- `scene/WallpaperLoader.ts` — 壁纸加载总入口
- `scene/SceneObjectDispatcher.ts` — 场景对象分发
- `scene/ImageObjectLoader.ts` — 图片对象加载（含效果/着色器）
- `scene/EffectLoader.ts` — 效果 JSON 加载与着色器转译
- `shader/ShaderTranspiler.ts` — WE 着色器转译总入口
- `shader/ShaderTransform.ts` — WE → WebGL 语法转换
- `shader/ShaderPreprocessor.ts` — 预处理器（combo 条件编译）
- `shader/ShaderMetadataParser.ts` — 着色器元数据解析（combo/纹理/uniform）
- `types.ts` — WE JSON Schema 类型定义

---

## 1. 资源目录结构

典型壁纸目录（Workshop ID）：

```text
{workshopid}/
  project.json
  preview.jpg|png|gif
  scene.pkg
  scene.json                  (有些资源直接提供)
  extracted/                  (PKG 解包后)
    scene.json
    models/*.json
    effects/**/effect.json
    particles/**/*.json
    materials/**/*.json
    materials/**/*.tex
    shaders/**/*.frag|vert
    *.tex
    *.mdl
```

---

## 2. 二进制格式

## 2.1 PKG (`PKGV0023`)

用途：资源归档容器。

实现：`PkgLoader.ts`

### 文件头

| 偏移 | 大小 | 类型 | 字段 | 含义 |
| --- | --- | --- | --- | --- |
| 0 | 4 | `uint32 LE` | `magicLength` | 魔数字符串长度（字节） |
| 4 | `magicLength` | `char[]` | `version` | 版本字符串，如 `PKGV0023\0` |
| `4+magicLength` | 4 | `uint32 LE` | `entryCount` | 文件条目数 |

### 条目表（重复 `entryCount` 次）

| 大小 | 类型 | 字段 | 含义 |
| --- | --- | --- | --- |
| 4 | `uint32 LE` | `nameLength` | 文件名字节长度 |
| `nameLength` | `char[]` | `name` | UTF-8 文件名 |
| 4 | `uint32 LE` | `offset` | 相对数据区起点的偏移（字节） |
| 4 | `uint32 LE` | `size` | 文件大小（字节） |

注意：解析时需要将 `offset` 加上"数据区起始偏移"得到绝对文件偏移。

---

## 2.2 TEX (`TEXVxxxx`)

用途：纹理容器，可含图片/视频或压缩像素块。

实现：`texture/TexLoader.ts` → `texture/TexDecodePaths.ts` → `texture/DXTDecoder.ts`

两类数据：

1. 嵌入 JPEG/PNG/MP4（扫描魔数）
2. `TEXI + TEXB`（结构化像素数据，支持 mipmap 与 LZ4）

### TEXV 头部

| 偏移 | 大小 | 字段 | 含义 |
| --- | --- | --- | --- |
| 0-3 | 4 | `magic` | `TEXV` |
| 4-7 | 4 | `version` | 如 `0005` |
| 8 | 1 | `null` | `\0` |

### TEXI

| 偏移（相对 TEXI） | 大小 | 类型 | 字段 | 含义/单位 |
| --- | --- | --- | --- | --- |
| 0-3 | 4 | `char[]` | `magic` | `TEXI` |
| 4-7 | 4 | `char[]` | `version` | 如 `0001` |
| 8 | 1 | - | `null` | 终止符 |
| 9 | 4 | `int32 LE` | `texFormat` | 像素格式枚举 |
| 13 | 4 | `int32 LE` | `texFlags` | 标志位（`bit0` 常表示有动画帧信息） |
| 17 | 4 | `int32 LE` | `textureWidth` | GPU 纹理宽度（像素） |
| 21 | 4 | `int32 LE` | `textureHeight` | GPU 纹理高度（像素） |
| 25 | 4 | `int32 LE` | `imageWidth` | 实际图像宽度（像素） |
| 29 | 4 | `int32 LE` | `imageHeight` | 实际图像高度（像素） |
| 33 | 4 | `int32 LE` | `unknown` | 未知字段 |

### `texFormat` 映射

| 值 | 格式 | 说明 |
| --- | --- | --- |
| 0 | RGBA8888 | 4 通道 8-bit |
| 2 | DXT3/BC2 | 块压缩，16 字节/4x4 |
| 3 | DXT1/BC1 | 块压缩，8 字节/4x4 |
| 4 | DXT5/BC3 | 块压缩，16 字节/4x4 |
| 5 | RGB888 | 3 通道 8-bit |
| 6 | RGB565 | 16-bit（5:6:5） |
| 7 | DXT1/BC1 | 与 3 同类 |
| 8 | RG88 | 双通道 |
| 9 | R8 | 单通道 |
| 10 | RG1616f | 双通道 half float |
| 11 | R16f | 单通道 half float |
| 12 | DXT1/BC1 变体 | 与 3 同类 |
| 15 | RGBA16161616f | 4 通道 half float |

### TEXB

| 偏移（相对 TEXB） | 大小 | 类型 | 字段 | 含义 |
| --- | --- | --- | --- | --- |
| 0-3 | 4 | `char[]` | `magic` | `TEXB` |
| 4-7 | 4 | `char[]` | `version` | `0001`/`0002`/`0003`/`0004` |
| 8 | 1 | - | `null` | 终止符 |
| 9 | 4 | `int32 LE` | `imageCount` | 图像数量 |
| 13 | 4* | `int32 LE` | `imageFormat` | 仅 v0003/v0004 |
| 17 | 4* | `int32 LE` | `isVideo` | 仅 v0004 |
| var | 4 | `int32 LE` | `mipmapCount` | mip 层级数（合理范围 1-16） |

#### Mipmap 头

- v0001：每层 12 字节
  - `width:int32`（像素）
  - `height:int32`（像素）
  - `compressedSize:int32`（字节）
- v0002+：每层 20 字节
  - `width:int32`（像素）
  - `height:int32`（像素）
  - `isLZ4:int32`（1=压缩）
  - `decompressedSize:int32`（字节）
  - `compressedSize:int32`（字节）

每层头后紧跟像素负载。

### TEXS（可选，精灵表动画）

| 偏移 | 大小 | 类型 | 字段 | 单位 |
| --- | --- | --- | --- | --- |
| 0-3 | 4 | `char[]` | `magic`=`TEXS` | - |
| 4-7 | 4 | `char[]` | `version`=`0002/0003` | - |
| 8 | 1 | - | `null` | - |
| 9 | 4 | `int32 LE` | `frameCount` | 帧 |
| 13 | 8* | `u32+u32` | `gifWidth/gifHeight` | 像素（仅 v0003） |

每帧 32 字节：

| 偏移 | 类型 | 字段 | 单位 | 含义 |
| --- | --- | --- | --- | --- |
| 0 | `uint32` | `frameNumber` | 帧号 | 帧索引 |
| 4 | `float32` | `frametime` | 秒 | 该帧持续时间 |
| 8 | `float32` | `x` | 像素 | 帧区域左上角 x |
| 12 | `float32` | `y` | 像素 | 帧区域左上角 y |
| 16 | `float32` | `width1` | 像素 | 帧宽 |
| 20 | `float32` | `width2` | 像素 | 额外宽字段 |
| 24 | `float32` | `height2` | 像素 | 额外高字段 |
| 28 | `float32` | `height1` | 像素 | 帧高 |

---

## 2.3 MDL (`MDLVxxxx`) - Puppet Warp

用途：2D 骨骼网格（顶点、骨骼、附着点、动画）。

实现：`mdl/MdlLoader.ts` → `mdl/MdlMeshParser.ts` / `mdl/MdlSectionParser.ts` / `mdl/MdlAnimationParser.ts`

### 已知版本

| 版本 | 特点 |
| --- | --- |
| v0016 | 最早版本。stride=52，无 morph target，无 bone partition，MDLS 版本为 `MDLS0002` |
| v0019 | 扩展头部，materialPath 后增加 7 DWORD metadata |
| v0021 | 新增 Post-Index 数据段（morph target + bone partition），新 stride 80/84 |
| v0023 | bone partition 后增加额外 `uint32` trailing |

### 整体布局

```text
┌─── MDLV Header ───────────────────────────────────────────┐
│ CHAR[]   magic         "MDLVxxxx\0" (9 bytes)             │
│ UINT32   headerFlag    通常 0x01800009                    │
│ UINT32   meshCount     通常 1                             │
│ UINT32   unknown1      通常 1                             │
│ CHAR[]   materialPath  null-terminated                    │
│ ── v0019+ ──                                              │
│ UINT32[7] metadata     全零填充 (28 bytes)                │
│ ── v0016 ──                                               │
│ UINT32    padding      (4 bytes)                          │
│ ───────────                                               │
│ UINT32   vertexFormat  步幅描述符                          │
│ UINT32   vertexByteLength                                 │
└───────────────────────────────────────────────────────────┘
┌─── Vertex Data ───────────────────────────────────────────┐
│ BYTE[vertexByteLength]  (stride × vertexCount)            │
└───────────────────────────────────────────────────────────┘
┌─── Index Data ────────────────────────────────────────────┐
│ UINT32   indicesByteLength                                │
│ UINT16[] indices                                          │
└───────────────────────────────────────────────────────────┘
┌─── Post-Index Data (v0021+ only) ────────────────────────┐
│ UINT8    morphTargetCount                                 │
│ [per target: UINT32 unk + UINT32 byteLen + data]          │
│ Bone Partition:                                           │
│   UINT8  flag (0x01)                                      │
│   UINT32 partitionByteLength                              │
│   BYTE[] partitionData                                    │
│   [v0023+: UINT32 trailing]                               │
└───────────────────────────────────────────────────────────┘
┌─── MDLS Section (骨骼) ───────────────────────────────────┐
│ CHAR[]   "MDLSxxxx\0"                                     │
│ UINT32   byteLength                                       │
│ UINT32   numBones                                         │
│ BONEENTRY[numBones]                                       │
│ BONE2ENTRY[numBones]  (每个 9 bytes)                      │
└───────────────────────────────────────────────────────────┘
┌─── MDAT Section (附着点, optional) ──────────────────────┐
│ CHAR[]   "MDATxxxx\0"                                     │
│ ...                                                       │
└───────────────────────────────────────────────────────────┘
┌─── MDLA Section (动画, optional) ────────────────────────┐
│ CHAR[]   "MDLAxxxx\0"                                     │
│ ...                                                       │
└───────────────────────────────────────────────────────────┘
```

### MDLV Header

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `magic` | 9 | `char[]` | `MDLVxxxx\0`，xxxx 为版本号（如 `0016`/`0021`/`0023`） |
| `headerFlag` | 4 | `uint32 LE` | 通常 `0x01800009`，用于步幅回退 |
| `meshCount` | 4 | `uint32 LE` | 网格数量，通常 1 |
| `unknown1` | 4 | `uint32 LE` | 通常 1 |
| `materialPath` | var | `char[]\0` | null 终止的材质文件路径 |

materialPath 后的头部字段因版本而异：

#### v0019+ 头部（含 v0021、v0023）

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `metadata[7]` | 28 | `uint32[7]` | 全零填充 |
| `vertexFormat` | 4 | `uint32 LE` | 顶点布局标识 |
| `vertexByteLength` | 4 | `uint32 LE` | 顶点区总字节 |

#### v0016 头部

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `padding` | 4 | `uint32 LE` | 填充 |
| `vertexFormat` | 4 | `uint32 LE` | 顶点布局标识（与 headerFlag 相同） |
| `vertexByteLength` | 4 | `uint32 LE` | 顶点区总字节 |

### vertexFormat 与步幅映射

| vertexFormat | stride (字节) | 出现版本 | 说明 |
| --- | --- | --- | --- |
| `0x01800009` | 52 | v0016 | 旧格式：blend 数据从偏移 12 开始 |
| `0x0180000f` | 80 | v0021+ | 新格式：blend 数据从偏移 40 开始 |
| `0x0181000e` | 84 | v0021+ 变体 | 同 80 的布局，多 4 字节未知字段 |

当 vertexFormat 不在已知映射中时，解析器按 80→84→52 的优先级尝试匹配 `vertexByteLength % stride == 0` 来推断步幅。

### 顶点

`vertexCount = vertexByteLength / stride`

通用语义：

- 位置单位：像素（图像中心坐标系）
- UV：归一化坐标 `[0,1]`，**V 轴翻转**（读取后执行 `v = 1.0 - v`）
- 骨骼权重：无量纲（0..1）
- UV 总是位于每个顶点的最后 8 字节（偏移 `stride - 8`）

#### stride=52 (v0016)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
| --- | --- | --- | --- | --- |
| 0 | 12 | `float32 x3` | `posX, posY, posZ` | 像素坐标 |
| 12 | 16 | `uint32 x4` | `blendIndices[4]` | 骨骼索引（低 16 位有效） |
| 28 | 16 | `float32 x4` | `blendWeights[4]` | 混合权重 |
| 44 | 8 | `float32 x2` | `u, v` | UV 坐标（v 需翻转） |

#### stride=80 (v0021+)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
| --- | --- | --- | --- | --- |
| 0 | 12 | `float32 x3` | `posX, posY, posZ` | 像素坐标 |
| 12 | 28 | - | 未知字段 | 可能包含法线/切线等 |
| 40 | 16 | `uint32 x4` | `blendIndices[4]` | 骨骼索引（低 16 位有效） |
| 56 | 16 | `float32 x4` | `blendWeights[4]` | 混合权重 |
| 72 | 8 | `float32 x2` | `u, v` | UV 坐标（v 需翻转） |

#### stride=84 (v0021+ 变体)

与 stride=80 相同的 blend 数据偏移，末尾多 4 字节，UV 位于偏移 76。

### 索引

| 字段 | 类型 | 单位 |
| --- | --- | --- |
| `indicesByteLength` | `uint32 LE` | 字节 |
| `indices` | `uint16[]` | 顶点索引 |

每 3 个索引形成一个三角形。解析时过滤退化三角形（索引越界或两个以上索引相同）。

### Post-Index 数据（仅 v0021+）

v0016 没有此段，索引数据后直接是 MDLS。

#### Morph Targets

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `morphTargetCount` | 1 | `uint8` | morph target 数量（0 = 无） |

每个 morph target：

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `unknown` | 4 | `uint32 LE` | 未知 |
| `byteLength` | 4 | `uint32 LE` | 数据字节长度 |
| `vertexData` | `byteLength` | `float32[]` | 每顶点 3 个 float（x, y, z 偏移），共 `vertexCount * 12` 字节 |

#### Bone Partition

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `flag` | 1 | `uint8` | 固定 `0x01` |
| `partitionByteLength` | 4 | `uint32 LE` | 分区数据长度 |
| `partitionData` | `partitionByteLength` | `byte[]` | 分区数据（内部结构未完全解析） |
| `trailing` | 4* | `uint32 LE` | **仅 v0023+**，额外 4 字节 |

注意：若 Post-Index 解析后未找到 MDLS 标记，解析器会向前扫描最多 256 字节定位 MDLS。

### MDLS（骨骼）

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `header` | 9 | `char[]` | `MDLSxxxx\0`（v0016 为 `MDLS0002`） |
| `byteLength` | 4 | `uint32 LE` | 段长度（**注意**：实现发现此值可能是绝对文件偏移而非相对长度，解析器会同时尝试两种解释） |
| `numBones` | 4 | `uint32 LE` | 骨骼数量 |

每骨骼（BONEENTRY）：

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `tmpByte` | 1 | `uint8` | 未知 |
| `boneType` | 4 | `uint32 LE` | 骨骼类型 |
| `parentIndex` | 4 | `int32 LE` | 父骨骼索引，`-1` 表示根骨骼 |
| `entryByteLen` | 4 | `uint32 LE` | 后续数据长度（通常 64 = 16 floats） |
| `localMatrix` | `entryByteLen` | `float32[]` | 本地 4x4 变换矩阵（列主序，最多 16 个 float） |
| `name` | var | `char[]\0` | 骨骼名称（null 终止） |

`localMatrix` 的关键元素：
- `[12]` = localX（像素）
- `[13]` = localY（像素）

世界坐标计算：`worldPos = parent.worldPos + [localX, localY]`

#### 骨骼名称扩展

骨骼名称可以是 JSON 格式字符串（以 `{` 开头），包含额外配置：

```json
{"name": "hair_01", "stiffness": 0.5, "drag": 0.1, "simulationType": "pendulum"}
```

解析器会提取 `name`/`boneName`/`displayName` 作为显示名称，并解析约束参数（`BoneConstraintConfig`）用于物理模拟。

#### BONE2ENTRY

所有 BONEENTRY 之后紧跟 `numBones` 个 BONE2ENTRY，每个 9 字节。内部结构未完全解析，解析时直接跳过。

### MDAT（附着点，可选）

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `header` | 9 | `char[]` | `MDATxxxx\0` |
| `byteLength` | 4 | `uint32 LE` | 段长度 |
| `numAttachments` | 2 | `uint16 LE` | 附着点数量 |
| `unknown` | 2 | `uint16 LE` | 保留 |

每附着点：

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `name` | var | `char[]\0` | 附着点名称 |
| `matrix` | 64 | `float32[16]` | 4x4 变换矩阵，`[12]`=localOffX, `[13]`=localOffY（像素） |
| `boneIndex` | 1 | `uint8` | 关联的骨骼索引 |
| `padding` | 1 | `uint8` | 填充 |

附着点世界坐标 = `bone[boneIndex].worldPos + [localOffX, localOffY]`。

### MDLA（动画，可选）

#### 段头

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `header` | 9 | `char[]` | `MDLAxxxx\0`（版本号影响动画间隔解析） |
| `byteLength` | 4 | `uint32 LE` | 段长度（同 MDLS，可能为绝对偏移） |
| `animCount` | 4 | `uint32 LE` | 动画数量 |

#### 每个动画

| 字段 | 大小 | 类型 | 含义 |
| --- | --- | --- | --- |
| `animId` | 4 | `uint32 LE` | 动画 ID（在 scene.json `animationlayers` 中引用） |
| `flags` | 4 | `uint32 LE` | 标志（通常 0） |
| `name` | var | `char[]\0` | 动画名称 |
| `extra` | var | `char[]\0` | 附加标签（如 `mirror`） |
| `fps` | 4 | `float32 LE` | 帧率（帧/秒，合理范围 0-120） |
| `numFrames` | 4 | `uint32 LE` | 动画帧数（不含 rest pose，总帧数 = numFrames + 1） |
| `unk0` | 4 | `uint32 LE` | 保留 |
| `numBones` | 4 | `uint32 LE` | 声明的骨骼数量 |
| `unk1` | 4 | `uint32 LE` | 保留 |
| `totalKF` | 4 | `uint32 LE` | 骨骼-帧对总数 |

#### totalKF 与实际骨骼数

**重要发现**：`totalKF` 不一定等于 `numBones * totalFrames`。实际参与动画的骨骼数需要通过计算得出：

```
actualAnimBones = round(totalKF / totalFrames)
loopBones = min(numBones, actualAnimBones)
```

关键帧数据的实际大小为 `loopBones * totalFrames * 9 * 4` 字节。

#### 关键帧数据布局

关键帧采用 **bone-major** 排列——同一骨骼的所有帧连续存储：

```
offset = ((boneIndex * totalFrames + frameIndex) * 9) * 4
```

每个骨骼每帧占 9 个 `float32`（36 字节）。

#### 字段移位规则（Shift）

9 个浮点中的逻辑字段需要经过循环移位才能正确读取：

```
shift = (boneIndex * 2) % 9
logicalField(i) = rawData[(shift + i) % 9]
```

移位后的逻辑字段：

| 逻辑索引 | 字段 | 类型 | 单位 | 说明 |
| --- | --- | --- | --- | --- |
| 0 | `posX` | `float32` | 像素 | 相对骨骼本地位置 X |
| 1 | `posY` | `float32` | 像素 | 相对骨骼本地位置 Y |
| 2 | 未使用 | - | - | |
| 3 | 未使用 | - | - | |
| 4 | `activeFlag` | `float32` | - | `< 0.5` 表示该骨骼帧有效数据 |
| 5 | `rotation` | `float32` | 弧度 | |
| 6 | `scaleX` | `float32` | 无量纲 | 同时作为 scaleY 使用 |
| 7 | 未使用 | - | - | |
| 8 | 未使用 | - | - | |

注意：`scaleY` 在当前实现中始终等于 `scaleX`（非独立值）。

#### activeFlag 语义

WE 动画写入器只写入"激活"骨骼帧，未激活帧包含内存残留数据。`activeFlag < 0.5` 表示该帧有效。解析后的 `cleanAnimationData` 会将无效的 rest pose 回退到骨骼本地位置和默认缩放。

#### 帧 0 = Rest Pose

`frameIndex = 0` 存储 rest pose（初始姿态），后续帧 `1..numFrames` 为动画帧。

#### 动画间尾部数据

多个动画之间存在尾部数据，大小取决于 MDLA 段版本：

| MDLA 版本 | 尾部公式 |
| --- | --- |
| v ≤ 3 | `numBones * 8 + 1` 字节 |
| v ≤ 5 | `numBones * 8 + 26` 字节 |
| v > 5 | `numBones * 8 + 27` 字节 |

解析器通过启发式搜索定位下一个动画头部（验证 `flags=0`、`animId` 合理、`fps` 在合理范围内等特征）。

---

## 3. JSON 格式

## 3.1 `project.json`

用途：壁纸元数据、用户属性定义。

关键字段：

- `file:string` 入口文件（如 `scene.json`）
- `type:'scene'|'video'|'web'|'application'`
- `title:string`
- `description?:string`
- `preview?:string`
- `version?:number`
- `workshopid?:string`
- `visibility?:string`
- `contentrating?:string`
- `tags?:string[]`
- `general.properties?:Record<string, WEProperty>`

`WEProperty` 常见字段：

- `type`：`slider`/`color`/`bool`/`combo`/`text` 等
- `value`：数值/布尔/字符串
- `text`：UI 文案或本地化 key
- `min,max`：滑条范围
- `options`：组合框选项

颜色值在实现中兼容：

- `#RRGGBB` / `#RGB`
- `"r g b"`（整数模式通常视为 0..255，浮点模式视为 0..1）

---

## 3.2 `scene.json`

用途：场景主配置（对象、相机、通用参数）。

实现：`scene/WallpaperLoader.ts` → `scene/SceneSetup.ts` + `scene/SceneObjectDispatcher.ts`

顶层常见字段：

- `version:number`
- `camera:{center,eye,up}`（每项为 `[x,y,z]`）
- `clearcolor:string`（通常 `"r g b"`）
- `general:{...}`（全局效果/投影/相机参数）
- `objects:Record<string, object>`

### `general` 常见字段与单位

- `ambientcolor:string`：颜色
- `bloom:boolean`
- `bloomstrength:number`：Bloom 强度（无量纲，默认 2.0）
- `bloomthreshold:number`：Bloom 阈值（0..1，默认 0.65）
- `bloomtint:string`：Bloom 色调
- `bloomhdr:boolean`：HDR Bloom 开关
- `bloomhdrfeather:number`：HDR 羽化（默认 0.1）
- `bloomhdriterations:number`：HDR 迭代次数（默认 8）
- `bloomhdrscatter:number`：HDR 散射（默认 1.619）
- `bloomhdrstrength:number`：HDR 强度（默认 2.0）
- `bloomhdrthreshold:number`：HDR 阈值（默认 1.0）
- `camerafade:boolean`
- `cameraparallax:boolean`
- `cameraparallaxamount:number`：无量纲强度
- `cameraparallaxdelay:number`：平滑延迟（秒）
- `cameraparallaxmouseinfluence:number`：鼠标影响系数
- `camerashake:boolean|{user,value}`
- `camerashakeamplitude:number`：0..1 振幅
- `camerashakeroughness:number`：无量纲
- `camerashakespeed:number`：无量纲速度系数
- `orthogonalprojection:boolean|{width,height}`：像素尺寸
- `zoom:number`：无量纲缩放
- `nearz:number`：近裁面
- `farz:number`：远裁面

### `objects` 中单对象常见字段与单位

- `id:number`：层排序标识
- `name:string`
- `origin:[x,y,z] | "x y z"`：场景像素坐标
- `size:[w,h] | "w h"`：像素尺寸
- `scale:[sx,sy,sz] | "sx sy sz"`：无量纲倍率
- `angles:[rx,ry,rz] | "rx ry rz"`：角度（度）
- `alpha:number`：0..255
- `visible:boolean|{user,value}`
- `image:string`：资源路径
- `model:string`：模型配置路径（model.json）
- `blend:string`：混合模式（`normal`/`translucent`/`additive` 等）
- `color:string|obj`
- `brightness:number`：常见 0..1
- `colorBlendMode:number`：混合枚举（0-28，用于着色器 BLENDMODE combo）
- `parallaxDepth:[x,y]`：无量纲
- `parent:number`：父对象 ID
- `attachment:string`：附着点名
- `copybackground:boolean`
- `solid:boolean`
- `alignment:string`
- `dependencies:number[]`
- `effects:object[]`：效果列表（每项含 `file` 指向 effect.json，`passes` 覆盖）
- `particle:object`：粒子对象
- `sound:object[]`：声音对象
- `text:string`：文本内容
- `script:object`：脚本配置（含 `file` 路径和 `scriptProperties`）

---

## 3.3 `effect.json`

用途：后处理/局部效果定义。

实现：`scene/EffectLoader.ts`

常见字段：

- `version:number`
- `replacementkey:string`（着色器 key）
- `name,description,group,preview`
- `editable:boolean`
- `passes:[]`
- `fbos:[]`
- `dependencies:string[]`

`passes[]` 每项：

- `material:string`
- `target:string`（目标 FBO）
- `command:string`（`copy` / `swap` / `render`）
- `bind:[{name,index}]`（纹理槽绑定）

`fbos[]` 每项：

- `name:string`
- `scale:number`（1.0=全分辨率，0.5=半分辨率）
- `format:string|number`

---

## 3.4 `material.json`

用途：材质 pass 及着色器参数。

结构：

- `passes: Array<pass>`

`pass` 常见字段：

- `shader:string`
- `textures:string[]`
- `blending:string`（`normal`/`translucent`/`additive`/`disabled`）
- `cullmode:string`
- `depthtest:string`
- `depthwrite:string`
- `combos:Record<string,number>`
- `constantshadervalues:Record<string,number|string|...>`

---

## 3.5 `model.json`

用途：图层模型绑定（材质、尺寸、puppet）。

常见字段：

- `material:string`
- `autosize:boolean`
- `fullscreen:boolean`
- `solidlayer:boolean`
- `passthrough:boolean`
- `width:number`（像素）
- `height:number`（像素）
- `cropoffset:"x y"`（像素偏移）
- `puppet:string`（MDL 路径）

---

## 3.6 粒子配置 JSON

实现：`particle/ParticleConfigLoader.ts` → `particle/ParticleConfigSections.ts`

顶层字段：

- `maxcount:number`：最大粒子数
- `material:string`
- `sequencemultiplier:number`
- `animationmode:string`（`sequence`/`once`/`randomframe`）
- `starttime:number`
- `children[]`
- `controlpoint[]`
- `emitter[]`
- `initializer[]`
- `operator[]`
- `renderer[]`

### `controlpoint`

- `id:number`
- `flags:number`（bit0=鼠标锁定；bit1=世界空间）
- `locktopointer:boolean`
- `offset:"x y z"`（像素）

### `emitter`

- `rate`：粒子/秒
- `instantaneous`：粒子/次（瞬发）
- `distancemax`：像素
  - `boxrandom`：半径/半宽（最终范围常为 `[-d,+d]`）
  - `sphererandom`：外圈半径
- `distancemin`：像素（球形内圈半径）
- `origin`：像素偏移
- `directions`：方向向量/约束

### `initializer` 常见类型与单位

- `lifetimerandom(min,max)`：秒
- `sizerandom(min,max,exponent)`：尺寸像素 + 分布指数
- `velocityrandom(min,max)`：像素/秒（向量）
- `colorrandom(min,max)`：常见 0..255 RGB
- `turbulentvelocityrandom(speedmin,speedmax,scale,timescale)`：速度像素/秒，scale/timescale 为无量纲
- `alpharandom(min,max)`：0..1
- `rotationrandom(min,max)`：弧度
- `angularvelocityrandom(min,max)`：弧度/秒
- `mapsequencebetweencontrolpoints`：控制点映射参数
- `mapsequencearoundcontrolpoint`：环绕控制点映射参数

### `operator` 常见类型与单位

- `alphafade(fadeintime,fadeouttime)`：生命周期比例 0..1（不是秒）
- `movement(drag,gravity)`：
  - `drag` 无量纲
  - `gravity` 像素/秒²（向量）
- `turbulence(speedmin,speedmax,timescale,scale)`：
  - speed 像素/秒
  - timescale 无量纲
  - scale 常用于噪声空间频率（近似 1/像素）
- `sizechange(start/endvalue,start/endtime)`：value 为乘数，time 为生命周期比例
- `colorchange(start/endvalue,start/endtime)`：颜色乘数 + 生命周期比例
- `alphachange(start/endvalue,start/endtime)`：透明度乘数 + 生命周期比例
- `vortex(...)`：
  - `distanceinner/outer` 像素
  - `speedinner/outer` 像素/秒
- `controlpointattract(scale,threshold)`：
  - scale 近似加速度量级（像素/秒²）
  - threshold 像素距离
- `angularmovement(force,drag)`：
  - force 弧度/秒²
  - drag 无量纲
- `oscillatealpha/size/position`：
  - `frequencymin/max`：Hz
  - `scale`：无量纲（位置模式可解释为像素偏移幅度）

### `renderer`

- `name`：`sprite` / `rope` / `spritetrail`
- `subdivision:number`：绳索细分数
- `length:number`：拖尾长度倍率
- `maxlength:number`：拖尾最大长度（像素）

---

## 4. 着色器格式

WE 使用自定义 GLSL 方言，需要转译后才能在 WebGL2 中使用。

实现：`shader/ShaderTranspiler.ts` → `shader/ShaderTransform.ts`

### 文件类型

- `.vert` — 顶点着色器
- `.frag` — 片段着色器

### WE 特有语法

| WE 语法 | 标准 GLSL 等价 | 说明 |
| --- | --- | --- |
| `attribute` | `in`（顶点着色器） | WebGL2 使用 `in/out` |
| `varying` | `out`（顶点）/ `in`（片段） | |
| `texture2D()` | `texture()` | WebGL2 统一为 `texture()` |
| `gl_FragColor` | 自定义 `out vec4` | WebGL2 需要显式声明输出 |
| `a_Position` / `a_TexCoord` | Three.js 内置 `position` / `uv` | 适配 Three.js 命名 |
| `g_ModelViewProjectionMatrix` | `projectionMatrix * modelViewMatrix` | Three.js 内置矩阵 |

### Combo 系统

着色器通过 `[COMBO]` 注释定义编译时常量：

```glsl
// [COMBO] {"material":"MY_COMBO","default":0,"range":[0,1]}
```

运行时由 `material.json` 的 `combos` 字段赋值，预处理器执行 `#if COMBO_VALUE` 条件编译。

### 常用内置 Uniform

| Uniform | 类型 | 说明 |
| --- | --- | --- |
| `g_Texture0` | `sampler2D` | 基础纹理 |
| `g_Texture0Resolution` | `vec4` | `(width, height, 1/width, 1/height)` |
| `g_Time` | `float` | 全局时间（秒） |
| `g_PointerPosition` | `vec2` | 鼠标位置（归一化 0-1） |
| `g_EffectTextureProjectionMatrix*` | `mat4` | 效果纹理投影矩阵 |
| `g_AudioSpectrum16Left/Right` | `vec4[4]` | 音频频谱数据 |

---

## 5. 用户属性绑定语法

很多 scene 字段支持绑定 project 属性：

```json
{
  "alpha": { "user": "opacity_slider", "value": 200 },
  "visible": { "user": { "name": "show_role", "condition": "..." }, "value": true }
}
```

解析规则（实现侧）：

1. 若能在 `project.json.general.properties[user]` 找到值，优先使用该值
2. 否则回退到绑定对象中的 `value`

---

## 6. 坐标系和单位总览

- 场景 2D 坐标：像素，`x` 向右、`y` 向下
- MDL 顶点/骨骼本地：像素，图像中心为原点
- UV：归一化 `[0,1]`
- 角度来源：
  - scene `angles`：度
  - 动画/粒子旋转：弧度
- 粒子速度：像素/秒
- 粒子加速度（如 gravity/attract）：像素/秒²
- 粒子生命周期时间参数（fade、change start/end）：生命比例 `0..1`，不是秒
- 透明度：
  - 场景对象常见 `alpha:0..255`
  - 粒子/材质内部常见 `0..1`

---

## 7. 备注

- 本文档是"实现一致性规范"，即以当前仓库解析器行为为准。
- 部分字段（尤其二进制保留字段）在官方未公开语义时标记为 `unknown/保留`。
- 对于未在当前实现中消费的字段，仍在表中标注其结构位置，便于后续逆向补全。
- 所有实现路径均相对于 `src/formats/we/` 目录。
