import { describe, expect, it } from 'vitest';
import { formatCommentTime, formatDateTime } from './format';

describe('formatCommentTime', () => {
  const now = new Date('2026-10-07T06:00:00Z');

  it('1분 미만은 방금 전', () => {
    expect(formatCommentTime('2026-10-07T05:59:30Z', now)).toBe('방금 전');
  });

  it('1시간 미만은 N분 전', () => {
    expect(formatCommentTime('2026-10-07T05:55:00Z', now)).toBe('5분 전');
  });

  it('그 이후는 서울 시각 날짜 표기', () => {
    expect(formatCommentTime('2026-10-07T04:30:00Z', now)).toBe('10월 7일 오후 1:30');
  });
});

describe('formatDateTime', () => {
  it('UTC 를 Asia/Seoul 로 변환', () => {
    expect(formatDateTime('2026-10-06T15:05:00Z')).toBe('10월 7일 오전 12:05');
  });
});
