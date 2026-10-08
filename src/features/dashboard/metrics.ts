import { tz } from '@date-fns/tz';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { getDueStatus } from '../../lib/dueStatus';
import type { Member, Task, TaskStatus } from '../../types';

// PRD §4.5. 모든 함수는 "검색·필터가 적용된(소프트 삭제 제외) 할일"을 입력으로 받는 순수 함수다.

const SEOUL = tz('Asia/Seoul');

/** F-M-01: 상태별 건수 */
export function statusCounts(tasks: readonly Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, 'in-progress': 0, done: 0 };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

/** F-M-02: done ÷ 전체 × 100, 소수점 첫째 자리 반올림. 전체 0건이면 null("—" 표시) */
export function completionRate(tasks: readonly Task[]): number | null {
  if (tasks.length === 0) return null;
  const done = tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / tasks.length) * 1000) / 10;
}

export interface AssigneeLoad {
  /** 담당자 미지정이면 null */
  assigneeId: string | null;
  name: string;
  count: number;
}

export const UNASSIGNED_LABEL = '미지정';

/**
 * F-M-03: 담당자별 미완료(todo + in-progress) 건수. 많은 순(같으면 이름순).
 * 담당자 미지정은 "미지정" 행으로 따로 맨 뒤에 둔다. 건수가 0인 담당자는 넣지 않는다.
 */
export function assigneeLoad(tasks: readonly Task[], members: readonly Member[]): AssigneeLoad[] {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const counts = new Map<string, number>();
  let unassigned = 0;

  for (const task of tasks) {
    if (task.status === 'done') continue;
    if (task.assignee_id === null) unassigned += 1;
    else counts.set(task.assignee_id, (counts.get(task.assignee_id) ?? 0) + 1);
  }

  const rows: AssigneeLoad[] = [...counts].map(([assigneeId, count]) => ({
    assigneeId,
    name: nameById.get(assigneeId) ?? '알 수 없음',
    count,
  }));
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));

  if (unassigned > 0) rows.push({ assigneeId: null, name: UNASSIGNED_LABEL, count: unassigned });
  return rows;
}

/** F-M-04: 마감 임박 건수(미완료, 0 ≤ 마감일 − 오늘 ≤ 3) */
export function dueSoonCount(tasks: readonly Task[], today: string): number {
  return tasks.filter((t) => getDueStatus(t, today) === 'soon').length;
}

/** F-M-05: 지연 건수(미완료, 마감일 < 오늘) */
export function overdueCount(tasks: readonly Task[], today: string): number {
  return tasks.filter((t) => getDueStatus(t, today) === 'overdue').length;
}

export interface WeeklyCompletion {
  /** 그 주 월요일 'YYYY-MM-DD' */
  weekStart: string;
  count: number;
}

const WEEKS = 8;

/** completed_at 을 Asia/Seoul 날짜로 바꾼다 */
const seoulDate = (iso: string): string => format(new Date(iso), 'yyyy-MM-dd', { in: SEOUL });

const mondayOf = (date: string): string =>
  format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), 'yyyy-MM-dd');

/** F-M-06: 오늘이 속한 주를 포함한 최근 8주(월~일)의 주별 완료 건수. 오래된 주부터 정렬 */
export function weeklyCompletions(
  tasks: readonly Task[],
  today: string,
  weeks: number = WEEKS,
): WeeklyCompletion[] {
  const thisMonday = parseISO(mondayOf(today));
  const buckets: WeeklyCompletion[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: format(addDays(thisMonday, (i - (weeks - 1)) * 7), 'yyyy-MM-dd'),
    count: 0,
  }));
  const byWeek = new Map(buckets.map((b) => [b.weekStart, b]));

  for (const task of tasks) {
    if (!task.completed_at) continue;
    const bucket = byWeek.get(mondayOf(seoulDate(task.completed_at)));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

const RECENT_LIMIT = 20;

/** F-M-07: completed_at 최신순 20건 */
export function recentCompletions(tasks: readonly Task[], limit: number = RECENT_LIMIT): Task[] {
  return tasks
    .filter((t) => t.completed_at !== null)
    .sort((a, b) => (b.completed_at as string).localeCompare(a.completed_at as string))
    .slice(0, limit);
}
