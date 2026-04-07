# AlertDialog - 提示对话框窗口

这是一个通用的提示对话框窗口组件，支持在Electron应用内和浏览器环境中显示。

## 功能特性

- ✅ 居中的模态对话框
- ✅ 支持自定义消息内容
- ✅ 可自定义确定/取消按钮文本
- ✅ 支持自定义回调函数
- ✅ 响应式设计，支持移动端
- ✅ 支持深色主题
- ✅ 支持Electron和浏览器环境
- ✅ 动画效果

## 使用方法

### 1. Promise-based API (推荐)

最简单和直观的使用方式：

```typescript
import { showAlertDialog } from './AlertDialog/example';

// 基本使用
const result = await showAlertDialog({
  message: '确定要删除这个文件吗？',
  confirmText: '删除',
  cancelText: '取消',
  title: '确认删除',
});

if (result === 'confirm') {
  console.log('用户点击了确定按钮');
  // 执行删除操作
} else {
  console.log('用户点击了取消按钮');
  // 执行取消操作或不执行任何操作
}
```

### 2. 在React组件中使用

```typescript
import React from 'react';
import { showAlertDialog } from '../AlertDialog/example';

const MyComponent: React.FC = () => {
  const handleDelete = async () => {
    const result = await showAlertDialog({
      message: '确定要删除这个项目吗？此操作无法撤销。',
      confirmText: '确认删除',
      cancelText: '取消',
      title: '删除确认',
    });

    if (result === 'confirm') {
      // 执行删除操作
      await deleteProject();
    }
  };

  return (
    <button onClick={handleDelete}>
      删除项目
    </button>
  );
};
```

### 2. 通过URL参数传递配置

AlertDialog支持通过URL查询参数接收配置：

```
index.html?config={"message":"确定要执行此操作吗？","confirmText":"确定","cancelText":"取消","title":"提示"}
```

### 3. 跨窗口通信（Electron环境）

如果在Electron环境中，可以通过跨窗口通信来动态更新配置：

```typescript
// 在父窗口中
alertDialogWindow.webContents.send('alertDialogConfigUpdate', {
  message: '新的提示消息',
  confirmText: '是的',
  cancelText: '不用了',
});

// 在AlertDialog窗口中监听
window.electron?.getFormOtherWin('alertDialogConfigUpdate', (config) => {
  // 更新配置
});
```

### 4. 回调函数处理

AlertDialog支持两种回调方式：

1. **URL参数传递**：通过encodeURIComponent编码的JSON字符串
2. **跨窗口通信**：通过Electron的IPC机制

```typescript
// 方式1：通过全局回调
window.electron?.getFormOtherWin('alertDialogConfirm', () => {
  console.log('确认操作');
});

window.electron?.getFormOtherWin('alertDialogCancel', () => {
  console.log('取消操作');
});

// 方式2：在创建时直接传递（需要序列化）
```

## 文件结构

```
src/renderer/Windows/AlertDialog/
├── App.tsx           # 主组件
├── index.css         # 样式文件
├── index.ejs         # HTML模板
├── index.tsx         # React入口文件
└── README.md         # 使用说明
```

## 样式定制

AlertDialog使用了CSS变量，可以通过修改`index.css`来自定义样式：

- `--alert-dialog-bg`: 对话框背景色
- `--alert-dialog-shadow`: 阴影
- `--alert-dialog-border-radius`: 圆角
- `--alert-dialog-primary-color`: 主色调

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 注意事项

1. 在非Electron环境中，对话框不会自动关闭，需要手动处理
2. 回调函数无法通过URL参数直接传递，需要使用跨窗口通信
3. 窗口大小会根据内容自动调整，但有最大宽度限制
4. 支持键盘快捷键：Enter键触发确定，Escape键触发取消
