import { useDraggable } from '@dnd-kit/core';
import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { Assignee } from '../../components/Avatar';
import { DueBadge, PriorityBadge } from '../../components/Badges';
import { formatDueDate } from '../../lib/format';
import { cardClass } from './cardClass';
import { isTempId } from '../../lib/taskRules';
import { useTaskStore } from '../../stores/taskStore';
import type { Member, Task } from '../../types';

interface CardViewProps {
  task: Task;
  assignee: Member | undefined;
  commentCount: number;
  today: string;
}

/** 카드의 보이는 내용. 드래그 오버레이에도 그대로 쓴다. */
export function TaskCardContent({ task, assignee, commentCount, today }: CardViewProps) {
  return (
    <>
      <p className="break-words text-base font-semibold">{task.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <PriorityBadge priority={task.priority} />
        <DueBadge task={task} today={today} />
      </div>

      {task.due_date && (
        <p className="mt-2 text-xs text-text-muted">마감 {formatDueDate(task.due_date)}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Assignee member={assignee} />
        <span className="shrink-0 text-xs text-text-muted" aria-label={`댓글 ${commentCount}개`}>
          댓글 {commentCount}
        </span>
      </div>
    </>
  );
}

interface TaskCardProps extends CardViewProps {
  /** 모바일에서는 드래그 대신 상세의 상태 드롭다운을 쓴다(PRD §5.1) */
  dragEnabled: boolean;
  onOpen: (id: string) => void;
}

export const TaskCard = memo(function TaskCard({ onOpen, dragEnabled, ...view }: TaskCardProps) {
  const { task } = view;
  const saving = isTempId(task.id);
  const flashing = useTaskStore((s) => s.flashing[task.id] === true);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: saving || !dragEnabled,
  });

  // 드래그를 쓸 수 없는 화면(모바일)에서는 dnd-kit 이 붙이는 aria-disabled·"draggable" 안내를 빼고
  // 평범한 버튼으로 읽히게 한다. 상세 열기는 그대로 가능하다.
  const a11yAttributes = dragEnabled
    ? attributes
    : { role: 'button', tabIndex: 0, 'aria-disabled': undefined };

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(event);
    // 드래그 중이 아닐 때 Enter 는 상세 열기(드래그 시작은 Space)
    if (event.key === 'Enter' && !isDragging && !saving) {
      // 상세가 열리면 포커스가 모달 안의 버튼으로 옮겨 가는데, 이 Enter 입력이 그 버튼의 클릭으로
      // 이어져 곧바로 닫히지 않도록 기본 동작을 막는다.
      event.preventDefault();
      onOpen(task.id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...a11yAttributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (!saving) onOpen(task.id);
      }}
      aria-busy={saving || undefined}
      className={`${cardClass(task, flashing)} cursor-pointer transition duration-fast ease-brand hover:-translate-y-lift ${
        isDragging ? 'opacity-50' : ''
      } ${saving ? 'opacity-70' : ''}`}
    >
      <TaskCardContent {...view} />
    </div>
  );
});
