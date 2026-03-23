import { useState, useEffect, useRef } from "react";

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

export default function ScrollList() {
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const ref = useRef(null);
  const loadMoreRef = useRef(() => {});

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const data = await fetchPage(page);

    setList((prev) => [...prev, ...data.list]);
    setHasMore(data.hasMore);
    setPage((prev) => prev + 1);
    setLoading(false);
  };

  loadMoreRef.current = loadMore;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadMoreRef.current();
      }
    });

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        maxHeight: 280,
        overflow: "auto",
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
      <div ref={ref} style={{ height: 1 }} />
      {loading && <p style={{ margin: "8px 0 0", fontSize: 14 }}>加载中…</p>}
    </div>
  );
}
