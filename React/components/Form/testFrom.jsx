import {useState} from 'react'

export default function Form(){
    const [formData, setFormData] = useState({name: "", email: ""});
    const [errors, setErrors] = useState({});

    // 只更新表单，不提交
    const handleChange = function(e){
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value 
        }))
    }

    const validate = function() {
        const errs = {}

        if(!formData.name.trim()){
            errs.name = "请输入姓名"
        }
        if(!formData.email.trim()){
            errs.email = "请输入正确邮箱"
        }

        setErrors(errs);

        return object.key(errs).length === 0;
    }

    // 提交回调：
    const handleSubmit = function(e){
        e.preventDefault();
        if(!validate()) return;

        alert("提交成功")
    }
    return(
    <>
        <div className="contain">
            <form onSubmit={(e) => {handleSubmit(e)}}>
                <input
                    name={"name"}
                    value={formData.name}
                    onChange={(e) => {handleChange(e)}}
                />
                <input
                    name='email'
                    value={formData.email}
                    onChange={(e) => {handleChange(e)}} 
                />
                {errors.name && <p>{errors.name}</p>}
                <button type="submit">点击提交</button>
            </form>
        </div>
    </>
    )
}