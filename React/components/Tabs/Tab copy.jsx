import { useState } from "react";

const defaultItems = [
  { key: "1", label: "Tab 1", content: "内容1" },
  { key: "2", label: "Tab 2", content: "内容2" },
  { key: "3", label: "Tab 3", content: "内容3" },
];

export default function Tab({
  items = defaultItems,
  activeKey: controlledKey,
  onChange,
  defaultActiveKey,
}) {
  // 1. 判断是否受控
  const isControlled = controlledKey !== undefined;

  // 2. 初始化：非受控状态
  const [innerKey, setInnerKey] = useState(
    defaultActiveKey ?? items[0]?.key
  );

  // 3. 获取当前选中
  const activeKey = isControlled ? controlledKey : innerKey;

  // 3. 回调
  const handleClick = function (key) {
    // 1) 若选中当前展示 key，直接返回
    if (key === activeKey) return;

    // 2) 非自控组件
    if (!isControlled) {
      setInnerKey(key);
    }

    // 3) 自控组件：交给父组件处理
    onChange?.(key);
  };

  // 4. 渲染
  const renderItem = items.find((item) => {
    return item.key === activeKey;
  });

  return (
    <>
      <div className="tab">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleClick(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="content">{renderItem?.content}</div>
    </>
  );
}
