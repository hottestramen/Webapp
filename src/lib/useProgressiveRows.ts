import { useEffect, useState } from 'react';

/**
 * 많은 행(할일 500건 등)을 한꺼번에 그리면 화면 전환이 느려지므로, 처음엔 앞부분만 그려 바로 보여 주고
 * 나머지는 이어서 조금씩 채운다(결국 전부 그린다). 목록이 줄어들면 남는 만큼만 그린다.
 *
 * @param items 전체 행
 * @param first 처음에 그릴 개수
 * @param step  한 번에 더 그릴 개수
 */
export function useProgressiveRows<T>(items: readonly T[], first = 40, step = 80): readonly T[] {
  const [limit, setLimit] = useState(first);

  // 목록이 limit 보다 짧아지면(필터 적용 등) 그만큼만 쓰고, 다시 늘어나면 거기서부터 이어서 채운다
  if (items.length < limit && limit > first) setLimit(Math.max(first, items.length));

  useEffect(() => {
    if (limit >= items.length) return;
    const timer = setTimeout(() => setLimit((l) => l + step), 0);
    return () => clearTimeout(timer);
  }, [limit, items.length, step]);

  return limit >= items.length ? items : items.slice(0, limit);
}
