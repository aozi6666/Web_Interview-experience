# 脚本运行时 (Scripting)

沙盒化执行 Wallpaper Engine 壁纸中的自定义 JavaScript 脚本。

## 目录结构

```
scripting/
├── ScriptEngine.ts             # 脚本引擎（编译 + 执行）
├── ScriptLayerProxy.ts         # thisLayer/thisObject 代理构建（唯一实现入口）
├── ScriptVM.ts                 # 脚本编译（new Function 沙盒）
├── ScriptBuiltins.ts           # 内置对象（MediaPlaybackEvent 等）
├── ScriptSceneApiBuilder.ts    # thisScene API 构建
├── ScriptTimerManager.ts       # 定时器管理（setTimeout/setInterval 仿真）
├── PropertyScriptBinding.ts    # 属性 → Uniform 脚本绑定
├── types.ts                    # 类型定义
└── index.ts
```

## 脚本执行模型

WE 壁纸允许附加自定义 JS 脚本（通常通过 `wallpaperRegisterAudioListener`、`wallpaperRegisterMediaStatusListener` 等注册回调）。本系统在浏览器中安全执行这些脚本。

### 编译流程

```
脚本源码 (JS string)
  ↓ ScriptVM.compileScriptFactory()
  ↓ (通过 new Function 包装为闭包)
  ↓ 注入 ScriptEnv 沙盒环境
  ↓
ScriptProgram {
  init(value)                    — 初始化
  update(value)                  — 每帧调用
  dispatchEvent(name, event)    — 事件分发
  getScriptProperties()         — 获取脚本属性
}
```

### 沙盒环境 (ScriptEnv)

每个脚本运行在隔离的环境中，可访问以下对象：

| 对象 | 说明 |
| --- | --- |
| `engine` | 引擎状态（时间、分辨率、鼠标位置等） |
| `input` | 输入状态 |
| `thisLayer` | 当前图层的属性代理（可读写 position/scale/rotation/opacity 等） |
| `thisObject` | 同 thisLayer 的别名 |
| `thisScene` | 场景级 API（获取图层、创建图层、管理相机等） |
| `shared` | 跨图层共享数据 |
| `localStorage` | 持久化存储（内存模拟） |
| `console` | 控制台输出 |
| `Vec2` / `Vec3` / `Vec4` / `Mat3` / `Mat4` | 数学工具类 |
| `MediaPlaybackEvent` / `MediaPropertiesEvent` / ... | 媒体事件常量 |

说明：`ScriptLayerProxy.ts` 目前是脚本层图层代理的唯一实现入口。这里的“Proxy”强调它承担“脚本 API 适配层”职责（把 Layer 能力映射为 WE 脚本可用接口），而不是表示“有多个入口中的一个”。

### thisScene API

通过 `ScriptSceneApiBuilder` 构建，提供：

- `getLayersByName(name)` / `getLayerByName(name)` — 按名称查找图层
- `createLayer(config)` — 动态创建图层
- `removeLayer(id)` — 移除图层
- `getResolution()` — 获取场景分辨率
- `clearColor` — 背景色
- 相机/视差/Bloom 配置读写

### 事件系统

支持的脚本事件 (`ScriptEventName`)：

| 事件 | 触发时机 |
| --- | --- |
| `mouseDown` / `mouseUp` / `mouseMove` | 鼠标交互 |
| `resizeScreen` | 窗口尺寸变化 |
| `applyUserProperties` | 用户属性变更 |
| `applyGeneralSettings` | 通用设置变更 |
| `mediaPlaybackChanged` | 媒体播放状态变化 |
| `mediaPropertiesChanged` | 媒体属性变化 |
| `mediaStatusChanged` | 媒体状态变化 |
| `mediaThumbnailChanged` | 媒体封面变化 |
| `mediaTimelineChanged` | 媒体时间轴变化 |

## PropertyScriptBinding — 属性绑定

`PropertyScriptBinding` 将壁纸用户属性绑定到图层 Uniform：

```
用户属性 (project.json properties)
  ↓ 值变更
PropertyScriptBinding
  ↓ 转换（slider→float, color→vec3, bool→float 等）
Uniform 值更新
  ↓
着色器中使用
```

支持一个属性驱动多个 Uniform，以及 `condition` 条件绑定。

## ScriptTimerManager

仿真 `setTimeout` / `setInterval`，在引擎帧循环中管理定时器，避免浏览器原生定时器的精度问题。
