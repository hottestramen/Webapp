import { describe, expect, it } from 'vitest';
import { getDueLabel, getDueStatus, todayInSeoul } from './dueStatus';
import type { TaskStatus } from '../types';

const today = '2026-10-07';
const task = (due_date: string | null, status: TaskStatus = 'todo') => ({ status, due_date });

describe('getDueStatus', () => {
  it('마감일이 없으면 null', () => {
    expect(getDueStatus(task(null), today)).toBeNull();
  });

  it('완료 항목은 마감이 지났거나 임박해도 null', () => {
    expect(getDueStatus(task('2026-10-06', 'done'), today)).toBeNull();
    expect(getDueStatus(task('2026-10-08', 'done'), today)).toBeNull();
  });

  it('D-3 은 soon, D-4 는 null (경계)', () => {
    expect(getDueStatus(task('2026-10-10'), today)).toBe('soon');
    expect(getDueStatus(task('2026-10-11'), today)).toBeNull();
  });

  it('D-day 는 soon', () => {
    expect(getDueStatus(task('2026-10-07'), today)).toBe('soon');
  });

  it('어제는 overdue', () => {
    expect(getDueStatus(task('2026-10-06'), today)).toBe('overdue');
  });

  it('진행 중도 미완료로 본다', () => {
    expect(getDueStatus(task('2026-10-09', 'in-progress'), today)).toBe('soon');
  });

  it('월·연도 경계를 넘어도 날짜 단위로 계산한다', () => {
    expect(getDueStatus(task('2027-01-02'), '2026-12-30')).toBe('soon');
    expect(getDueStatus(task('2026-12-31'), '2027-01-01')).toBe('overdue');
  });
});

describe('getDueLabel', () => {
  it('임박 라벨', () => {
    expect(getDueLabel(task('2026-10-10'), today)).toBe('D-3');
    expect(getDueLabel(task('2026-10-09'), today)).toBe('D-2');
    expect(getDueLabel(task('2026-10-08'), today)).toBe('D-1');
    expect(getDueLabel(task('2026-10-07'), today)).toBe('D-day');
  });

  it('지연 라벨', () => {
    expect(getDueLabel(task('2026-10-06'), today)).toBe('지연 +1일');
    expect(getDueLabel(task('2026-10-01'), today)).toBe('지연 +6일');
  });

  it('배지가 없으면 null', () => {
    expect(getDueLabel(task(null), today)).toBeNull();
    expect(getDueLabel(task('2026-10-06', 'done'), today)).toBeNull();
    expect(getDueLabel(task('2026-10-20'), today)).toBeNull();
  });
});

describe('todayInSeoul', () => {
  it('UTC 15:00 이후는 서울 기준 다음 날이다', () => {
    expect(todayInSeoul(new Date('2026-10-06T14:59:59Z'))).toBe('2026-10-06');
    expect(todayInSeoul(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
  });
});
