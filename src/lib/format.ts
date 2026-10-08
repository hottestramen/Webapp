import { tz } from '@date-fns/tz';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const SEOUL = tz('Asia/Seoul');

/** '10월 14일 (수)' */
export function formatDueDate(dueDate: string): string {
  return format(parseISO(dueDate), 'M월 d일 (EEE)', { locale: ko });
}

/** '10월 7일 오후 2:30' (Asia/Seoul) */
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'M월 d일 a h:mm', { locale: ko, in: SEOUL });
}

/** F-C-02: '방금 전' / '5분 전' / '10월 7일 오후 2:30' */
export function formatCommentTime(iso: string, now: Date = new Date()): string {
  const minutes = differenceInMinutes(now, parseISO(iso));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  return formatDateTime(iso);
}

/** '오후 2:30' (Asia/Seoul) */
export function formatTime(iso: string): string {
  return format(parseISO(iso), 'a h:mm', { locale: ko, in: SEOUL });
}

/** '10월 7일 수요일' — 캘린더 셀의 aria-label 용 */
export function formatDateLong(date: string): string {
  return format(parseISO(date), 'M월 d일 EEEE', { locale: ko });
}

/** '2026년 10월' */
export function formatMonthTitle(date: string): string {
  return format(parseISO(date), 'yyyy년 M월', { locale: ko });
}

/** '10월 7일 (수)' — 캘린더·팝오버 제목. 마감일 표기와 같은 형식이다. */
export const formatDayTitle = formatDueDate;

/** '10/5' — 주간 차트의 주(월요일) 라벨 */
export function formatWeekLabel(weekStart: string): string {
  return format(parseISO(weekStart), 'M/d');
}
