import { Button } from '../../components/Button';
import { useFilterStore } from '../../stores/filterStore';

/** 검색·필터 결과가 0건일 때의 빈 상태 안내(F-S-07). */
export function EmptyResult() {
  const clear = useFilterStore((s) => s.clear);

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface p-6 text-center">
      <h2 className="text-lg font-semibold">조건에 맞는 할일이 없습니다</h2>
      <p className="text-sm text-text-muted">검색어나 필터를 바꾸거나 초기화해 보세요.</p>
      <Button variant="primary" onClick={clear}>
        필터 초기화
      </Button>
    </div>
  );
}
