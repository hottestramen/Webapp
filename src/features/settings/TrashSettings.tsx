import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { formatDateTime } from '../../lib/format';
import { isTrashed, TRASH_AFTER_DAYS } from '../../lib/trash';
import { useTaskStore } from '../../stores/taskStore';
import { toast } from '../../stores/toastStore';
import { useTodayStore } from '../../stores/todayStore';
import { SettingsSection } from './SettingsSection';

/** 휴지통: 완료 후 7일이 지난 할일. 복원하면 "할 일"로 되돌아간다. */
export function TrashSettings() {
  const tasks = useTaskStore((s) => s.tasks);
  const members = useTaskStore((s) => s.members);
  const today = useTodayStore((s) => s.today);

  const trashed = useMemo(
    () =>
      tasks
        .filter((t) => isTrashed(t, today))
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks, today],
  );
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  async function restore(id: string, title: string) {
    const ok = await useTaskStore.getState().changeStatus(id, 'todo');
    if (ok) toast.info(`"${title}"을(를) 할 일로 복원했습니다.`);
  }

  return (
    <SettingsSection
      title={`휴지통 (${trashed.length}건)`}
      description={`완료한 지 ${TRASH_AFTER_DAYS}일이 지난 할일이 칸반·목록·캘린더에서 빠져 이곳으로 옵니다. 복원하면 "할 일" 상태로 돌아갑니다. 대시보드 통계에는 계속 포함됩니다.`}
    >
      {trashed.length === 0 ? (
        <p className="text-sm text-text-muted">휴지통이 비어 있습니다.</p>
      ) : (
        <ul className="flex flex-col">
          {trashed.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-sm font-semibold">{task.title}</span>
                <span className="text-xs text-text-muted">
                  {(task.assignee_id && nameById.get(task.assignee_id)) || '담당자 미지정'} · 완료{' '}
                  {task.completed_at ? formatDateTime(task.completed_at) : ''}
                </span>
              </div>
              <Button
                aria-label={`${task.title} 복원`}
                onClick={() => void restore(task.id, task.title)}
              >
                복원
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
