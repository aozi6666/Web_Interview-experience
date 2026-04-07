import { type RefObject, useCallback, useEffect, useState } from 'react';

/**
 * 响应式网格列数 hook，封装 ResizeObserver + window.resize。
 * @param ref       网格容器 ref
 * @param calcFn    根据容器宽度计算列数的纯函数
 * @param defaultCols 默认列数（首次渲染前使用）
 */
export function useGridColumns(
  ref: RefObject<HTMLDivElement | null>,
  calcFn: (width: number) => number,
  defaultCols = 3,
): number {
  const [columns, setColumns] = useState(defaultCols);

  const update = useCallback(() => {
    if (ref.current) {
      setColumns(calcFn(ref.current.offsetWidth));
    }
  }, [ref, calcFn]);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    let observer: ResizeObserver | null = null;
    if (ref.current) {
      observer = new ResizeObserver(update);
      observer.observe(ref.current);
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [update, ref]);

  return columns;
}
