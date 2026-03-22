import React, { useState } from "react";

/* 
    受控组件 与 非受控组件
*/

// 父组件
function App() {
    const [activeKey, setActiveKey] = useState("1");
  
    const items = [
      { key: "1", label: "Tab 1", content: "内容1" },
      { key: "2", label: "Tab 2", content: "内容2" },
      { key: "3", label: "Tab 3", content: "内容3" },
    ];
  
    return (
      <div>
        <h2>当前选中：{activeKey}</h2>
        
        {/* setActiveKey是一个函数回调 */}
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={items}
        />
      </div>
    );
  }
// 受控组件： 接收 父组件 传来的 activeKey状态变量，onChange回调函数，items数组
function Tabs({ items = [], activeKey: controlledKey, defaultActiveKey, onChange }) {
  // 1. 判断是否受控（传了 activeKey，就是受控组件）
  const isControlled = controlledKey !== undefined;

    // 2. 非受控状态(非受控：组件内部自己维护 当前选中项)
  const [innerKey, setInnerKey] = useState(
    defaultActiveKey ?? items[0]?.key
  );
 
  // 3. 获取当前选中项
  const activeKey = isControlled ? controlledKey : innerKey;
  // 回调：点击切换
  const handleClick = (newKey) => {
    if (key === activeKey) return;
   
    // 非受控：自己更新
    if (!isControlled) {
      setInnerKey(newKey);
    }
    // 通知父组件: 子组件只能“申请修改”, 让父组件去修改
    // 不是“子组件自己改完了”。子组件告诉父组件：我建议切换成 newKey
    onChange?.(newKey);
  };

  // 展示：根据 activeKey 找当前内容。
  const activeItem = items.find((item) => item.key === activeKey);

  return (
    <div className="tabs">
      <div className="tabs-nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={item.key === activeKey ? "active" : ""}
            onClick={() => handleClick(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="tabs-content">
        {activeItem ? activeItem.content : null}
      </div>
    </div>
  );
}

export default Tabs;
