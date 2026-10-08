import { useEffect, useRef, useState } from 'react';
import { useFilterStore } from '../../stores/filterStore';

const DEBOUNCE_MS = 200;

/** 헤더 검색창. 입력 후 200ms 디바운스해서 필터 스토어에 반영한다(F-S-01). */
export function SearchBox() {
  const query = useFilterStore((s) => s.query);
  const setQuery = useFilterStore((s) => s.setQuery);
  // 입력 중인 값. 없으면(null) 스토어 값(URL·초기화로 바뀐 값 포함)을 그대로 보여 준다.
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(value: string) {
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setQuery(value);
      setDraft(null);
    }, DEBOUNCE_MS);
  }

  return (
    <div className="min-w-0 basis-full md:flex-1 md:basis-0" role="search">
      <label htmlFor="global-search" className="sr-only">
        제목·담당자 검색
      </label>
      <input
        id="global-search"
        type="search"
        value={draft ?? query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="제목·담당자 검색"
        autoComplete="off"
        className="min-h-touch w-full max-w-modal rounded-pill border border-transparent bg-surface px-4 text-sm text-text"
      />
    </div>
  );
}
