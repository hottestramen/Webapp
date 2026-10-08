import { getDueStatus } from '../../lib/dueStatus';
import type { DueStatus } from '../../lib/dueStatus';
import type { Member, Task, TaskPriority, TaskStatus } from '../../types';

/** 담당자 필터에서 "담당자 미지정"을 뜻하는 값 */
export const UNASSIGNED = 'none';

export interface FilterState {
  query: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  /** member id. 미지정은 UNASSIGNED */
  assigneeIds: string[];
  categoryIds: string[];
  /** 마감 임박(soon)·지연(overdue). 완료·마감일 없는 항목은 어느 쪽에도 속하지 않는다 */
  dueStatuses: DueStatus[];
  mineOnly: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  statuses: [],
  priorities: [],
  assigneeIds: [],
  categoryIds: [],
  dueStatuses: [],
  mineOnly: false,
};

export function hasActiveFilters(f: FilterState): boolean {
  return countActiveFilters(f) > 0;
}

export function countActiveFilters(f: FilterState): number {
  return (
    (f.query.trim() ? 1 : 0) +
    f.statuses.length +
    f.priorities.length +
    f.assigneeIds.length +
    f.categoryIds.length +
    f.dueStatuses.length +
    (f.mineOnly ? 1 : 0)
  );
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * 모든 뷰(칸반·리스트·캘린더·대시보드)가 쓰는 유일한 필터 함수(F-S-03).
 * - 검색: 제목·담당자 이름 부분 일치, 대소문자·앞뒤 공백 무시
 * - 같은 필터 안의 여러 값은 OR, 서로 다른 필터끼리는 AND
 * - dueStatuses: 오늘(Asia/Seoul) 기준 마감 임박·지연 항목
 * - mineOnly: 담당자 이름이 현재 사용자 이름과 같은 항목
 */
export function applyFilters(
  tasks: readonly Task[],
  filters: FilterState,
  currentUserName: string | null,
  members: readonly Member[],
  today: string,
): Task[] {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const query = normalize(filters.query);

  return tasks.filter((task) => {
    const assigneeName = task.assignee_id ? (nameById.get(task.assignee_id) ?? '') : '';

    if (query) {
      const inTitle = task.title.toLowerCase().includes(query);
      const inAssignee = assigneeName.toLowerCase().includes(query);
      if (!inTitle && !inAssignee) return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;

    if (filters.assigneeIds.length > 0) {
      const key = task.assignee_id ?? UNASSIGNED;
      if (!filters.assigneeIds.includes(key)) return false;
    }

    if (filters.categoryIds.length > 0) {
      if (!task.category_id || !filters.categoryIds.includes(task.category_id)) return false;
    }

    if (filters.dueStatuses.length > 0) {
      const due = getDueStatus(task, today);
      if (!due || !filters.dueStatuses.includes(due)) return false;
    }

    if (filters.mineOnly) {
      if (!currentUserName || !assigneeName || assigneeName !== currentUserName) return false;
    }

    return true;
  });
}
