import { useState } from 'react'

export default function Form({}){
    // 状态: 表单更新状态，错误信息状态(都是对象)
    const [form, setForm] = useState({name: ''});
    const [errors, setErrors] = useState({});

    // 回调：表单变化，只做更新
    const handleChagne = function(e) {
        // 更新 form 对象结构
        setForm((prev) => ({
            ...prev,
            [e.target.name] : e.target.value
        }));
    }

    // 回调：校验
    const vaildate = function() {
        // 1) 创建 错误对象结构
        const errs = {};

        // 2) 错误类型收集
        if(!form.name.trim()){
            errs.name = '必填'
        }
        if(!form.email.trim()) {
            errs.email = '请输入有效邮箱'
        }

        // 3）错误对象放进 状态
        setErrors(errs);

        // 返回 布尔值
        return Object.keys(errs).length === 0;
    }
    // 回调： 表单提交
    const handleSubmit = function(e) {
        // 1）阻止默认行为：浏览器刷新
        e.preventDefault();

        // 2) 表单校验(回调函数)
        if(!vaildate()) {
            // 不通过
            return;
        }

        // 3) 真正提交逻辑
        console.log(form.name);
        alert('提交成功')
    }

    return(
    <>
        <div className="content">
            <form onSubmit={(e) => {handleSubmit(e)}}>
                <input
                    name='name'
                    value={form.name}
                    onChange={(e) => handleChagne(e)}
                    placeholder='请输入姓名'
                >
                </input>
                {errors.name && <p>{errors.name}</p>}
                {/* 提交按钮 */}
                <button type="submit"></button>
            </form>
        </div>
    </>
    )
}