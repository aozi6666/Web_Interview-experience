/* 
    防抖搜索：关键 ”竞态问题“
        - 问题定义：
             用户快速输入：a → ab → abc，请求顺序可能会错乱
             abc 先返回，ab 后返回（覆盖掉最新结果）
*/
import { useState, useEffect } from 'react' 
import axios from 'axios';

export default function Debounce() {
    // keyword: 👉 搜索关键词
    const [ keyword, setKeyword] = useState('');
    // list: 👉 接口返回的数据列表
    const [list, setList] = useState([]);


     // 只手写 debounce function函数
     function debounce(fn, delay) {
        let timer = null;

        return function(...args) {
            // 清空已有计时器
            clearTimeout(timer);

            // 开启新计时器
            timer = setTimeout(() => {
                fn.apply(this, args);
            },delay)
        }
     }

      /* 
            用户输入：a → ab → abc
            前端请求：/api/search?q=abc 
            后端返回：
            [
                { id: 1, name: 'abc1' },
                { id: 2, name: 'abc2' }
            ]
        */
    // fetchData: 👉 发请求的回调函数(原生fetch)
    const fetchData0 = (value: string) => {
        return fetch(`/api/search?q=${value}`, {
            method: 'GET'
        }).then(res => res.json())
        .catch(err => {
            console.error(err);
        })
    }
    // fetchData: 👉 发请求的回调函数(Axios)
    const fetchData = (value: string) => {
        return axios.get('/api/search', {
            params: { q: value }
        }).then(res => res.data);
    }

    // 1）常规
    useEffect(() => {
        const timer = setTimeout(() => {
            // fetchData: 👉 发请求的回调函数
            fetchData(keyword).then(res => {
                // res: 👉 根据 keywords 从后端返回的数据，存到 list 数组中
                // setList(res) 是把接口返回的数据同步到 组件状态state，驱动 UI 渲染
                setList(res);
            }).catch(err => {
                console.error(err);
            })
        },3000)

        // 清理函数：防止内存泄露
        return () => {
            clearTimeout(timer);
        }
    }, [keyword])

    console.log(list,debounce(fetchData,3000),setKeyword,fetchData0);
}