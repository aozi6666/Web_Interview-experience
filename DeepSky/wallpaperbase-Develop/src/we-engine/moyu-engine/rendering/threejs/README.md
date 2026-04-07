# Three.js 渲染后端

`IRenderBackend` 接口的 Three.js 实现，使用 WebGL2 进行 2D 分层渲染。

## 目录结构

```
three/
├── ThreeBackend.ts                  # IRenderBackend 主实现
├── ThreeBackendHelpers.ts           # 资源创建辅助函数
├── ThreeBackendInitRuntime.ts       # 初始化/运行时环境
├── ThreeBackendLifecycle.ts         # 缓存清理/生命周期
├── ThreeSceneRenderer.ts            # 场景图渲染（遍历 RenderObject）
├── ThreeSceneCaptureRuntime.ts      # 场景捕获（render-to-texture）
├── ThreeMesh.ts                     # IMesh 实现 + PlaneGeometry 工厂
├── ThreeMeshFactory.ts              # Mesh 缓存 & 复用
├── ThreeInstancedMeshFactory.ts     # Instanced Mesh 管理（粒子渲染）
├── ThreeMaterial.ts                 # IMaterial 实现 + SpriteMaterial
├── ThreeTexture.ts                  # ITexture 实现 + VideoTexture
├── ThreeTransformApplier.ts         # 变换矩阵应用
├── ThreeEffectRenderer.ts           # 效果 Pass Fallback 材质
├── ThreeEffectPassRuntime.ts        # 效果 Pass 运行时渲染
├── ThreeBuiltinEffectMaterialFactory.ts  # 内置效果材质工厂
├── ThreeBuiltinShaders.ts           # 内置着色器代码
├── ThreeRenderTargetUtils.ts        # RenderTarget (FBO) 工具
├── ThreeShaderDiagnostics.ts        # 着色器错误诊断
└── index.ts
```

## ThreeBackend — 主实现

### 渲染管线

使用 `THREE.WebGLRenderer` + `THREE.OrthographicCamera` 进行 2D 正交渲染：

1. 接收 `ISceneGraph`（宽高 + 背景色 + RenderObject 列表）
2. 遍历 RenderObject，为每个对象获取或创建对应的 Three.js Mesh
3. 应用变换矩阵（4x4 → Three.js 的 position/rotation/scale）
4. 按 zIndex 排序后渲染

### DPR 处理

自动适配设备像素比（devicePixelRatio），默认上限为 `MAX_DPR = 2.0`。运行时的图像性能调优优先通过 `sceneCaptureScale/effectQuality`，文本清晰度不应通过降低全局 DPR 来牺牲。

### 关键方法映射

| IRenderBackend 方法 | 实现文件 | 说明 |
| --- | --- | --- |
| `init` | ThreeBackendInitRuntime | 创建 WebGLRenderer、Scene、Camera |
| `render` | ThreeSceneRenderer | 渲染场景图到屏幕 |
| `renderAndCapture` | ThreeSceneCaptureRuntime | 渲染到 FBO 并返回纹理 |
| `captureScene` | ThreeSceneCaptureRuntime | 读取当前帧为纹理 |
| `renderEffectPass` | ThreeEffectPassRuntime | 执行效果 Pass |
| `createTexture*` | ThreeBackendHelpers | 创建各类纹理 |
| `createPlaneGeometry` | ThreeMesh | 创建平面几何体 |
| `createSpriteMaterial` | ThreeBackendHelpers | 创建精灵材质 |
| `createMaterial` | ThreeBackendHelpers | 创建自定义着色器材质 |
| `createTransformMatrix` | ThreeBackendHelpers | 创建 4x4 变换矩阵 |
| `resize` | ThreeBackendHelpers | 调整渲染尺寸 |

## 资源管理

### Mesh 缓存 (ThreeMeshFactory)

为避免每帧重复创建 Three.js 对象，`getOrCreateThreeMesh` 按 RenderObject ID 缓存 `THREE.Mesh` 实例。当几何体或材质变更时自动更新。

### Instanced Mesh (ThreeInstancedMeshFactory)

粒子系统使用 `THREE.InstancedMesh` 批量渲染。`getOrUpdateInstancedMesh` 管理 instance attribute（变换矩阵、透明度、帧索引、颜色）的更新和容量扩展。

同时支持折射粒子的 `RefractionMeshCacheEntry`，使用特殊的折射材质。

### 纹理 (ThreeTexture)

`ThreeTexture` 封装 `THREE.Texture`，支持：
- 从 RGBA 数据创建
- 从 URL 异步加载
- 从 `<video>` 元素创建视频纹理（逐帧自动更新）
- 设置 premultiply alpha

### 材质 (ThreeMaterial)

`ThreeMaterial` 封装 `THREE.ShaderMaterial`，统一管理 Uniform 设置、纹理绑定、混合模式转换。

## 效果 Pass 渲染

`ThreeEffectPassRuntime` 使用全屏四边形 + 自定义 ShaderMaterial 实现效果 Pass 渲染。支持 render / copy / swap 三种命令。

内置效果（`BuiltinEffect` 枚举）通过 `ThreeBuiltinEffectMaterialFactory` 创建预定义的 ShaderMaterial。

## 着色器诊断

`ThreeShaderDiagnostics` 在着色器编译失败时输出详细错误信息（带行号的源码上下文），辅助调试 WE 着色器转译问题。
