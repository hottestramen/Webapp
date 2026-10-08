import { describe, expect, it } from 'vitest';
import { sortTasks } from './taskSort';
import type { SortContext } from './taskSort';
import type { Task } from '../types';

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
  created_at: '',
  updated_at: '',
  deleted_at: null,
  ...over,
});

const ctx: SortContext = {
  assigneeName: (t) => (t.assignee_id ? `이름-${t.assignee_id}` : null),
  categoryName: () => null,
  commentCount: (t) => Number(t.id.replace(/\D/g, '') || 0),
};

const a = make({ id: 'a1', title: '가', due_date: '2026-10-20', priority: 'low', status: 'done' });
const b = make({ id: 'b2', title: '나', due_date: '2026-10-05', priority: 'high' });
const c = make({
  id: 'c3',
  title: '다',
  due_date: null,
  priority: 'medium',
  status: 'in-progress',
});
const ids = (xs: Task[]) => xs.map((t) => t.id);

describe('sortTasks', () => {
  it('마감일 오름/내림, 마감일 없음은 항상 뒤', () => {
    expect(ids(sortTasks([a, b, c], 'due', 'asc', ctx))).toEqual(['b2', 'a1', 'c3']);
    expect(ids(sortTasks([a, b, c], 'due', 'desc', ctx))).toEqual(['a1', 'b2', 'c3']);
  });

  it('우선순위는 높음이 오름차순 앞', () => {
    expect(ids(sortTasks([a, b, c], 'priority', 'asc', ctx))).toEqual(['b2', 'c3', 'a1']);
  });

  it('상태는 할 일 → 진행 중 → 완료', () => {
    expect(ids(sortTasks([a, b, c], 'status', 'asc', ctx))).toEqual(['b2', 'c3', 'a1']);
  });

  it('제목은 가나다순', () => {
    expect(ids(sortTasks([c, a, b], 'title', 'asc', ctx))).toEqual(['a1', 'b2', 'c3']);
    expect(ids(sortTasks([c, a, b], 'title', 'desc', ctx))).toEqual(['c3', 'b2', 'a1']);
  });

  it('댓글 수 정렬', () => {
    expect(ids(sortTasks([a, b, c], 'comments', 'desc', ctx))).toEqual(['c3', 'b2', 'a1']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const input = [c, a, b];
    sortTasks(input, 'title', 'asc', ctx);
    expect(ids(input)).toEqual(['c3', 'a1', 'b2']);
  });
});
