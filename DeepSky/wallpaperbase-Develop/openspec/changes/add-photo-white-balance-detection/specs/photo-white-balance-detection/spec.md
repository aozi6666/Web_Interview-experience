## ADDED Requirements

### Requirement: System SHALL classify photo white balance state

系统必须能够对单张照片执行白平衡检测，并输出标准化结果状态。检测结果至少必须包含 `balanced`、`warm`、`cool`、`unknown` 和 `error` 五种状态之一，以便调用方统一处理。

#### Scenario: Detect balanced photo

- **WHEN** 用户打开一张可正常解码且通道偏移在平衡阈值内的照片
- **THEN** 系统返回 `balanced` 状态

#### Scenario: Detect warm photo

- **WHEN** 用户打开一张红黄倾向明显且超过暖色阈值的照片
- **THEN** 系统返回 `warm` 状态

#### Scenario: Detect cool photo

- **WHEN** 用户打开一张蓝青倾向明显且超过冷色阈值的照片
- **THEN** 系统返回 `cool` 状态

#### Scenario: Handle indeterminate photo

- **WHEN** 用户打开一张像素信息不足、内容过暗过亮或无法形成稳定判断的照片
- **THEN** 系统返回 `unknown` 状态

#### Scenario: Handle analysis failure

- **WHEN** 图片解码失败、资源无效或分析过程发生异常
- **THEN** 系统返回 `error` 状态并附带可用于记录或展示的失败原因

### Requirement: UI SHALL surface white balance analysis feedback

系统必须在照片预览或详情展示入口中向用户呈现白平衡检测反馈，并区分分析中、分析成功和分析失败等状态。该反馈不得阻塞照片浏览、选择或应用流程。

#### Scenario: Show loading feedback during analysis

- **WHEN** 白平衡检测尚未完成
- **THEN** 界面显示“分析中”或等价的处理中状态

#### Scenario: Show classified result

- **WHEN** 检测完成并得到 `balanced`、`warm` 或 `cool` 结果
- **THEN** 界面显示与结果一致的提示文案或状态标签

#### Scenario: Show indeterminate result

- **WHEN** 检测结果为 `unknown`
- **THEN** 界面提示当前照片无法可靠判断白平衡

#### Scenario: Show failure result without blocking action

- **WHEN** 检测结果为 `error`
- **THEN** 界面显示检测失败状态且用户仍可继续查看或应用该照片

