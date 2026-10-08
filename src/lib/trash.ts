import { daysUntilDue, todayInSeoul } from './dueStatus';
import type { Task } from '../types';

/** 완료 처리한 지 이 일수가 지나면 휴지통으로 옮겨진다(DB 변경 없이 화면에서 계산한다). */
export const TRASH_AFTER_DAYS = 7;

/** 완료 후 TRASH_AFTER_DAYS 일이 지난 할일(Asia/Seoul 날짜 기준) */
export function isTrashed(task: Pick<Task, 'status' | 'completed_at'>, today: string): boolean {
  if (task.status !== 'done' || !task.completed_at) return false;
  const completedDay = todayInSeoul(new Date(task.completed_at));
  return -daysUntilDue(completedDay, today) >= TRASH_AFTER_DAYS;
}
