import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, UNASSIGNED } from './applyFilters';
import type { FilterState } from './applyFilters';
import type { Member, Task } from '../../types';

const members: Member[] = [
  { id: 'm1', name: '김하늘', color: 'avatar-1', active: true, created_at: '' },
  { id: 'm2', name: 'Park Min', color: 'avatar-2', active: true, created_at: '' },
];

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

const tasks: Task[] = [
  make({
    id: 'a',
    title: '3분기 실적 보고서',
    assignee_id: 'm1',
    category_id: 'c1',
    priority: 'high',
  }),
  make({
    id: 'b',
    title: 'Weekly MEETING',
    assignee_id: 'm2',
    status: 'in-progress',
    category_id: 'c2',
  }),
  make({ id: 'c', title: '교육 자료 준비', status: 'done', priority: 'low' }),
  make({ id: 'd', title: '운영 점검', assignee_id: 'm1', status: 'done', category_id: 'c1' }),
];

const run = (patch: Partial<FilterState>, user: string | null = null) =>
  applyFilters(tasks, { ...EMPTY_FILTERS, ...patch }, user, members, '2026-10-07').map((t) => t.id);

describe('applyFilters: 검색', () => {
  it('조건이 없으면 전체', () => {
    expect(run({})).toEqual(['a', 'b', 'c', 'd']);
  });

  it('제목 부분 일치', () => {
    expect(run({ query: '보고서' })).toEqual(['a']);
  });

  it('대소문자와 앞뒤 공백을 무시', () => {
    expect(run({ query: '  weekly meeting ' })).toEqual(['b']);
    expect(run({ query: 'MEETING' })).toEqual(['b']);
  });

  it('담당자 이름으로도 검색', () => {
    expect(run({ query: '하늘' })).toEqual(['a', 'd']);
    expect(run({ query: 'park' })).toEqual(['b']);
  });

  it('공백만 있는 검색어는 조건 없음', () => {
    expect(run({ query: '   ' })).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('applyFilters: 단일 필터', () => {
  it('상태', () => {
    expect(run({ statuses: ['done'] })).toEqual(['c', 'd']);
  });

  it('우선순위', () => {
    expect(run({ priorities: ['high'] })).toEqual(['a']);
  });

  it('담당자 및 미지정', () => {
    expect(run({ assigneeIds: ['m1'] })).toEqual(['a', 'd']);
    expect(run({ assigneeIds: [UNASSIGNED] })).toEqual(['c']);
  });

  it('카테고리는 미지정 항목을 제외', () => {
    expect(run({ categoryIds: ['c1'] })).toEqual(['a', 'd']);
  });
});

describe('applyFilters: 복합 필터', () => {
  it('같은 필터 안은 OR', () => {
    expect(run({ statuses: ['todo', 'in-progress'] })).toEqual(['a', 'b']);
    expect(run({ assigneeIds: ['m2', UNASSIGNED] })).toEqual(['b', 'c']);
  });

  it('서로 다른 필터는 AND', () => {
    expect(run({ statuses: ['done'], assigneeIds: ['m1'] })).toEqual(['d']);
    expect(run({ statuses: ['done'], categoryIds: ['c1'], query: '운영' })).toEqual(['d']);
  });
});

describe('applyFilters: 마감 임박·지연', () => {
  const dueTasks: Task[] = [
    make({ id: 'late', due_date: '2026-10-06' }),
    make({ id: 'soon', due_date: '2026-10-10' }),
    make({ id: 'far', due_date: '2026-10-11' }),
    make({ id: 'none' }),
    make({ id: 'doneLate', due_date: '2026-10-01', status: 'done' }),
  ];
  const runDue = (dueStatuses: FilterState['dueStatuses']) =>
    applyFilters(dueTasks, { ...EMPTY_FILTERS, dueStatuses }, null, members, '2026-10-07').map(
      (t) => t.id,
    );

  it('지연만 / 임박만 / 둘 다(OR)', () => {
    expect(runDue(['overdue'])).toEqual(['late']);
    expect(runDue(['soon'])).toEqual(['soon']);
    expect(runDue(['soon', 'overdue'])).toEqual(['late', 'soon']);
  });

  it('완료·마감일 없는 항목은 제외', () => {
    expect(runDue(['overdue', 'soon'])).not.toContain('doneLate');
    expect(runDue(['overdue', 'soon'])).not.toContain('none');
  });
});

describe('applyFilters: 내 할일만', () => {
  it('담당자가 현재 사용자인 항목만', () => {
    expect(run({ mineOnly: true }, '김하늘')).toEqual(['a', 'd']);
  });

  it('다른 필터와 AND', () => {
    expect(run({ mineOnly: true, statuses: ['done'] }, '김하늘')).toEqual(['d']);
  });

  it('현재 사용자가 없거나 담당 항목이 없으면 0건', () => {
    expect(run({ mineOnly: true }, null)).toEqual([]);
    expect(run({ mineOnly: true }, '없는사람')).toEqual([]);
  });
});

describe('applyFilters: 결과 0건', () => {
  it('맞는 항목이 없으면 빈 배열', () => {
    expect(run({ query: '존재하지 않는 제목' })).toEqual([]);
    expect(run({ statuses: ['todo'], priorities: ['low'] })).toEqual([]);
  });
});
