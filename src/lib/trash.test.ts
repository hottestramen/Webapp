import { describe, expect, it } from 'vitest';
import { isTrashed, TRASH_AFTER_DAYS } from './trash';

const done = (completed_at: string | null) => ({ status: 'done' as const, completed_at });

describe('isTrashed', () => {
  it(`완료 후 ${TRASH_AFTER_DAYS}일이 지나면 휴지통(서울 날짜 기준)`, () => {
    // 2026-10-01 23:30 KST 에 완료
    const at = '2026-10-01T14:30:00Z';
    expect(isTrashed(done(at), '2026-10-07')).toBe(false); // 6일째
    expect(isTrashed(done(at), '2026-10-08')).toBe(true); // 7일째
  });

  it('자정 경계: UTC 로는 전날이어도 서울 날짜로 센다', () => {
    const at = '2026-10-01T15:10:00Z'; // 서울 10-02 00:10
    expect(isTrashed(done(at), '2026-10-08')).toBe(false);
    expect(isTrashed(done(at), '2026-10-09')).toBe(true);
  });

  it('미완료·완료 시각 없음은 해당하지 않는다', () => {
    expect(isTrashed({ status: 'todo', completed_at: null }, '2030-01-01')).toBe(false);
    expect(isTrashed(done(null), '2030-01-01')).toBe(false);
  });
});
