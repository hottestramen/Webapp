import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../lib/api/errors';
import type { Task } from '../types';

// 충돌 저장(§5.8)·실시간 병합(§5.7) 로직을 스토어 단에서 검증한다. API 계층은 mock 한다.
const updateTaskApi = vi.fn();
const getTaskApi = vi.fn();
const createHolidayApi = vi.fn();

vi.mock('../lib/api', async () => {
  const errors = await import('../lib/api/errors');
  return {
    ...errors,
    updateTask: (...args: unknown[]) => updateTaskApi(...args),
    getTask: (...args: unknown[]) => getTaskApi(...args),
    createTask: vi.fn(),
    createCategory: vi.fn(),
    createHoliday: (...args: unknown[]) => createHolidayApi(...args),
    createMember: vi.fn(),
    createComment: vi.fn(),
    ensureMember: vi.fn(),
    listCategories: vi.fn(),
    listComments: vi.fn(),
    listHolidays: vi.fn(),
    listMembers: vi.fn(),
    listTasks: vi.fn(),
    pickAvatarColor: vi.fn(),
    restoreTask: vi.fn(),
    softDeleteTask: vi.fn(),
    softDeleteComment: vi.fn(),
    updateCategory: vi.fn(),
    updateMember: vi.fn(),
  };
});

const { useTaskStore } = await import('./taskStore');
const { useUserStore } = await import('./userStore');

const base: Task = {
  id: 't1',
  title: '3분기 보고서',
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_id: null,
  category_id: null,
  due_date: '2026-10-14',
  completed_at: null,
  created_by: '박팀장',
  updated_by: '박팀장',
  created_at: '2026-10-01T00:00:00.000000+00:00',
  updated_at: '2026-10-07T05:00:00.000001+00:00',
  deleted_at: null,
};

beforeEach(() => {
  updateTaskApi.mockReset();
  getTaskApi.mockReset();
  createHolidayApi.mockReset();
  useUserStore.setState({ name: '김하늘' });
  useTaskStore.setState({ tasks: [base], flashing: {} });
});

describe('saveTask (S6: 동시 편집)', () => {
  it('기준값이 같으면 저장되고 스토어가 서버 값으로 바뀐다', async () => {
    const saved = { ...base, title: '수정', updated_at: '2026-10-07T05:01:00.000000+00:00' };
    updateTaskApi.mockResolvedValue(saved);

    const result = await useTaskStore.getState().saveTask('t1', { title: '수정' }, base.updated_at);

    expect(result).toEqual({ status: 'ok', task: saved });
    expect(updateTaskApi).toHaveBeenCalledWith(
      't1',
      { title: '수정', updated_by: '김하늘' },
      { expectedUpdatedAt: base.updated_at },
    );
    expect(useTaskStore.getState().tasks[0]?.title).toBe('수정');
  });

  it('0행이면 conflict 와 서버 최신 값을 돌려주고, 스토어는 건드리지 않는다', async () => {
    const server = { ...base, due_date: '2026-10-20', updated_by: '박팀장' };
    updateTaskApi.mockRejectedValue(new ConflictError());
    getTaskApi.mockResolvedValue(server);

    const result = await useTaskStore
      .getState()
      .saveTask('t1', { title: '내 수정' }, base.updated_at);

    expect(result).toEqual({ status: 'conflict', server });
    expect(useTaskStore.getState().tasks[0]?.title).toBe('3분기 보고서');
  });

  it('충돌 중 그 사이 삭제됐다면 server 는 null', async () => {
    updateTaskApi.mockRejectedValue(new ConflictError());
    getTaskApi.mockResolvedValue(null);

    const result = await useTaskStore.getState().saveTask('t1', {}, base.updated_at);

    expect(result).toEqual({ status: 'conflict', server: null });
  });

  it('덮어쓰기(기준값 없음)는 조건 없이 보낸다', async () => {
    updateTaskApi.mockResolvedValue({ ...base, title: '내 수정' });

    await useTaskStore.getState().saveTask('t1', { title: '내 수정' });

    expect(updateTaskApi).toHaveBeenCalledWith(
      't1',
      { title: '내 수정', updated_by: '김하늘' },
      { expectedUpdatedAt: undefined },
    );
  });

  it('충돌이 아닌 오류는 error', async () => {
    updateTaskApi.mockRejectedValue(new Error('network'));

    const result = await useTaskStore.getState().saveTask('t1', {}, base.updated_at);

    expect(result).toEqual({ status: 'error' });
  });
});

describe('단일 필드 변경은 확인창 없이 last-write-wins', () => {
  it('changeStatus 는 기준값 조건 없이 보낸다', async () => {
    updateTaskApi.mockResolvedValue({ ...base, status: 'in-progress' });

    await useTaskStore.getState().changeStatus('t1', 'in-progress');

    const options = updateTaskApi.mock.calls[0]?.[2];
    expect(options).toBeUndefined();
  });
});

describe('실시간 병합 (§5.7)', () => {
  it('내 변경이 되돌아와도(같은 updated_at) 다시 반영하지 않고 강조하지 않는다', () => {
    useTaskStore.getState().applyRemoteTask({ ...base, updated_by: '김하늘' });

    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().flashing).toEqual({});
  });

  it('다른 팀원이 바꾸면 반영하고 강조한다', () => {
    const remote = {
      ...base,
      due_date: '2026-10-20',
      updated_by: '박팀장',
      updated_at: '2026-10-07T05:02:00.000000+00:00',
    };
    useTaskStore.getState().applyRemoteTask(remote);

    expect(useTaskStore.getState().tasks[0]?.due_date).toBe('2026-10-20');
    expect(useTaskStore.getState().flashing).toEqual({ t1: true });
  });

  it('더 오래된 변경은 무시한다(순서가 뒤바뀐 이벤트)', () => {
    useTaskStore.getState().applyRemoteTask({
      ...base,
      title: '오래된 값',
      updated_by: '박팀장',
      updated_at: '2026-10-07T04:00:00.000000+00:00',
    });

    expect(useTaskStore.getState().tasks[0]?.title).toBe('3분기 보고서');
  });

  it('새 할일(INSERT)은 같은 id 가 이미 있으면 중복되지 않는다', () => {
    useTaskStore.getState().applyRemoteTask({ ...base, updated_by: '박팀장' });
    useTaskStore.getState().applyRemoteTask({ ...base, id: 't2', updated_by: '박팀장' });

    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('deleted_at 이 채워진 UPDATE 는 삭제로 처리한다', () => {
    useTaskStore.getState().applyRemoteTask({
      ...base,
      deleted_at: '2026-10-07T05:03:00.000000+00:00',
      updated_at: '2026-10-07T05:03:00.000000+00:00',
    });

    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});

describe('설정: 임시공휴일 추가', () => {
  beforeEach(() => useTaskStore.setState({ holidays: [] }));

  it('올바른 날짜와 이름이면 등록하고 날짜순으로 보관한다', async () => {
    createHolidayApi.mockImplementation(async (h: unknown) => h);

    expect(await useTaskStore.getState().addHoliday('2026-12-31', '  임시공휴일 ')).toBeNull();
    expect(await useTaskStore.getState().addHoliday('2026-12-24', '성탄 연휴')).toBeNull();

    expect(createHolidayApi).toHaveBeenCalledWith({ date: '2026-12-31', name: '임시공휴일' });
    expect(useTaskStore.getState().holidays.map((h) => h.date)).toEqual([
      '2026-12-24',
      '2026-12-31',
    ]);
  });

  it('날짜가 없거나 형식이 틀리면 오류 메시지', async () => {
    for (const bad of ['', '2026-1-5', '20261231', 'abc']) {
      expect(await useTaskStore.getState().addHoliday(bad, '이름')).toBe('날짜를 선택하세요.');
    }
    expect(createHolidayApi).not.toHaveBeenCalled();
  });

  it('이름은 1~30자', async () => {
    expect(await useTaskStore.getState().addHoliday('2026-12-31', '   ')).toBe(
      '이름을 입력하세요.',
    );
    expect(await useTaskStore.getState().addHoliday('2026-12-31', 'a'.repeat(31))).toContain(
      '30자',
    );
    expect(createHolidayApi).not.toHaveBeenCalled();
  });

  it('같은 날짜(중복)는 안내 문구를 돌려준다', async () => {
    const { ApiError, UNIQUE_VIOLATION } = await import('../lib/api/errors');
    createHolidayApi.mockRejectedValue(new ApiError('dup', UNIQUE_VIOLATION));

    expect(await useTaskStore.getState().addHoliday('2026-12-31', '중복')).toBe(
      '이미 공휴일로 등록된 날짜입니다.',
    );
  });
});
