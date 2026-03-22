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
  useEffect(() => {
    // 空值：立刻清空列表，不要等防抖；也不创建 Controller / 定时器
    if (!keyword.trim()) {
      setList([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      // 最新Id
      const id = ++latestId.current;
      // 发请求
      fetchData(keyword, { signal: controller.signal })
        .then((res) => {
          if (id === latestId.current) {
            setList(res);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error(err);
          }
        });
    }, 3000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [keyword]);
}