import { todayInSeoul } from './dueStatus';
import type { Category, Comment, Leave, Member, Task } from '../types';

export interface BackupData {
  tasks: Task[];
  comments: Comment[];
  members: Member[];
  categories: Category[];
  leaves: Leave[];
}

export const BACKUP_VERSION = 1;

/** 내보내기 JSON 의 내용. 삭제된(deleted_at) 행은 RLS 때문에 읽을 수 없어 포함되지 않는다. */
export function buildBackup(data: BackupData, now: Date = new Date()) {
  return {
    app: 'team-calendar',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    counts: {
      tasks: data.tasks.length,
      comments: data.comments.length,
      members: data.members.length,
      categories: data.categories.length,
      leaves: data.leaves.length,
    },
    tasks: data.tasks,
    comments: data.comments,
    members: data.members,
    categories: data.categories,
    leaves: data.leaves,
  };
}

/** 'team-calendar-backup-2026-10-07.json' (Asia/Seoul 날짜) */
export function backupFileName(now: Date = new Date()): string {
  return `team-calendar-backup-${todayInSeoul(now)}.json`;
}
