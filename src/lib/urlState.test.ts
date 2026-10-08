import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from '../features/filters/applyFilters';
import { parseUrlState, serializeUrlState } from './urlState';

describe('urlState', () => {
  it('빈 쿼리는 기본값, view 는 null', () => {
    expect(parseUrlState('')).toEqual({ filters: EMPTY_FILTERS, view: null });
  });

  it('모든 파라미터를 읽는다', () => {
    const state = parseUrlState(
      '?q=%EB%B3%B4%EA%B3%A0&status=todo,done&priority=high&assignee=m1,none&category=c1&due=overdue&mine=1&view=list',
    );
    expect(state.filters).toEqual({
      query: '보고',
      statuses: ['todo', 'done'],
      priorities: ['high'],
      assigneeIds: ['m1', 'none'],
      categoryIds: ['c1'],
      dueStatuses: ['overdue'],
      mineOnly: true,
    });
    expect(state.view).toBe('list');
  });

  it('올바르지 않은 값은 무시한다', () => {
    const state = parseUrlState('?status=todo,weird&priority=urgent&view=nope&mine=0');
    expect(state.filters.statuses).toEqual(['todo']);
    expect(state.filters.priorities).toEqual([]);
    expect(state.filters.mineOnly).toBe(false);
    expect(state.view).toBeNull();
  });

  it('직렬화 후 다시 읽으면 같은 상태', () => {
    const filters = {
      query: '실적 보고서',
      statuses: ['in-progress' as const],
      priorities: ['high' as const, 'low' as const],
      assigneeIds: ['m1'],
      categoryIds: [],
      dueStatuses: ['soon' as const],
      mineOnly: true,
    };
    const parsed = parseUrlState(serializeUrlState(filters, 'calendar'));
    expect(parsed.filters).toEqual(filters);
    expect(parsed.view).toBe('calendar');
  });

  it('기본값은 view 만 남긴다', () => {
    expect(serializeUrlState(EMPTY_FILTERS, 'kanban')).toBe('?view=kanban');
  });
});
