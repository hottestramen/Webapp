import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isTrashed } from '../../lib/trash';
import { pickFilters, useFilterStore } from '../../stores/filterStore';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { useUserStore } from '../../stores/userStore';
import { applyFilters, hasActiveFilters } from './applyFilters';

/**
 * 모든 뷰가 쓰는 "검색·필터가 적용된 할일". 뷰마다 따로 걸러 내지 않고 이 훅만 쓴다(F-S-03).
 * 완료 후 7일이 지난 할일(휴지통)은 기본으로 빠진다. 통계가 필요한 대시보드만 포함해서 쓴다.
 */
export function useFilteredTasks({ includeTrashed = false } = {}) {
  const allTasks = useTaskStore((s) => s.tasks);
  const members = useTaskStore((s) => s.members);
  const userName = useUserStore((s) => s.name);
  const today = useTodayStore((s) => s.today);
  const filters = useFilterStore(useShallow(pickFilters));

  const tasks = useMemo(
    () => (includeTrashed ? allTasks : allTasks.filter((t) => !isTrashed(t, today))),
    [allTasks, includeTrashed, today],
  );

  const filtered = useMemo(
    () => applyFilters(tasks, filters, userName, members, today),
    [tasks, filters, userName, members, today],
  );

  return {
    tasks: filtered,
    total: tasks.length,
    filters,
    isFiltered: hasActiveFilters(filters),
  };
}
