import { useState, useEffect, useRef } from 'react'

// 模拟分页请求
async function fetchPage(page) {
    await new Promise((r) => setTimeout(r, 300));

    const pageSize = 10;
    const total = 45;
    const start = (page - 1) * pageSize;
    const n = Math.max(0, Math.min(pageSize, total - start));

    return {
        list: Array.from({ length: n }, (_, i) => ({
            id: start + i + 1,
            title: `第 ${start + i + 1} 条`,
        })),
        hasMore: start + n < total,
    };
}

export default function ScrollList(){
    const [list, setList] = useState([]);
    const [page, setPage] = useState(1);
    // 状态请求锁（异步）
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // 哨兵Ref
    const botRef = useRef(null);
    // 哨兵 所在的 滚动元素的 Ref
    const fatherRef = useRef(null);
    // 存 最新函数 Ref
    const fetchRef = useRef(() => {});
    // 状态请求同步锁
    const loadingRef = useRef(false);

    // 回调：发送请求，得到新数据
    const fetchMore = async function(){

        if(loading || loadingRef.current || !hasMore){
            return;
        }

        try {
            // 1） 先上锁
            setLoading(true);
            loadingRef.current = true;

            // 2) 调用请求函数，拿最新数据
            const data = await fetchPage(page);

            // 3）更新list
            setList((prev) => {
                return [...prev, ...data.list];
            })

            // 4) 更新是否还有最新状态 与 页码 + 1
            setHasMore(data.hasMore);
            setPage((prev) => prev + 1);  
        } finally {
            // 5) 解锁
            setLoading(false);
            loadingRef.current = false;
        }
   

    } 

    fetchRef.current = fetchMore;

    // 
    useEffect(() => {
        // 1） 判断元素在不在
        const el = botRef.current;
        if(!el) return;

        // 2) 判断 滚动元素在不在
        const rootEL = fatherRef.current;

        // 创建一个 监视器对象
        const observer = new IntersectionObserver(([entry]) => {
            if(entry.isIntersecting){
                fetchRef.current();
            }
        },{
            root: rootEL,
            rootMargin: "100px",
            threshold: 0,
        })

        // 绑定 监控的Dom元素
        observer.observe(el);

        // 清理函数：
        return() => {
            // 取消 监视
            observer.disconnect();
        }
    }, [])

    return(
    <>
        <div ref={fatherRef} style={{overflow: "auto", maxHeight: 280}}>
            <ul>
                {(list.map((item) => (
                    <li key={item.id}>
                        {item.title}
                    </li>
                )))}
            </ul>
            {/* 哨兵元素（要放在滚动容器内部） */}
            <div ref={botRef} style={{ height: 1 }}></div>
        </div>
    </>
  )
}