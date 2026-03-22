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
          defaultActiveKey="1"
        />
      </div>
    );
  }
// 受控组件： 接收 父组件 传来的 activeKey状态变量，onChange回调函数，items数组
function Tabs({ 
    items = [],   // tab 数据列表，默认空数组
    activeKey: controlledKey,  // 解构 + 重命名 
    defaultActiveKey,  // 非受控组件 的初始值
    onChange  // 父组件传下来的 回调函数（点击时，真正修改的东西让父组件来修改）
}) {
  // 1. 判断是否受控（传了 activeKey，就是受控组件）
  const isControlled = controlledKey !== undefined;

    // 2. 非受控状态(非受控：组件内部自己维护 当前选中项)
    // 传了 defaultActiveKey 就用，否则默认用第一个 tab 的 key
    /* 
       左 ?? 右:  只有左边是 null 或 undefined， 采用右边
       左 || 右:  左边是“假”（false、0 、"" 、null 、undefined 、NaN ），用右边

       items[0]?.key： 如果 items[0] 存在，就取它的 key
                       如果 items[0] 不存在，返回 undefined
    */
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

  // 展示内容：根据 activeKey 找当前内容
  // 找出那个 key 等于 activeKey 的对象，赋值给 activeItem
  const activeItem = items.find((item) => {
    return item.key === activeKey
  });

  return (
    <div>
        {/* 接收一组 items：显示一排 tab 按钮 */}
      {items.map(item => (
        <button key={item.key} onClick={() => handleClick(item.key)}>
          {item.label}
        </button>
      ))}
      <div>{activeItem?.content}</div>
    </div>
  );
}

export default Tabs;