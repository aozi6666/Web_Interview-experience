import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

export default function DebouncePlus() {
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState([]);

  // 记录最新Id
  const latestId = useRef(0);
  // 1）fetch版本请求回调：
  const fetchData = (value, options = {}) => {
    // encodeURIComponent：URL 参数进行编码，防止特殊字符出问题
    // axios 内部自动完成，不用加
    return fetch(`/api/search?query=${encodeURIComponent(value)}`, {
      method: "GET",
      // 传来监听器信息：signal, 监听 controller.abort()
      // 清理函数执行：controller.abort()， 所有绑定这个 signal 的请求 💥 立刻中断
      signal: options.signal,  
    }).then((res) => {
      if(!res.ok) {
        throw new Error("Network response was not ok.");
      }
      return res.json();
    })
  };
  // 2.axios版本请求回调：
  const fetchData2 = function (keyword, options = {}) {
    return axios
      .get("/api/search", {
      params: { query: keyword },
      signal: options.signal,
    })
      .then((res) => res.data)
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      });
  };

  // keyword 变化 -> 防抖请求 + 中断旧请求，避免竞态
  // 1）使用 AbortController
  useEffect(() => {
    // 创建 AbortController 实例
    const controller = new AbortController();

    // 开启定时器
    const timer = setTimeout(() => {
      // 空值
      if(!keyword.trim()) {
        setList([]);
        return ;
      }

      // 发请求前，最新Id
      const id = ++latestId.current;

      // 开启定时器（发请求）
      fetchData(keyword, { signal: controller.signal })
        .then((res) => {
          if(id === latestId.current) {
            setList(res);
          }
        }).catch((err) => {
          // 忽略中断错误
          if(err.name !== 'AbortError') {
            console.error(err);
          }
        })
    }, 3000)
    
    // 清理函数：
    return () => {
      clearTimeout(timer);  // 清理定时器
      controller.abort();  // 中断旧请求
    }

  }, [keyword])
}