# 骨骼动画系统 (Animation)

负责 2D 骨骼动画、蒙皮变形和时间轴动画，主要用于 Wallpaper Engine 的 Puppet Warp 功能。

## 目录结构

```
animation/
├── Bone.ts                    # 骨骼节点
├── Skeleton.ts                # 骨骼层级结构
├── SkinWeights.ts             # 蒙皮权重
├── DeformMesh.ts              # 变形网格
├── Animation.ts               # 动画剪辑、控制器、插值
├── PuppetAnimator.ts          # Puppet 动画驱动器（总调度）
├── AnimationLayerController.ts # 多层动画混合控制
├── BlendRuleSystem.ts         # 动画混合规则
├── BoneConstraint.ts          # 骨骼约束配置
├── BonePhysics.ts             # 骨骼物理模拟
├── IKSolver.ts                # 反向动力学求解器
├── MorphTargetSystem.ts       # 变形目标（Blend Shape）
├── TimelineAnimation.ts       # 通用时间轴动画
└── index.ts
```

## 核心概念

### Bone — 骨骼节点

每个骨骼持有本地变换（位置、旋转、缩放）和指向父骨骼的引用。通过递归计算得到世界变换矩阵。

```
Bone:
  localMatrix: float[16]   // 来自 MDL MDLS 段
  parentIndex: number       // -1 表示根骨骼
  worldMatrix: float[16]   // localMatrix × parent.worldMatrix
```

### Skeleton — 骨骼层级

管理一组 `Bone`，维护层级关系，提供批量更新世界矩阵的方法。支持从 WE MDL 数据构建。

### SkinWeights — 蒙皮权重

每个顶点关联最多 4 个骨骼的权重（来自 MDL 顶点数据中的 `blendIndices` + `blendWeights`）。`createSkinWeightsFromWE` 工厂方法直接从 MDL 数据创建。

### DeformMesh — 变形网格

持有可变形的顶点缓冲区。每帧根据骨骼世界矩阵 + 蒙皮权重计算变形后的顶点位置，更新到后端 `IMesh`。

### Animation — 动画剪辑

- `AnimationClip` — 一段动画数据：包含多条 `AnimationTrack`（每条对应一个骨骼的某个属性），每条 Track 含若干 `Keyframe`
- `AnimationController` — 管理动画状态机：播放、暂停、切换、混合
- `AnimationState` — 运行时动画状态：当前时间、循环、速度
- `InterpolationType` — 关键帧插值类型（线性/步进等）

### PuppetAnimator — Puppet 动画总调度

将上述组件串联的高层驱动器：

```
PuppetAnimator.update(deltaTime):
  1. AnimationLayerController.evaluate() → 按混合规则计算各骨骼的动画输出
  2. BonePhysics.simulate()              → 物理骨骼的弹簧/摆动模拟
  3. IKSolver.solve()                    → IK 约束求解
  4. Skeleton.updateWorldMatrices()       → 递归计算世界矩阵
  5. DeformMesh.deform()                 → 蒙皮变形 + MorphTarget 叠加
  6. 更新后端 IMesh 顶点数据
```

### AnimationLayerController — 多层动画混合

支持多个动画层同时播放，通过 `BlendRuleSystem` 决定每个骨骼受哪些动画层影响及权重。可实现身体/头部分区动画等效果。

### BonePhysics — 骨骼物理

基于弹簧-阻尼模型的骨骼物理模拟，用于实现头发、裙摆等柔体效果。每个骨骼可配置 `BoneSimulationType`（摆动/弹簧等）。

### IKSolver — 反向动力学

CCD/Two-Bone IK 求解器，支持将骨骼末端约束到目标位置（如鼠标位置、附着点等）。

### MorphTargetSystem — 变形目标

来自 MDL 的 Morph Target 数据（Post-Index 段），存储每个目标的顶点偏移量。运行时按权重混合叠加到基础网格上。

### BlendRuleSystem — 混合规则

定义骨骼级别的动画混合权重规则，控制哪些骨骼参与哪个动画层的混合。

### BoneConstraint — 骨骼约束

约束配置：限制骨骼的旋转范围、位置范围等，防止物理模拟或 IK 产生不合理的姿态。

### TimelineAnimation — 时间轴动画

通用的基于时间轴的数值动画系统（不限于骨骼），可用于相机 Intro 动画、Uniform 值驱动等场景。支持多种时间轴模式和控制点插值。

## 数据来源

主要从 WE MDL 二进制文件解析：

- **MDLV** — 顶点和索引数据 → `DeformMesh`
- **MDLS** — 骨骼层级 → `Skeleton` / `Bone`
- **MDLA** — 关键帧动画 → `AnimationClip`
- **Post-Index** — 变形目标 → `MorphTargetSystem`
- **MDAT** — 附着点 → 父子挂载用
