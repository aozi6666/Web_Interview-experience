import { useState } from "react";

export default function ScrollList() {
    const [list, setList] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const data = await fetchPage(page);

    setList((prev) => [...prev, ...data.list]);
    setHasMore(data.hasMore);
    setPage((prev) => prev + 1);
    setLoading(false);
    };

    useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
        loadMore();
        }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
    }, []);

    return(
        <>
        </>
    )

}