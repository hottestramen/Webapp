import { describe, expect, it } from 'vitest';
import { compareForKanban, statusPatch } from './taskRules';
import type { Task } from '../types';

const today = '2026-10-07';
const make = (over: Partial<Task>): Task => ({
  id: 'x',
  title: 't',
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_id: null,
  category_id: null,
  due_date: null,
  completed_at: null,
  created_by: 'a',
  updated_by: 'a',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

describe('statusPatch', () => {
  const now = new Date('2026-10-07T05:00:00Z');

  it('done 이 되면 completed_at 을 현재 시각으로', () => {
    expect(statusPatch('done', now)).toEqual({
      status: 'done',
      completed_at: '2026-10-07T05:00:00.000Z',
    });
  });

  it('done 이 아니면 completed_at 을 비운다', () => {
    expect(statusPatch('in-progress', now)).toEqual({ status: 'in-progress', completed_at: null });
    expect(statusPatch('todo', now).completed_at).toBeNull();
  });
});

describe('compareForKanban', () => {
  it('지연 → 임박 → 우선순위 → 마감일 순', () => {
    const overdueLow = make({ id: 'overdueLow', priority: 'low', due_date: '2026-10-01' });
    const soonHigh = make({ id: 'soonHigh', priority: 'high', due_date: '2026-10-08' });
    const farHigh = make({ id: 'farHigh', priority: 'high', due_date: '2026-11-01' });
    const farMedEarly = make({ id: 'farMedEarly', due_date: '2026-10-20' });
    const farMedLate = make({ id: 'farMedLate', due_date: '2026-10-25' });
    const noDue = make({ id: 'noDue' });

    const sorted = [noDue, farMedLate, farHigh, soonHigh, farMedEarly, overdueLow]
      .sort((a, b) => compareForKanban(a, b, today))
      .map((t) => t.id);

    expect(sorted).toEqual([
      'overdueLow',
      'soonHigh',
      'farHigh',
      'farMedEarly',
      'farMedLate',
      'noDue',
    ]);
  });
});
