import type { Task, TaskPriority, TaskStatus } from '../types';
import { getDueStatus } from './dueStatus';
import { isPending } from './pending';

/**
 * 상태 변경 규칙(F-T-05): done 이 되면 completed_at = 현재 시각,
 * done 에서 다른 상태로 가면 completed_at = null.
 */
export function statusPatch(
  status: TaskStatus,
  now: Date = new Date(),
): Pick<Task, 'status' | 'completed_at'> {
  return { status, completed_at: status === 'done' ? now.toISOString() : null };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function urgencyRank(task: Pick<Task, 'status' | 'due_date'>, today: string): number {
  const due = getDueStatus(task, today);
  return due === 'overdue' ? 0 : due === 'soon' ? 1 : 2;
}

/** 칸반 열을 정렬한 새 배열. 긴급도를 항목마다 한 번만 계산해 500건에서도 빠르다. */
export function sortForKanban(tasks: readonly Task[], today: string): Task[] {
  const urgency = new Map(tasks.map((t) => [t.id, urgencyRank(t, today)]));
  return [...tasks].sort((a, b) => {
    const byUrgency = (urgency.get(a.id) ?? 2) - (urgency.get(b.id) ?? 2);
    return byUrgency !== 0 ? byUrgency : compareAfterUrgency(a, b);
  });
}

/** 칸반 열 안 정렬(F-V-01): 지연 → 임박 → 우선순위(high→low) → 마감일 빠른 순 */
export function compareForKanban(a: Task, b: Task, today: string): number {
  const urgency = urgencyRank(a, today) - urgencyRank(b, today);
  return urgency !== 0 ? urgency : compareAfterUrgency(a, b);
}

function compareAfterUrgency(a: Task, b: Task): number {
  const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priority !== 0) return priority;

  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return b.created_at.localeCompare(a.created_at);
}

/** 낙관적 업데이트 중인(아직 저장 전) 항목인지 */
export const isTempId = (id: string): boolean => isPending(id);
