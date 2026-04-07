# 角色系统 (Character)

参数驱动的 2D 角色渲染系统，支持多部件组合、变形器、自动动画（呼吸/眨眼）、物理模拟，以及 Spine 格式导入。

## 目录结构

```
character/
├── types.ts                  # 类型定义（CharacterDef, PartDef, ParameterDef 等）
├── CharacterBuilder.ts       # 角色构建器（DrawOrder 排序）
├── CharacterLayer.ts         # 角色图层（Layer 子类）
├── ParameterManager.ts       # 参数管理器
├── PartManager.ts            # 部件管理器
├── DeformerSystem.ts         # 变形器系统
├── AutoAnimator.ts           # 自动动画（呼吸、眨眼等）
├── PhysicsSystem.ts          # 角色物理模拟
├── importers/
│   ├── NativeCharacterLoader.ts  # 原生角色格式加载
│   ├── SpineImporter.ts          # Spine JSON 导入
│   └── SpineAdapter.ts           # Spine → CharacterDef 适配
└── index.ts
```

## 核心架构

### CharacterDef — 角色定义

角色的完整描述数据，格式无关：

```typescript
CharacterDef {
  meta: CharacterMeta            // 名称、版本、尺寸
  parameters: ParameterDef[]     // 参数列表（每个参数有 id/min/max/default）
  parts: PartDef[]               // 部件列表（每个部件有 mesh/texture/deformers/zIndex）
  drawOrder: DrawOrderDef[]      // 绘制顺序（slot → zIndex 映射）
  animations: CharacterAnimationDef[]  // 动画列表
  physics?: PhysicsGroupDef[]    // 物理组（可选）
}
```

### CharacterLayer — 角色图层

继承 `Layer` 基类，管理角色的完整运行时：

```
initialize:
  CharacterBuilder.build(characterDef)
  → 创建 Skeleton
  → 加载各 Part 的纹理 / Mesh / 材质
  → 初始化 ParameterManager / PartManager / DeformerSystem / AutoAnimator / PhysicsSystem

update(deltaTime):
  1. AutoAnimator.update()        — 驱动呼吸、眨眼等自动动画，更新参数值
  2. Animation.evaluate()          — 评估当前动画关键帧，更新骨骼/参数
  3. PhysicsSystem.simulate()     — 物理骨骼模拟
  4. ParameterManager.flush()     — 确保参数值同步
  5. DeformerSystem.apply()        — 根据参数值计算每个部件的顶点变形
  6. 更新每个 Part 的 IMesh 顶点数据

getRenderObjects():
  → 按 drawOrder 排列各 Part 的 RenderObject
```

## 子系统详解

### ParameterManager — 参数管理

维护角色所有参数的当前值。参数可被动画、脚本、自动动画或用户交互修改。参数值变更后通过 `DeformerSystem` 驱动顶点变形。

### PartManager — 部件管理

管理角色的可见部件列表。支持动态显示/隐藏部件（如切换嘴型、换装等）。每个部件对应一个 `PartDef`，包含独立的 mesh、纹理和变形器绑定。

### DeformerSystem — 变形器

核心变形逻辑：每个部件可绑定多个 `DeformerBinding`，每个绑定关联一个参数和一组 `KeyformDef`（关键帧变形数据）。运行时根据参数当前值在关键帧间插值，计算顶点偏移量。

```
DeformerBinding:
  parameterId → 关联参数
  keyforms: [
    { paramValue: 0.0, vertexDeltas: Float32Array },
    { paramValue: 0.5, vertexDeltas: Float32Array },
    { paramValue: 1.0, vertexDeltas: Float32Array },
  ]
```

### AutoAnimator — 自动动画

提供预设的自动行为：

- **呼吸** — 周期性缩放参数
- **眨眼** — 随机间隔触发眼睛参数变化
- 可配置 `BlinkConfig`（间隔范围、持续时间）

### PhysicsSystem — 角色物理

对标记为物理骨骼的节点执行弹簧-阻尼模拟，实现头发、衣物等柔体效果。参照 `PhysicsGroupDef` 配置。

## 导入器

### NativeCharacterLoader

从项目自定义的原生格式加载角色定义。

### SpineImporter + SpineAdapter

从 Spine 导出的 JSON 数据导入角色：

1. `SpineImporter` — 解析 Spine JSON 格式（骨骼、动画、皮肤、附件等）
2. `SpineAdapter` — 将 Spine 数据结构适配为统一的 `CharacterDef`

支持的 Spine 功能：骨骼层级、网格附件（mesh attachment）、区域附件（region attachment）、皮肤、动画（骨骼变换+变形关键帧）。
