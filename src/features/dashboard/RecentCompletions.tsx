import { formatDateTime } from '../../lib/format';
import type { Member, Task } from '../../types';

interface RecentCompletionsProps {
  tasks: Task[];
  members: readonly Member[];
  onOpen: (id: string) => void;
}

/** 최근 완료 이력 20건(F-M-07): 제목·담당자·완료 시각 */
export function RecentCompletions({ tasks, members, onOpen }: RecentCompletionsProps) {
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  return (
    <section
      aria-labelledby="recent-completions-heading"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card"
    >
      <h3 id="recent-completions-heading" className="text-lg font-semibold">
        최근 완료 이력
      </h3>

      {tasks.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">완료한 할일이 없습니다.</p>
      ) : (
        <ol className="flex flex-col">
          {tasks.map((task) => (
            <li key={task.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className="flex min-h-touch w-full flex-col gap-1 py-2 text-left md:flex-row md:items-center md:gap-3"
              >
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {task.title}
                </span>
                <span className="text-xs text-text-muted">
                  {(task.assignee_id && nameById.get(task.assignee_id)) || '담당자 미지정'}
                </span>
                <span className="text-xs text-text-muted">
                  {task.completed_at ? formatDateTime(task.completed_at) : ''}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
