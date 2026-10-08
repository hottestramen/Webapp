import { describe, expect, it } from 'vitest';
import {
  assigneeLoad,
  completionRate,
  dueSoonCount,
  overdueCount,
  recentCompletions,
  statusCounts,
  weeklyCompletions,
} from './metrics';
import { applyFilters, EMPTY_FILTERS } from '../filters/applyFilters';
import type { Member, Task } from '../../types';

// 오늘 = 2026-10-07 (수). 이번 주 월요일 = 10-05.
const today = '2026-10-07';

const members: Member[] = [
  { id: 'kim', name: '김하늘', color: 'avatar-1', active: true, created_at: '' },
  { id: 'lee', name: '이도윤', color: 'avatar-2', active: true, created_at: '' },
  { id: 'old', name: '박퇴사', color: 'avatar-3', active: false, created_at: '' },
];

const make = (id: string, over: Partial<Task>): Task => ({
  id,
  title: id,
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_id: null,
  category_id: null,
  due_date: null,
  completed_at: null,
  created_by: 'a',
  updated_by: 'a',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

// 샘플 12건
const tasks: Task[] = [
  make('t1', { assignee_id: 'kim', due_date: '2026-10-06' }), // todo, 지연 +1
  make('t2', { assignee_id: 'kim', due_date: '2026-10-07' }), // todo, D-day
  make('t3', { assignee_id: 'kim', status: 'in-progress', due_date: '2026-10-10' }), // D-3
  make('t4', { assignee_id: 'lee', due_date: '2026-10-11' }), // D-4: 배지 없음
  make('t5', { assignee_id: 'lee', status: 'in-progress', due_date: '2026-09-30' }), // 지연
  make('t6', { assignee_id: null }), // 미지정, 마감일 없음
  make('t7', { assignee_id: null, due_date: '2026-10-08' }), // 미지정, D-1
  make('t8', {
    assignee_id: 'kim',
    status: 'done',
    due_date: '2026-10-01', // 완료라 지연 아님
    completed_at: '2026-10-06T05:00:00Z', // 이번 주(10-05 주)
  }),
  make('t9', {
    assignee_id: 'lee',
    status: 'done',
    completed_at: '2026-10-04T14:59:00Z', // 서울 10-04 23:59 일요일 → 지난주(09-28 주)
  }),
  make('t10', {
    assignee_id: 'old',
    status: 'done',
    completed_at: '2026-10-04T15:00:00Z', // 서울 10-05 00:00 월요일 → 이번 주
  }),
  make('t11', { assignee_id: 'lee', status: 'done', completed_at: '2026-08-01T00:00:00Z' }), // 8주 밖
  make('t12', { assignee_id: 'old', status: 'in-progress' }),
];

describe('statusCounts (F-M-01)', () => {
  it('상태별 건수', () => {
    expect(statusCounts(tasks)).toEqual({ todo: 5, 'in-progress': 3, done: 4 });
  });

  it('빈 목록은 모두 0', () => {
    expect(statusCounts([])).toEqual({ todo: 0, 'in-progress': 0, done: 0 });
  });
});

describe('completionRate (F-M-02)', () => {
  it('done ÷ 전체 × 100, 소수점 첫째 자리 반올림', () => {
    expect(completionRate(tasks)).toBe(33.3); // 4/12
    expect(completionRate(tasks.slice(0, 3))).toBe(0);
    expect(completionRate([make('a', { status: 'done' }), make('b', {}), make('c', {})])).toBe(
      33.3,
    );
    expect(
      completionRate([make('a', { status: 'done' }), make('b', { status: 'done' }), make('c', {})]),
    ).toBe(66.7);
  });

  it('전체 0건이면 null', () => {
    expect(completionRate([])).toBeNull();
  });

  it('전부 완료면 100', () => {
    expect(completionRate([make('a', { status: 'done' })])).toBe(100);
  });
});

describe('assigneeLoad (F-M-03)', () => {
  it('담당자별 미완료 건수를 많은 순으로, 미지정은 맨 뒤', () => {
    expect(assigneeLoad(tasks, members)).toEqual([
      { assigneeId: 'kim', name: '김하늘', count: 3 }, // t1 t2 t3
      { assigneeId: 'lee', name: '이도윤', count: 2 }, // t4 t5
      { assigneeId: 'old', name: '박퇴사', count: 1 }, // t12 (비활성이어도 이름 유지)
      { assigneeId: null, name: '미지정', count: 2 }, // t6 t7
    ]);
  });

  it('완료 항목은 세지 않고, 미완료가 없는 담당자는 행이 없다', () => {
    const rows = assigneeLoad([make('a', { assignee_id: 'kim', status: 'done' })], members);
    expect(rows).toEqual([]);
  });

  it('건수가 같으면 이름순', () => {
    const rows = assigneeLoad(
      [make('a', { assignee_id: 'lee' }), make('b', { assignee_id: 'kim' })],
      members,
    );
    expect(rows.map((r) => r.name)).toEqual(['김하늘', '이도윤']);
  });

  it('미지정 건이 없으면 미지정 행도 없다', () => {
    expect(
      assigneeLoad([make('a', { assignee_id: 'kim' })], members).some((r) => r.assigneeId === null),
    ).toBe(false);
  });
});

describe('dueSoonCount / overdueCount (F-M-04, F-M-05)', () => {
  it('임박: D-day ~ D-3 미완료', () => {
    expect(dueSoonCount(tasks, today)).toBe(3); // t2 t3 t7
  });

  it('지연: 마감일이 지난 미완료(완료 제외)', () => {
    expect(overdueCount(tasks, today)).toBe(2); // t1 t5
  });

  it('두 값은 겹치지 않는다', () => {
    expect(dueSoonCount(tasks, today) + overdueCount(tasks, today)).toBeLessThanOrEqual(
      tasks.length,
    );
  });
});

describe('weeklyCompletions (F-M-06)', () => {
  const weeks = weeklyCompletions(tasks, today);

  it('최근 8주, 오래된 주부터, 월요일 시작', () => {
    expect(weeks).toHaveLength(8);
    expect(weeks[7]?.weekStart).toBe('2026-10-05');
    expect(weeks[6]?.weekStart).toBe('2026-09-28');
    expect(weeks[0]?.weekStart).toBe('2026-08-17');
  });

  it('서울 시각 기준 주 경계로 센다', () => {
    expect(weeks[7]?.count).toBe(2); // t8, t10(월요일 00:00 KST)
    expect(weeks[6]?.count).toBe(1); // t9(일요일 23:59 KST)
  });

  it('8주 밖과 completed_at 없는 항목은 세지 않는다', () => {
    expect(weeks.reduce((sum, w) => sum + w.count, 0)).toBe(3);
  });
});

describe('recentCompletions (F-M-07)', () => {
  it('completed_at 최신순', () => {
    // t8(10-06) > t10(10-04 15:00Z) > t9(10-04 14:59Z) > t11(08-01)
    expect(recentCompletions(tasks).map((t) => t.id)).toEqual(['t8', 't10', 't9', 't11']);
  });

  it('20건까지만', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      make(`d${i}`, {
        status: 'done',
        completed_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      }),
    );
    expect(recentCompletions(many)).toHaveLength(20);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const copy = [...tasks];
    recentCompletions(tasks);
    expect(tasks).toEqual(copy);
  });
});

describe('필터와 함께 쓰기 (S5: 담당자 필터가 지표에 반영)', () => {
  it('담당자 김하늘만 걸면 모든 지표가 그 담당자 기준', () => {
    const filtered = applyFilters(
      tasks,
      { ...EMPTY_FILTERS, assigneeIds: ['kim'] },
      null,
      members,
      today,
    );
    expect(statusCounts(filtered)).toEqual({ todo: 2, 'in-progress': 1, done: 1 });
    expect(completionRate(filtered)).toBe(25);
    expect(overdueCount(filtered, today)).toBe(1);
    expect(dueSoonCount(filtered, today)).toBe(2);
    expect(assigneeLoad(filtered, members)).toEqual([
      { assigneeId: 'kim', name: '김하늘', count: 3 },
    ]);
  });
});
