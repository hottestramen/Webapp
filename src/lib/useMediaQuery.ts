import { useSyncExternalStore } from 'react';

// Tailwind 의 md 브레이크포인트(PRD §5.1 의 모바일 < 768px)와 같은 값이다.
const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** 태블릿 이상(≥768px)이면 true. 레이아웃은 CSS 로 나누고, 동작이 달라지는 곳에서만 쓴다. */
export function useIsWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
