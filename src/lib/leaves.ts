import { differenceInCalendarDays, parseISO } from 'date-fns';
import { weekdayOf } from './calendar';
import { formatDueDate } from './format';
import { LEAVE_KIND_LABEL, LEAVE_KIND_SHORT } from './labels';
import type { Leave, LeaveKind } from '../types';

/** 휴가 한 건의 최대 기간(일). DB 의 CHECK(end_date - start_date <= 90)와 같다. */
export const LEAVE_MAX_SPAN_DAYS = 90;
export const LEAVE_NOTE_MAX = 50;

const isHalfDay = (kind: LeaveKind): boolean => kind === 'half-am' || kind === 'half-pm';
export const isHalfDayKind = isHalfDay;

export const isTripKind = (kind: LeaveKind): boolean => kind === 'trip';

/** 목록 제목·접근성 문구용: 휴가만 / 출장만 / 둘 다 */
export function groupLabel(items: readonly Pick<Leave, 'kind'>[]): string {
  const trips = items.filter((l) => isTripKind(l.kind)).length;
  if (trips === 0) return '휴가';
  return trips === items.length ? '출장' : '휴가·출장';
}

/** 평일이고 공휴일이 아닌 날 */
export function isWorkingDay(date: string, holidayDates: ReadonlySet<string>): boolean {
  const weekday = weekdayOf(date);
  return weekday !== 0 && weekday !== 6 && !holidayDates.has(date);
}

/**
 * 그 날짜에 쉬는 휴가들. 주말·공휴일은 원래 쉬는 날이라 표시하지 않는다.
 * (금요일~다음 주 월요일 연차라면 금·월에만 표시된다.)
 */
export function leavesOnDate(
  leaves: readonly Leave[],
  date: string,
  holidayDates: ReadonlySet<string>,
): Leave[] {
  if (!isWorkingDay(date, holidayDates)) return [];
  return leaves.filter((l) => !l.deleted_at && l.start_date <= date && date <= l.end_date);
}

/** '10월 7일 (수)' 또는 '10월 7일 (수) ~ 10월 9일 (금)' */
export function formatLeavePeriod(leave: Pick<Leave, 'start_date' | 'end_date'>): string {
  return leave.start_date === leave.end_date
    ? formatDueDate(leave.start_date)
    : `${formatDueDate(leave.start_date)} ~ ${formatDueDate(leave.end_date)}`;
}

export interface LeaveFormValues {
  memberId: string;
  kind: LeaveKind;
  startDate: string;
  endDate: string;
  note: string;
}

export type LeaveFormErrors = Partial<
  Record<'memberId' | 'startDate' | 'endDate' | 'note', string>
>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 입력 검증(DB CHECK 와 같은 규칙). 오류가 없으면 빈 객체. */
export function validateLeaveForm(values: LeaveFormValues): LeaveFormErrors {
  const errors: LeaveFormErrors = {};

  if (!values.memberId) errors.memberId = '팀원을 선택하세요.';
  if (!DATE_RE.test(values.startDate)) errors.startDate = '시작일을 선택하세요.';

  const endDate = isHalfDay(values.kind) ? values.startDate : values.endDate;
  if (!DATE_RE.test(endDate)) errors.endDate = '종료일을 선택하세요.';

  if (!errors.startDate && !errors.endDate) {
    const span = differenceInCalendarDays(parseISO(endDate), parseISO(values.startDate));
    if (span < 0) errors.endDate = '종료일은 시작일보다 빠를 수 없습니다.';
    else if (span > LEAVE_MAX_SPAN_DAYS) {
      errors.endDate = `${isTripKind(values.kind) ? '출장' : '휴가'}은 최대 ${LEAVE_MAX_SPAN_DAYS + 1}일까지 한 번에 등록할 수 있습니다.`;
    }
  }

  if (values.note.length > LEAVE_NOTE_MAX)
    errors.note = `메모는 ${LEAVE_NOTE_MAX}자 이하로 입력하세요.`;
  return errors;
}

/** 접근 가능한 이름: 화면 글자("김하늘 연차")로 시작하고 기간을 덧붙인다(WCAG 2.5.3) */
export function leaveLabel(leave: Leave, memberName: string): string {
  return `${memberName} ${LEAVE_KIND_SHORT[leave.kind]}, ${LEAVE_KIND_LABEL[leave.kind]} ${formatLeavePeriod(leave)}`;
}
