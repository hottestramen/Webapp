import { useMemo } from 'react';
import { isTrashed } from '../../lib/trash';
import { useFilterStore } from '../../stores/filterStore';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { useViewStore } from '../../stores/viewStore';
import { EmptyResult } from '../filters/EmptyResult';
import type { FilterState } from '../filters/applyFilters';
import { useFilteredTasks } from '../filters/useFilteredTasks';
import { AssigneeLoadChart } from './AssigneeLoadChart';
import {
  assigneeLoad,
  completionRate,
  dueSoonCount,
  overdueCount,
  recentCompletions,
  statusCounts,
  weeklyCompletions,
} from './metrics';
import { RecentCompletions } from './RecentCompletions';
import { StatCard } from './StatCard';
import { WeeklyChart } from './WeeklyChart';

/** 카드를 누르면 지금 걸린 조건은 유지한 채 해당 조건만 더해 리스트 뷰로 이동한다. */
function drillDownToList(patch: Partial<FilterState>) {
  useFilterStore.getState().drillDown(patch);
  useViewStore.getState().setView('list');
}

/** 대시보드(F-V-04). 검색·필터가 적용된 할일을 metrics.ts 의 순수 함수로 집계해 보여 준다. */
export function DashboardView({ onOpen }: { onOpen: (id: string) => void }) {
  const { tasks, isFiltered } = useFilteredTasks({ includeTrashed: true });
  const members = useTaskStore((s) => s.members);
  const loading = useTaskStore((s) => s.loading);
  const today = useTodayStore((s) => s.today);

  const metrics = useMemo(
    () => ({
      counts: statusCounts(tasks),
      rate: completionRate(tasks),
      load: assigneeLoad(tasks, members),
      soon: dueSoonCount(tasks, today),
      overdue: overdueCount(tasks, today),
      weekly: weeklyCompletions(tasks, today),
      recent: recentCompletions(tasks),
      trashed: tasks.filter((t) => isTrashed(t, today)).length,
    }),
    [tasks, members, today],
  );

  if (loading) {
    return (
      <div
        className="h-header animate-pulse rounded-md bg-surface motion-reduce:animate-none"
        aria-busy="true"
        aria-label="불러오는 중"
      />
    );
  }
  if (isFiltered && tasks.length === 0) return <EmptyResult />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <StatCard
          label="할 일"
          value={metrics.counts.todo}
          onClick={() => drillDownToList({ statuses: ['todo'] })}
        />
        <StatCard
          label="진행 중"
          value={metrics.counts['in-progress']}
          onClick={() => drillDownToList({ statuses: ['in-progress'] })}
        />
        <StatCard
          label="완료"
          value={metrics.counts.done}
          onClick={() => drillDownToList({ statuses: ['done'] })}
        />
        <StatCard
          label="완료율"
          tone="brand"
          value={metrics.rate}
          decimals={1}
          suffix="%"
          progress={metrics.rate}
          onClick={() => drillDownToList({ statuses: ['done'] })}
        />
        <StatCard
          label="마감 임박"
          tone="soon"
          value={metrics.soon}
          onClick={() => drillDownToList({ dueStatuses: ['soon'] })}
        />
        <StatCard
          label="지연"
          tone="overdue"
          value={metrics.overdue}
          onClick={() => drillDownToList({ dueStatuses: ['overdue'] })}
        />
        <StatCard
          label="휴지통"
          value={metrics.trashed}
          hint="설정의 휴지통 열기"
          onClick={() => useViewStore.getState().openSettings()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AssigneeLoadChart rows={metrics.load} />
        <WeeklyChart data={metrics.weekly} />
      </div>

      <RecentCompletions tasks={metrics.recent} members={members} onOpen={onOpen} />
    </div>
  );
}
