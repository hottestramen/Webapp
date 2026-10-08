import { create } from 'zustand';
import { EMPTY_FILTERS } from '../features/filters/applyFilters';
import type { FilterState } from '../features/filters/applyFilters';
import { parseUrlState } from '../lib/urlState';

type ListKey = 'statuses' | 'priorities' | 'assigneeIds' | 'categoryIds' | 'dueStatuses';

interface FilterStore extends FilterState {
  setQuery: (query: string) => void;
  /** 목록 필터의 값을 켜고 끈다 */
  toggleValue: <K extends ListKey>(key: K, value: FilterState[K][number]) => void;
  removeValue: <K extends ListKey>(key: K, value: FilterState[K][number]) => void;
  setMineOnly: (on: boolean) => void;
  /** 모든 조건을 초기화한다(F-S-04) */
  clear: () => void;
  /** 지정한 필드만 덮어쓴다. 대시보드 카드에서 "그 조건의 목록"으로 이동할 때 쓴다(나머지 조건은 유지). */
  drillDown: (patch: Partial<FilterState>) => void;
  /** URL 등 외부에서 받은 상태로 통째로 바꾼다 */
  replace: (filters: FilterState) => void;
}

const initial: FilterState =
  typeof window === 'undefined' ? EMPTY_FILTERS : parseUrlState(window.location.search).filters;

export const useFilterStore = create<FilterStore>((set) => ({
  ...initial,

  setQuery: (query) => set({ query }),

  toggleValue: (key, value) =>
    set((s) => {
      const current = s[key] as string[];
      const next = current.includes(value as string)
        ? current.filter((v) => v !== value)
        : [...current, value as string];
      return { [key]: next } as Partial<FilterState>;
    }),

  removeValue: (key, value) =>
    set(
      (s) => ({ [key]: (s[key] as string[]).filter((v) => v !== value) }) as Partial<FilterState>,
    ),

  setMineOnly: (mineOnly) => set({ mineOnly }),
  clear: () => set({ ...EMPTY_FILTERS }),
  drillDown: (patch) => set({ ...patch }),
  replace: (filters) => set({ ...filters }),
}));

/** 스토어에서 필터 값만 뽑는다(액션 제외). */
export function pickFilters(s: FilterState): FilterState {
  return {
    query: s.query,
    statuses: s.statuses,
    priorities: s.priorities,
    assigneeIds: s.assigneeIds,
    categoryIds: s.categoryIds,
    dueStatuses: s.dueStatuses,
    mineOnly: s.mineOnly,
  };
}
