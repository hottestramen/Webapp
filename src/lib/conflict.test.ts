import { describe, expect, it } from 'vitest';
import { conflictingFields, myConflictingEdits } from './conflict';
import type { Task } from '../types';

const server: Task = {
  id: 't1',
  title: '3분기 보고서',
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_id: 'm1',
  category_id: null,
  due_date: '2026-10-14',
  completed_at: null,
  created_by: 'a',
  updated_by: 'b',
  created_at: '',
  updated_at: '',
  deleted_at: null,
};

const mineSame = {
  title: server.title,
  description: server.description,
  status: server.status,
  priority: server.priority,
  assignee_id: server.assignee_id,
  category_id: server.category_id,
  due_date: server.due_date,
};

describe('conflictingFields', () => {
  it('같으면 빈 배열', () => {
    expect(conflictingFields(mineSame, server)).toEqual([]);
  });

  it('다른 필드만 돌려준다 (S6: 한 쪽이 마감일을 바꾼 경우)', () => {
    expect(conflictingFields({ ...mineSame, due_date: '2026-10-20' }, server)).toEqual(['due']);
  });

  it('여러 필드와 null 처리', () => {
    expect(
      conflictingFields(
        { ...mineSame, title: '수정', description: '메모', assignee_id: null, category_id: 'c1' },
        server,
      ),
    ).toEqual(['title', 'description', 'assignee', 'category']);
  });
});

describe('myConflictingEdits: 내가 실제로 바꾼 필드만', () => {
  const initial = { ...mineSame };

  it('내가 제목만 바꾸고 상대는 마감일만 바꿨다면 제목만 내 입력값', () => {
    const mine = { ...mineSame, title: '내가 바꾼 제목' };
    const serverNow = { ...server, due_date: '2026-12-24' };
    expect(myConflictingEdits(mine, initial, serverNow)).toEqual(['title']);
  });

  it('둘 다 같은 필드를 바꿨다면 그 필드가 내 입력값', () => {
    const mine = { ...mineSame, due_date: '2026-12-31' };
    const serverNow = { ...server, due_date: '2026-12-24' };
    expect(myConflictingEdits(mine, initial, serverNow)).toEqual(['due']);
  });

  it('내가 바꾼 값이 서버 값과 같아졌다면(수렴) 표시하지 않는다', () => {
    const mine = { ...mineSame, due_date: '2026-12-24' };
    const serverNow = { ...server, due_date: '2026-12-24' };
    expect(myConflictingEdits(mine, initial, serverNow)).toEqual([]);
  });

  it('내가 아무것도 바꾸지 않았다면 빈 배열', () => {
    expect(myConflictingEdits(mineSame, initial, { ...server, title: '상대 수정' })).toEqual([]);
  });
});
