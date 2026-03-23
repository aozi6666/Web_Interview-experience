/* 表单：
    - 状态拆分：form 存表单值，errors 存错误信息
    - 数据流：输入时更新 form，提交时校验，校验失败更新 errors
    - 逻辑可扩展：以后加 email、phone、password 都能沿这个结构扩
*/
import { useState } from "react";

export default function Form({}) {
    // 存表单数据（用户当前输入的数据）
    // 对象式写法： 易于扩展
    const [form, setForm] = useState({ name: "" });
    // 存校验结果（当前哪里不合法）
    const [errors, setErrors] = useState({});
   
    // 回调：输入时，只更新form(不提交、不检验)
    const handleChange = (e) => {
       // e.target.name： 拿到的是输入框的名字
       // e.target.value: 拿到的是用户输入的值
        setForm((prev) => ({
          // 先保留原来的 form，再覆盖当前改动的那个字段
          ...prev,
          [e.target.name]: e.target.value,
        }));
      };

      // 校验回调
      const validate = () => {
        // 1）创建 空错误对象，收集错误
        const errs = {};
        // 2）错误类型： name 是否为空（必填）
        if (!form.name.trim()) {
          // 更新 错误对象 
          errs.name = "必填";
        }
        if (!form.email.trim()) {
          errs.email = "邮箱必填";
        }
        // 3）把错误对象存进 errors
        setErrors(errs);

        // 返回一个布尔值，表示校验是否通过
        return Object.keys(errs).length === 0;
      };
      
      // 提交回调：提交时统一校验
      const handleSubmit = (e) => {
        // 阻止：表单默认刷新，原生 <form> 提交时，浏览器会默认刷新页面
        e.preventDefault();
        // 校验不通过，不提交
        if (!validate()) return;

        // 真正的提交逻辑
        console.log(form);
        // fetch("/api/submit", { ... })  // 发请求
      };
      

      return(
        // 表单绑定提交事件: 点击"提交"按钮时，触发 handleSubmit
        <form onSubmit={handleSubmit}>
          {/* 受控输入框 */}
          <input
            name="name"
            value={form.name}  // 输入框显示的值
            onChange={handleChange}
            placeholder="请输入姓名"
          />
          {/* 错误提示按条件显示:  errors.name 有值，渲染 <p> */}
          {errors.name && <p>{errors.name}</p>}
          {/* 按钮类型是 submit,触发表单提交onSubmit  */}
          <button type="submit">提交</button>
        </form>
      )
}