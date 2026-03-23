import { use, useRef, useState } from "react";

export default function ScrollList(){
    // 当前已经有的列表数据
    const [list, setList] = useState([]);
    // 展示当前页
    const [page, setPage] = useState(1);
    // 是否还有后续数据
    const [hasMore, setHasMore] = useState(true);
    // 状态-异步锁：表示正在发请求（用来触发 UI 更新）
    const [loading, setLoading] = useState(false);
    // 同步锁：解决 无限滚动/IntersectionObserver 瞬间触发多次
    const loadingRef = useRef(false);


    // 哨兵元素的 Ref
    const Ref = useRef(null);
    // 滚动容器 的 Ref
    const containRef = useRef(null);
    // 存储最新回调函
    // 数的 Ref(只存函数)
    const loadMoreRef = useRef(() => {});
    // 首屏加载 Ref
    const firstLoadingInRef = useRef(true);

    const loadMore = async function() {
        // 防止重复请求
        if(!hasMore || !loading) return;

        try {
            // 1) 进入流程前上锁，此次请求还没处理完，下次先不要来
            loadingRef.current = true;
            setLoading(false);

            // 2) 调用接口发请求，等数据
            const data = await fetchPage(page);

            // 3) 添加 获取来的 数据（不覆盖）
            setList((prev) => {
                return [...prev, ...data];
            })

            // 4)更新状态：后续是否还有数据
            setHasMore(data.hasMore);

            // 5) 页码 + 1
            setPage((prev) => prev + 1);
        } finally {
            // 6) 处理完了 解锁
            setLoading(false);
            loadingRef.current = false;
        }


    }

    loadMoreRef.current = loadMore;

    useEffect(()=>{
        const el = Ref.current;
        if(!el) return;

        const rootEl = containRef.current;
        if(!rootEl) return;

        // 创建一个 观察器 实例对象
        const observer = new IntersectionOnserver(([entry]) => {
            if(entry.isIntersecting) {
                if(!firstLoadingInRef) {
                    loadMore.current();
                }
            }
        },{
            root: rootEl,
            rootMargin: "100px",
            threshold: 0
        })

        // 指定 观察 那个元素
        observer.observe(el);

        // 清理函数
        return () => {
            observer.disconnect();
        }

    }, [])

    return (
     <>
        <div 
            ref={containRef} 
            className="contain"
            style={{
                maxHeight: 300,
                overflow: "auto",
            }}
        >
            <ul>
                {items.map((item) => (
                    <li key={item.id}>{item.title}</li>
                ))}
            </ul>

            {/* 哨兵元素 */}
            <div ref={Ref} style={{height: 1}}/>
        </div>
     </>
    )
}