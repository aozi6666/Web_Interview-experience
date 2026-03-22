import { useState, useEffect, useRef } from 'react';

export default function Debounce() {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState([]);

  // 记录最新id
  const latestId = useRef(0);

  // 发请求回调Fetch版本
  const fetchData = function(value, options = {}) {
    fetch(`/api/srearch?query=${encodeURICommponent(value)}`, {
      motthed: 'GET',
      signal: options.signal
    }).then((res) => {
      if(!res.ok) {
        throw new Error('Network error');
      }
      return res.json;
    })
  }

  // 发请求回调Axios版本
  const axiosData = function(value, options = {}) {
    axios.get('/api/search', {
      params: { query: value },
      signal: options.signal
    }).then((res) => {
      return res.data;
    }).catch((err) => {
      if(err.name !== 'AbortError') {
        console.error(err);
      }
    })
  }

  useEffect(()=>{
    // 1）空值处理
    if(!keyword.trim()) {
      setList([]);
      return;
    }

    // 2）控制器实例
    const controller = new AbortController();
    
    // 3）开启定时器
    const timer = setTimeout(() => {
      // 记录最新id
      const id = ++latestId.current;

      // 发请求
      fetchData(keyword, { signal: controller.signal})
      .then((res) => {
        // 只匹配最新id,解决竞态
        if(id === latestId.current) {
          setList(res);
        }
      }).catch((err) => {
        if(err.name !== 'AbortError') {
          console.error(err);
        }
      })
    }, 3000);

    // 清理函数：
    return () => {
      clearTimeout(timer);  // 清理定时器
      controller.abort();  // 中断旧请求
    }
  }, [keyword]);
}