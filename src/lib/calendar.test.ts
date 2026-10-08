import { describe, expect, it } from 'vitest';
import { buildMonthGrid, groupByDueDate, shiftDays, shiftMonth, weekdayOf } from './calendar';

describe('buildMonthGrid', () => {
  it('2026-10: 월요일 시작, 9/28 ~ 11/1, 5주', () => {
    const grid = buildMonthGrid('2026-10-01');
    expect(grid).toHaveLength(5);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]?.[0]).toBe('2026-09-28');
    expect(grid[4]?.[6]).toBe('2026-11-01');
  });

  it('일요일이 한 주의 마지막 열', () => {
    for (const week of buildMonthGrid('2026-10-01')) {
      expect(weekdayOf(week[6] as string)).toBe(0);
      expect(weekdayOf(week[0] as string)).toBe(1);
    }
  });

  it('달이 월요일에 시작하면 이전 달 날짜를 채우지 않는다', () => {
    const grid = buildMonthGrid('2026-06-01');
    expect(grid[0]?.[0]).toBe('2026-06-01');
  });

  it('6주가 필요한 달도 처리한다', () => {
    expect(buildMonthGrid('2027-05-01')).toHaveLength(6);
  });
});

describe('날짜 이동', () => {
  it('달·일 이동은 연도 경계를 넘는다', () => {
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('groupByDueDate', () => {
  it('날짜별로 묶고 마감일 없는 항목은 따로 모은다', () => {
    const items = [
      { id: 1, due_date: '2026-10-07' },
      { id: 2, due_date: '2026-10-07' },
      { id: 3, due_date: null },
      { id: 4, due_date: '2026-10-08' },
    ];
    const { byDate, noDue } = groupByDueDate(items);
    expect(byDate.get('2026-10-07')?.map((i) => i.id)).toEqual([1, 2]);
    expect(byDate.get('2026-10-08')?.map((i) => i.id)).toEqual([4]);
    expect(noDue.map((i) => i.id)).toEqual([3]);
  });
});
