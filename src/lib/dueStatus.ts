import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type { Task } from '../types';

export type DueStatus = 'soon' | 'overdue';

/** 마감 임박 기준: 오늘부터 3일 이내(D-3 ~ D-day) */
export const DUE_SOON_DAYS = 3;

const SEOUL = tz('Asia/Seoul');

/** Asia/Seoul 기준 오늘 날짜('YYYY-MM-DD'). 날짜 단위 계산의 기준이다(F-D-04). */
export function todayInSeoul(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd', { in: SEOUL });
}

/** 마감일 − 오늘 (일 단위). 마감일이 오늘보다 늦으면 양수. */
export function daysUntilDue(dueDate: string, today: string): number {
  return Math.round((utcDay(dueDate) - utcDay(today)) / DAY_MS);
}

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' → 그 날 UTC 자정의 ms. 날짜만 비교하므로 시간대·일광절약 영향이 없다. */
function utcDay(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

type DueFields = Pick<Task, 'status' | 'due_date'>;

/**
 * 미완료이고 0 ≤ (마감일 − 오늘) ≤ 3 이면 'soon', 마감일 < 오늘이면 'overdue'.
 * 완료이거나 마감일이 없으면 null (F-D-01~03).
 */
export function getDueStatus(task: DueFields, today: string): DueStatus | null {
  if (task.status === 'done' || !task.due_date) return null;
  const days = daysUntilDue(task.due_date, today);
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'soon';
  return null;
}

/** "D-3", "D-2", "D-1", "D-day", "지연 +N일". 배지가 없으면 null. */
export function getDueLabel(task: DueFields, today: string): string | null {
  const status = getDueStatus(task, today);
  if (!status || !task.due_date) return null;
  const days = daysUntilDue(task.due_date, today);
  if (status === 'overdue') return `지연 +${-days}일`;
  return days === 0 ? 'D-day' : `D-${days}`;
}
