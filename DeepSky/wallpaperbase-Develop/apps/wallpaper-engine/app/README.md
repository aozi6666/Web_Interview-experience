# 应用层 (App)

Electron + Web 渲染入口、调试 UI 和壁纸浏览/生成工具。

## 目录结构

```
app/
├── main.ts                    # Electron 主进程
├── preload.ts                 # Electron 预加载脚本 (contextBridge)
├── renderer.ts                # Web 渲染器入口（主页面逻辑）
├── generator.ts               # 角色生成器页面
├── generator-assets.ts        # 生成器资源目录
└── inspector/                 # 数据查看器
    ├── Inspector.ts           #   Inspector 主控制器
    ├── SceneTreeView.ts       #   场景树组件
    ├── DetailPanel.ts         #   详情面板（属性/纹理/Mesh/特效查看）
    ├── EffectPipelineView.ts  #   特效管线可视化
    ├── LayerRenderPreview.ts  #   图层渲染预览
    ├── MeshPreview.ts         #   Mesh 线框预览
    └── TexturePreview.ts      #   纹理预览
```

## renderer.ts — 主渲染器

Web 入口页面的核心逻辑，管理整个应用的状态和交互：

### 功能

- **引擎初始化** — 创建 `Engine` + `ThreeBackend`，绑定到 Canvas
- **壁纸加载** — 通过 `WEScene` 加载 WE 壁纸（支持从 URL 参数、对话框选择、壁纸浏览器加载）
- **壁纸浏览器** — 调用 `/api/wallpapers` 获取 `resources/wallpapers/` 下的壁纸列表，以卡片网格展示，支持搜索和预览
- **角色调试面板** — 当检测到 CharacterLayer 时显示调试面板，可调节参数（眨眼、嘴型、头部角度等）
- **数据查看器** — 切换 `DataModelInspector` 的显示/隐藏
- **窗口管理** — Canvas 自适应 Resize、帧率显示

### 壁纸加载流程

```
用户交互 → loadWallpaper(path)
  ↓
engine.clearLayers()
  ↓
WEScene.load(path) → 自动解析 + 构建所有图层
  ↓
engine.start()
  ↓
refreshInspector() — 更新调试面板
```

## main.ts — Electron 主进程

标准 Electron 主进程：

- 创建 `BrowserWindow`（1280×720，可调整大小）
- 开发模式加载 `http://localhost:5173`，生产模式加载打包后的 `index.html`
- 注册 IPC 处理器：文件对话框（`dialog:openWallpaper`）、文件系统操作（`fs:readFile` / `fs:exists` / `fs:readdir`）、路径操作

## preload.ts — Electron 预加载

通过 `contextBridge` 暴露安全的 API 到渲染进程：
- `electronAPI.dialog` — 打开文件/文件夹对话框
- `electronAPI.fs` — 文件读取/存在性检查/目录读取
- `electronAPI.path` — 路径拼接/解析

## generator.ts — 角色生成器

独立页面（`index-generator.html`），用于交互式组装和预览 2D 角色：

- 从 `AssetCatalog` 选择各部位（body/face/eyes/mouth/hair 等）
- 实时预览角色渲染效果
- 支持自动眨眼动画
- 可调节角色参数

## inspector/ — 数据查看器

强大的运行时调试工具，以侧边面板形式展示：

### DataModelInspector

主控制器，管理面板的显示/隐藏、拖拽移动、数据刷新。

### SceneTreeView

树形展示场景结构：
- Scene 根节点 — 显示壁纸标题和属性
- Layer 节点 — 按渲染顺序列出所有图层
- Effect 节点 — 图层下的效果 Pass

### DetailPanel

选中树节点后显示的详情面板，根据选中类型展示不同内容：

| 类型 | 展示内容 |
| --- | --- |
| Scene | 场景配置（分辨率、背景色、相机参数） |
| Properties | project.json 用户属性列表 |
| Layer | 图层属性（位置/尺寸/可见性/混合模式/纹理预览） |
| Effect | 特效管线可视化（Pass 列表、FBO 状态） |
| Texture | 纹理预览（实际渲染的纹理内容） |
| Mesh | Mesh 线框预览（顶点/索引数据可视化） |
| JSON | 原始 JSON 数据查看 |

### EffectPipelineView

可视化展示特效管线的 Pass 链：每个 Pass 的效果名称、着色器信息、FBO 绑定关系。

### LayerRenderPreview

使用 `engine.captureLayerPreview()` 截取单个图层的渲染结果，展示在独立的 Canvas 中。

### MeshPreview

使用 Canvas 2D API 绘制 Mesh 的线框预览（顶点位置 + 三角形连线 + UV 映射），用于调试 Puppet Warp 网格。
