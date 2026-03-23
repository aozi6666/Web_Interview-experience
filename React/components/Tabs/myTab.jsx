import { useState } from 'react'

const defaultItems = [
    { key: '1', label: 'Tab 1', content: 'Content 1' },
    { key: '2', label: 'Tab 2', content: 'Content 2' },
    { key: '3', label: 'Tab 3', content: 'Content 3' },
]

export default function Tab({
    items=defaultItems,
    activeKey: controllerActiveKey, 
    defaultActiveKey,
    onchange,
}){

    // 1. 判断是否受控
    const isController = controllerActiveKey !== undefined;

    // 2. 非受控组件 初始化
    const [innerKey, setInnerKey] = useState(
        defaultActiveKey ?? items[0]?.key
    );

    // 3. 获取当前选中
    const activeKey = isController ? controllerActiveKey : innerKey;

    // 4. 点击回调
    const handleChange = function(key) {
        if(key === activeKey) return;

        // 非受控更新
        if(!isController) {
            setInnerKey(key);
        }

        // 受控：交给外部组件
        onchange?.(key);
    }

    // 5.展示
    const activeItem = items.find((item) => {
        return item.key === activeKey;
    })

    return(
        <>
        <div className="bar">
          {items.map((item) => (
            <button
                key={item.key}
                type='button'
                onClick={() => handleChange(item.key)}
            >
                {item.label}
            </button>
          ))}
        </div>

        <div className="content">
            {activeItem?.content}
        </div>
        </>
    )


}