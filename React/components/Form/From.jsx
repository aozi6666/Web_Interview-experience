import { useState } from "react";

export default function From({}) {
    const [form, setForm] = useState({ name: "" });
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        setForm({
          ...form,
          [e.target.name]: e.target.value,
        });
      };
      
      const validate = () => {
        const errs = {};
        if (!form.name.trim()) {
          errs.name = "必填";
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
      };
      
      const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        console.log(form);
      };
      

      return(
        <form onSubmit={handleSubmit}>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="请输入姓名"
          />
          {errors.name && <p>{errors.name}</p>}
          <button type="submit">提交</button>
        </form>
      )
}