import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ConflictError } from './errors';

// supabase 호출은 mock 한다. 쿼리 체인에 어떤 조건이 붙었는지와 "갱신된 행 수" 처리를 검증한다(PRD §5.8).
interface Call {
  method: string;
  args: unknown[];
}

let calls: Call[] = [];
let result: { data: unknown; error: unknown } = { data: [], error: null };

function builder() {
  const b: Record<string, unknown> = {};
  for (const method of ['update', 'eq', 'is', 'select', 'insert', 'order']) {
    b[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(() => builder()) },
}));

const { updateTask } = await import('./tasks');

const row = { id: 't1', title: '제목', updated_at: '2026-10-07T05:00:00.000002+00:00' };
const patch = { title: '새 제목', updated_by: '김하늘' };
const eqCalls = () => calls.filter((c) => c.method === 'eq').map((c) => c.args);

beforeEach(() => {
  calls = [];
  result = { data: [], error: null };
});

describe('updateTask: updated_at 조건부 저장 (§5.8)', () => {
  it('기준값을 주면 id 와 updated_at 조건으로 보낸다', async () => {
    result = { data: [row], error: null };
    await updateTask('t1', patch, { expectedUpdatedAt: '2026-10-07T05:00:00.000001+00:00' });

    expect(eqCalls()).toEqual([
      ['id', 't1'],
      ['updated_at', '2026-10-07T05:00:00.000001+00:00'],
    ]);
  });

  it('1행이 갱신되면 성공: 갱신된 행을 돌려준다', async () => {
    result = { data: [row], error: null };
    await expect(
      updateTask('t1', patch, { expectedUpdatedAt: '2026-10-07T05:00:00.000001+00:00' }),
    ).resolves.toEqual(row);
  });

  it('0행이 갱신되면 충돌: ConflictError', async () => {
    result = { data: [], error: null };
    await expect(
      updateTask('t1', patch, { expectedUpdatedAt: '2026-10-07T05:00:00.000001+00:00' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('덮어쓰기(기준값 없음)는 updated_at 조건을 붙이지 않는다', async () => {
    result = { data: [row], error: null };
    await updateTask('t1', patch);

    expect(eqCalls()).toEqual([['id', 't1']]);
  });

  it('기준값 없이 0행이면 충돌이 아니라 "찾을 수 없음" 오류', async () => {
    result = { data: [], error: null };
    const error = await updateTask('t1', patch).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(ConflictError);
  });

  it('DB 오류는 ApiError 로 던진다', async () => {
    result = { data: null, error: { message: 'boom', code: '500', details: '', hint: '' } };
    await expect(updateTask('t1', patch, { expectedUpdatedAt: 'x' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
