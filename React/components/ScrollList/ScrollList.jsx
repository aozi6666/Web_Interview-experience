import { useState, useEffect, useRef } from "react";

// 请求 分页接口
async function fetchPage(page) {
    // 实际发请求：假装请求花了 300ms
    await new Promise((r) => setTimeout(r, 300));


    // 假设接口返回的数据如下
    // 每页固定 10 条
    const pageSize = 10;
    // 总共只有 45 条
    const total = 45;
    // 根据 page传来的参数 算出这页从 哪条list开始
    // 例如 第3页 从 page = 3，start = 20 开始
    const start = (page - 1) * pageSize;
    // 算出这一页真正能返回多少条（最后一页是 total - start 条）
    const n = Math.max(0, Math.min(pageSize, total - start));

    return {
        // 返回这页数据
        list: Array.from({ length: n }, (_, i) => ({
            id: start + i + 1,
            title: `第 ${start + i + 1} 条`,
        })),
        // 布尔判断：是否还有更多
        hasMore: start + n < total,
    };
}

export default function ScrollList() {
    
    // 存储 已经加载出来的 数据列表（页面当前已经展示了哪些内容）
    const [list, setList] = useState([]);
    // 存当前 要请求 第几页（下一次请求要拿哪一页）
    const [page, setPage] = useState(1);
    // 状态： 是不是有一个请求正在进行。防止 重复请求
    const [loading, setLoading] = useState(false);
    const loadingRef = useRef(false);
    // 是否还需要继续加载下一页
    const [hasMore, setHasMore] = useState(true);

    /* 
        “底部哨兵元素ref”：
            - 页面最底下有一个小元素，observer 专门盯着它
            - 当这个元素进入 可视区 时，就说明用户滚到接近底部了，可以加载更多。
    */
    const ref = useRef(null);

    // 解决闭包 的关键：永远让 loadMoreRef.current 指向“最新版本的 loadMore 函数”
    const loadMoreRef = useRef(() => {});

    // 首屏自动加载期间：避免 observer 立即触发重复请求第一页
    const firstLoadInFlightRef = useRef(false);

    // 回调：“加载下一页”
    const loadMore = async function() {
        // 防止重复请求
        // 当前正在加载 或者 已经到最后一页了 => 直接返回
        if (loadingRef.current || loading || !hasMore) return;
        
        try {
             // 1）先上锁： 下一轮先别来
            loadingRef.current = true;
            setLoading(true);
            // 2）通过 fetchPage接口，获取当前页数据 
            const data = await fetchPage(page);

            // 3）添加 新数据 到 旧数据后（拼接，非覆盖）
            setList((prev) => [...prev, ...data.list]);
            // 4）更新状态：是否还有 更多数据
            setHasMore(data.hasMore);
            // 5）页码加 1 （函数式更新）
            setPage((prev) => prev + 1);
        } finally {
             // 6）处理完了，解锁
            setLoading(false);
            loadingRef.current = false;
        }
    };

    /*
        解决闭包 的关键：永远让 loadMoreRef.current 指向“最新版本的 loadMore 函数”
            - observer 只创建一次，但 loadMore 每次 render 都会更新。
            - 确保让 observer 永远调用到最新的 loadMore（避免 闭包拿旧状态）
            - 把最新函数放到 ref.current 里
    */
    // 替代 回调loadMore
    loadMoreRef.current = loadMore;

    // 首屏自动触发第一次加载（最小改动）
    useEffect(() => {
        firstLoadInFlightRef.current = true;
        (async () => {
            try {
                await loadMoreRef.current();
            } finally {
                firstLoadInFlightRef.current = false;
            }
        })();
    }, []);

    // 只在挂载的时候，执行一次：创建 observer，观察'底部哨兵'元素
    useEffect(() => {
        // 取 底部 “哨兵元素”
        const el = ref.current;
        if (!el) return;

        // 创建一个 
        // 盯着底部 “哨兵元素” ，一旦它进入可视区域，就 触发加载更多 回调
        // [entry]: observer 回调拿到的是数组，只取第一个观察项
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                // 本质："最新的" 回调函数 loadMore()
                // 避免 闭包拿旧状态 
                if (firstLoadInFlightRef.current) return;
                loadMoreRef.current();
            }
        }, { root: null, rootMargin: "100px", threshold: 0 });

        // observer 实例对象方法：浏览器观察这个元素
        observer.observe(el);  

        // 清理函数：组件卸载，断开观察
        return () => observer.disconnect();
    }, []);

    return (
        <div
        style={{
            maxHeight: 280,  // 固定高度
            overflow: "auto",  // 内部滚动
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
        }}
        >
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {list.map((item) => (
            <li key={item.id} style={{ padding: "6px 0" }}>
                {item.title}
            </li>
            ))}
        </ul>

        {/* 关键：“哨兵元素” （不展示，只受 浏览器 监控） */}
        <div ref={ref} style={{ height: 1 }} />

        {/* 如果正在加载，显示“加载中…” */}
        {loading && <p style={{ margin: "8px 0 0", fontSize: 14 }}>加载中…</p>}
        </div>
    );
}
