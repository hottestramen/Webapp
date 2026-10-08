import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

const DATE_FMT = 'yyyy-MM-dd';

/** 주는 월요일에 시작한다(PRD §6.4) */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const toDateString = (date: Date): string => format(date, DATE_FMT);

/** 'YYYY-MM-DD' 가 속한 달의 1일 */
export const monthStart = (date: string): string => toDateString(startOfMonth(parseISO(date)));

export const shiftMonth = (date: string, delta: number): string =>
  toDateString(addMonths(parseISO(date), delta));

export const shiftDays = (date: string, delta: number): string =>
  toDateString(addDays(parseISO(date), delta));

/** 월간 그리드: 월요일 시작, 항상 7열 × 4~6주. 앞뒤는 이웃 달 날짜로 채운다. */
export function buildMonthGrid(month: string): string[][] {
  const first = startOfMonth(parseISO(month));
  const start = startOfWeek(first, WEEK_OPTIONS);
  const end = endOfWeek(endOfMonth(first), WEEK_OPTIONS);

  const weeks: string[][] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => toDateString(addDays(cursor, i))));
  }
  return weeks;
}

/** 0 = 일요일 … 6 = 토요일 */
export const weekdayOf = (date: string): number => parseISO(date).getDay();

export const isSameMonth = (date: string, month: string): boolean =>
  date.slice(0, 7) === month.slice(0, 7);

/** 날짜별로 묶는다. 마감일이 없는 항목은 별도 목록으로 돌려준다. */
export function groupByDueDate<T extends { due_date: string | null }>(
  items: readonly T[],
): { byDate: Map<string, T[]>; noDue: T[] } {
  const byDate = new Map<string, T[]>();
  const noDue: T[] = [];
  for (const item of items) {
    if (!item.due_date) {
      noDue.push(item);
      continue;
    }
    const bucket = byDate.get(item.due_date);
    if (bucket) bucket.push(item);
    else byDate.set(item.due_date, [item]);
  }
  return { byDate, noDue };
}
