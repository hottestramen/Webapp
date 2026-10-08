import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackup } from './exportData';

describe('exportData', () => {
  it('파일명에 서울 기준 날짜가 들어간다', () => {
    expect(backupFileName(new Date('2026-10-06T15:30:00Z'))).toBe(
      'team-calendar-backup-2026-10-07.json',
    );
  });

  it('5개 테이블과 건수를 담는다', () => {
    const backup = buildBackup(
      { tasks: [], comments: [], members: [], categories: [], leaves: [] },
      new Date('2026-10-07T00:00:00Z'),
    );
    expect(backup.counts).toEqual({
      tasks: 0,
      comments: 0,
      members: 0,
      categories: 0,
      leaves: 0,
    });
    expect(backup.exportedAt).toBe('2026-10-07T00:00:00.000Z');
    expect(Object.keys(backup)).toEqual(
      expect.arrayContaining(['tasks', 'comments', 'members', 'categories', 'leaves']),
    );
  });
});
