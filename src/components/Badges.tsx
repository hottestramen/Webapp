import type { ReactNode } from 'react';
import { getDueLabel, getDueStatus } from '../lib/dueStatus';
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
} from '../lib/labels';
import type { Task, TaskPriority, TaskStatus } from '../types';

function Badge({
  className,
  compact = false,
  children,
}: {
  className: string;
  /** 캘린더 셀처럼 좁은 곳에서 쓰는 작은 크기 */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill text-xs font-semibold ${
        compact ? 'px-1' : 'px-2 py-1'
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** 색과 함께 항상 텍스트 라벨을 표시한다(색 의존 금지, PRD §5.3). */
export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={STATUS_BADGE_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge className={PRIORITY_BADGE_CLASS[priority]}>우선순위 {PRIORITY_LABEL[priority]}</Badge>
  );
}

interface DueBadgeProps {
  task: Pick<Task, 'status' | 'due_date'>;
  today: string;
  compact?: boolean;
}

/** 임박은 연한 주황, 지연은 채운 빨강(가장 눈에 띄게, PRD §6.3). 해당 없으면 아무것도 그리지 않는다. */
export function DueBadge({ task, today, compact }: DueBadgeProps) {
  const status = getDueStatus(task, today);
  const label = getDueLabel(task, today);
  if (!status || !label) return null;

  return (
    <Badge
      compact={compact}
      className={
        status === 'overdue'
          ? 'bg-badge-overdue-bg text-badge-overdue-text'
          : 'bg-badge-due-soon-bg text-badge-due-soon-text'
      }
    >
      {label}
    </Badge>
  );
}
