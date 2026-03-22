import { useSate } from 'react'
import { func } from 'three/examples/jsm/nodes/Nodes.js';

const items = [
  { key: "1", label: "Tab 1", content: "内容1" },
  { key: "2", label: "Tab 2", content: "内容2" },
  { key: "3", label: "Tab 3", content: "内容3" },
];

export default function Tab({
  items:[],
  activekey: controllerKey,
  onchange,
  defaulatActiveKey,
}) {
  // 1. 判断是否受控
  const isControlled = controllerKey !== undefined;

  // 2. 初始化： 非受控状态
  const [innerKey, setInnerKey] = useState(
    defaulatActiveKey ?? items[0]?.key
  );

  //3. 获取当前选中
  const activeKey = isControlled ? controllerKey : innerKey;

  // 3. 回调
  const handleclick = function(key){
    // 1) 若选中当前展示 key，直接返回
    if(key === activeKey) return;

    // 2) 非自控组件
    if(!isControlled){
      setInnerKey(key);
    }

    // 3) 自控组件：交给父组件处理
    onchange?.(key);
  }

  // 4. 渲染
  const renderItem = items.find((item) => {
    return item.key === activeKey;
  }) 

  return (
    <>
    <div className="tab">
      {items.map((item) => (
        <button 
          key={item.key}
          onClick={handleclick(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
    <div className="content">
      {renderItem?.content}
    </div>
    </>
  )
}