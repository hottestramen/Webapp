import { describe, expect, it } from 'vitest';
import { formatLeavePeriod, isWorkingDay, leavesOnDate, validateLeaveForm } from './leaves';
import type { Leave } from '../types';

const holidays = new Set(['2026-10-09']); // 한글날(금)

const leave = (over: Partial<Leave>): Leave => ({
  id: 'l1',
  member_id: 'm1',
  kind: 'annual',
  start_date: '2026-10-07',
  end_date: '2026-10-07',
  note: null,
  created_by: '김하늘',
  created_at: '',
  deleted_at: null,
  ...over,
});

describe('isWorkingDay', () => {
  it('평일은 true, 주말·공휴일은 false', () => {
    expect(isWorkingDay('2026-10-07', holidays)).toBe(true); // 수
    expect(isWorkingDay('2026-10-10', holidays)).toBe(false); // 토
    expect(isWorkingDay('2026-10-11', holidays)).toBe(false); // 일
    expect(isWorkingDay('2026-10-09', holidays)).toBe(false); // 한글날
  });
});

describe('leavesOnDate', () => {
  it('기간(양 끝 포함) 안의 평일에만 나온다', () => {
    const l = leave({ start_date: '2026-10-07', end_date: '2026-10-14' });
    expect(leavesOnDate([l], '2026-10-06', holidays)).toEqual([]);
    expect(leavesOnDate([l], '2026-10-07', holidays)).toEqual([l]);
    expect(leavesOnDate([l], '2026-10-14', holidays)).toEqual([l]);
    expect(leavesOnDate([l], '2026-10-15', holidays)).toEqual([]);
  });

  it('주말과 공휴일에는 표시하지 않는다', () => {
    const l = leave({ start_date: '2026-10-08', end_date: '2026-10-13' });
    expect(leavesOnDate([l], '2026-10-09', holidays)).toEqual([]); // 한글날
    expect(leavesOnDate([l], '2026-10-10', holidays)).toEqual([]); // 토
    expect(leavesOnDate([l], '2026-10-12', holidays)).toEqual([l]); // 월
  });

  it('여러 명이 같은 날 쉴 수 있고, 삭제된 휴가는 제외한다', () => {
    const a = leave({ id: 'a' });
    const b = leave({ id: 'b', member_id: 'm2' });
    const gone = leave({ id: 'c', deleted_at: '2026-10-01T00:00:00Z' });
    expect(leavesOnDate([a, b, gone], '2026-10-07', holidays).map((l) => l.id)).toEqual(['a', 'b']);
  });
});

describe('formatLeavePeriod', () => {
  it('하루 / 기간', () => {
    expect(formatLeavePeriod({ start_date: '2026-10-07', end_date: '2026-10-07' })).toBe(
      '10월 7일 (수)',
    );
    expect(formatLeavePeriod({ start_date: '2026-10-07', end_date: '2026-10-09' })).toBe(
      '10월 7일 (수) ~ 10월 9일 (금)',
    );
  });
});

describe('validateLeaveForm', () => {
  const ok = {
    memberId: 'm1',
    kind: 'annual' as const,
    startDate: '2026-10-07',
    endDate: '2026-10-09',
    note: '',
  };

  it('정상 값은 오류 없음', () => {
    expect(validateLeaveForm(ok)).toEqual({});
  });

  it('팀원·시작일·종료일 필수', () => {
    const errors = validateLeaveForm({ ...ok, memberId: '', startDate: '', endDate: '' });
    expect(errors.memberId).toBeDefined();
    expect(errors.startDate).toBeDefined();
    expect(errors.endDate).toBeDefined();
  });

  it('종료일이 시작일보다 빠르면 오류', () => {
    expect(validateLeaveForm({ ...ok, endDate: '2026-10-06' }).endDate).toMatch(/빠를 수 없/);
  });

  it('최대 91일(시작일 포함)', () => {
    expect(
      validateLeaveForm({ ...ok, startDate: '2026-01-01', endDate: '2026-04-01' }).endDate,
    ).toBeUndefined(); // 90일 차이
    expect(
      validateLeaveForm({ ...ok, startDate: '2026-01-01', endDate: '2026-04-02' }).endDate,
    ).toMatch(/최대/);
  });

  it('반차는 종료일을 보지 않고 하루로 본다', () => {
    expect(validateLeaveForm({ ...ok, kind: 'half-am', endDate: '' })).toEqual({});
  });

  it('메모는 50자 이하', () => {
    expect(validateLeaveForm({ ...ok, note: 'a'.repeat(50) }).note).toBeUndefined();
    expect(validateLeaveForm({ ...ok, note: 'a'.repeat(51) }).note).toBeDefined();
  });
});
