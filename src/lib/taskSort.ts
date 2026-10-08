import type { Task } from '../types';

export type SortKey =
  'title' | 'status' | 'priority' | 'assignee' | 'category' | 'due' | 'comments';
export type SortDir = 'asc' | 'desc';

export interface SortContext {
  assigneeName: (task: Task) => string | null;
  categoryName: (task: Task) => string | null;
  commentCount: (task: Task) => number;
}

const STATUS_RANK = { todo: 0, 'in-progress': 1, done: 2 } as const;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function valueOf(task: Task, key: SortKey, ctx: SortContext): string | number | null {
  switch (key) {
    case 'title':
      return task.title;
    case 'status':
      return STATUS_RANK[task.status];
    case 'priority':
      return PRIORITY_RANK[task.priority];
    case 'assignee':
      return ctx.assigneeName(task);
    case 'category':
      return ctx.categoryName(task);
    case 'due':
      return task.due_date;
    case 'comments':
      return ctx.commentCount(task);
  }
}

/** 열 머리글 정렬(F-V-02). 값이 없는 항목(마감일 없음 등)은 방향과 상관없이 맨 뒤에 둔다. */
export function sortTasks(
  tasks: readonly Task[],
  key: SortKey,
  dir: SortDir,
  ctx: SortContext,
): Task[] {
  const sign = dir === 'asc' ? 1 : -1;

  return [...tasks].sort((a, b) => {
    const va = valueOf(a, key, ctx);
    const vb = valueOf(b, key, ctx);

    if (va === null && vb === null) return a.title.localeCompare(b.title, 'ko');
    if (va === null) return 1;
    if (vb === null) return -1;

    const result =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'ko');

    return result !== 0 ? result * sign : a.title.localeCompare(b.title, 'ko');
  });
}
