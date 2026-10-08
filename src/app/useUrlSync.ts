import { useEffect } from 'react';
import { parseUrlState, serializeUrlState } from '../lib/urlState';
import { pickFilters, useFilterStore } from '../stores/filterStore';
import { useViewStore } from '../stores/viewStore';

/**
 * 검색·필터·뷰 상태를 URL 쿼리에 반영하고(F-S-05), 뒤로/앞으로 이동 시 URL 에서 다시 읽는다.
 * 입력할 때마다 기록이 쌓이지 않도록 replaceState 를 쓴다.
 */
export function useUrlSync(): void {
  useEffect(() => {
    const write = () => {
      const search = serializeUrlState(
        pickFilters(useFilterStore.getState()),
        useViewStore.getState().view,
      );
      if (search !== window.location.search) {
        window.history.replaceState(null, '', `${window.location.pathname}${search}`);
      }
    };

    write();
    const unsubFilters = useFilterStore.subscribe(write);
    const unsubView = useViewStore.subscribe(write);

    const onPopState = () => {
      const { filters, view } = parseUrlState(window.location.search);
      useFilterStore.getState().replace(filters);
      if (view) useViewStore.getState().setView(view);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      unsubFilters();
      unsubView();
      window.removeEventListener('popstate', onPopState);
    };
  }, []);
}
