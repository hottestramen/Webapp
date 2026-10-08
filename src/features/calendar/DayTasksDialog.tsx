import { useId } from 'react';
import { DueBadge, PriorityBadge, StatusBadge } from '../../components/Badges';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { Task } from '../../types';

interface DayTasksDialogProps {
  open: boolean;
  title: string;
  tasks: readonly Task[];
  today: string;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

/** "+N건 더보기"와 "마감일 없음 N건"이 여는 목록 팝오버 */
export function DayTasksDialog({
  open,
  title,
  tasks,
  today,
  onClose,
  onOpenTask,
}: DayTasksDialogProps) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="md">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <Button onClick={onClose}>닫기</Button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">할일이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="flex min-h-touch w-full flex-col gap-1 rounded-md border border-border bg-surface p-3 text-left"
                >
                  <span className="break-words text-sm font-semibold">{task.title}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    <DueBadge task={task} today={today} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
