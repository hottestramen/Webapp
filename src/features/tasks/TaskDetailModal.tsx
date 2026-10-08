import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Assignee } from '../../components/Avatar';
import { DueBadge, PriorityBadge, StatusBadge } from '../../components/Badges';
import { Button } from '../../components/Button';
import { LinkifiedText } from '../../components/LinkifiedText';
import { Modal } from '../../components/Modal';
import { formatDateTime, formatDueDate } from '../../lib/format';
import { STATUS_LABEL } from '../../lib/labels';
import { compareTimestamps } from '../../lib/timestamps';
import { toast } from '../../stores/toastStore';
import { useUserStore } from '../../stores/userStore';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { TASK_STATUSES } from '../../types';
import type { Task, TaskStatus } from '../../types';
import { CommentSection } from '../comments/CommentSection';
import { inputClass, TaskForm } from './TaskForm';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId));
  const titleId = useId();

  // 열어 둔 할일이 사라지면(다른 팀원이 삭제 등) 안내하고 상세를 닫는다(PRD §5.7).
  // 내가 삭제할 때는 먼저 닫으므로 이 안내는 나오지 않는다.
  useEffect(() => {
    if (taskId !== null && !task) {
      toast.info('삭제된 항목입니다. 상세를 닫습니다.');
      onClose();
    }
  }, [taskId, task, onClose]);

  return (
    <Modal open={taskId !== null && Boolean(task)} onClose={onClose} labelledBy={titleId} panel>
      {task && <DetailBody key={task.id} task={task} titleId={titleId} onClose={onClose} />}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="col-span-2 break-words">{children}</dd>
    </div>
  );
}

interface DetailBodyProps {
  task: Task;
  titleId: string;
  onClose: () => void;
}

function DetailBody({ task, titleId, onClose }: DetailBodyProps) {
  const members = useTaskStore((s) => s.members);
  const categories = useTaskStore((s) => s.categories);
  const today = useTodayStore((s) => s.today);
  const me = useUserStore((s) => s.name);
  const [editing, setEditing] = useState(false);
  const statusId = useId();

  // 충돌 판정 기준값(§5.8): 상세를 열 때의 updated_at. 내가 저장한 뒤에는 새 값으로 바뀐다.
  const [baseline, setBaseline] = useState(task.updated_at);
  // 다른 팀원이 바꿨음을 알려 주는 배너를 띄울지
  const [foreign, setForeign] = useState(false);
  // 폼을 서버 값으로 다시 만들기 위한 키
  const [formKey, setFormKey] = useState(0);

  // 렌더 중 상태 보정: 열어 둔 사이에 값이 바뀌었을 때 누가 바꿨는지에 따라 처리한다.
  const changed = compareTimestamps(task.updated_at, baseline) !== 0;
  if (changed && !foreign) {
    if (task.updated_by === me) setBaseline(task.updated_at);
    else setForeign(true);
  } else if (!changed && foreign) {
    setForeign(false);
  }

  function reloadFromServer() {
    setBaseline(task.updated_at);
    setForeign(false);
    setFormKey((k) => k + 1);
  }

  const assignee = members.find((m) => m.id === task.assignee_id);
  const category = categories.find((c) => c.id === task.category_id);

  function handleDelete() {
    if (!window.confirm(`"${task.title}" 할일을 삭제할까요?`)) return;
    onClose();
    void useTaskStore.getState().softDeleteTask(task.id);
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="min-w-0 break-words text-xl font-bold">
          {task.title}
        </h2>
        <Button onClick={onClose} aria-label="상세 닫기">
          닫기
        </Button>
      </div>

      {foreign && changed && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-badge-due-soon-bg p-3 text-sm font-semibold text-badge-due-soon-text"
        >
          <span>{task.updated_by}님이 이 항목을 수정했습니다</span>
          <Button onClick={reloadFromServer}>새로고침</Button>
        </div>
      )}

      {editing ? (
        <TaskForm
          key={formKey}
          task={task}
          baselineUpdatedAt={baseline}
          onBaselineChange={setBaseline}
          submitLabel="저장"
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <DueBadge task={task} today={today} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={statusId} className="text-sm font-semibold">
              상태 변경
            </label>
            <select
              id={statusId}
              value={task.status}
              onChange={(e) =>
                void useTaskStore.getState().changeStatus(task.id, e.target.value as TaskStatus)
              }
              className={inputClass}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <dl className="flex flex-col gap-2">
            <Row label="설명">
              {/* 텍스트로만 렌더하고 줄바꿈은 유지한다 */}
              <span className="whitespace-pre-wrap">
                {task.description ? <LinkifiedText text={task.description} /> : '—'}
              </span>
            </Row>
            <Row label="담당자">
              <Assignee member={assignee} />
            </Row>
            <Row label="카테고리">{category?.name ?? '—'}</Row>
            <Row label="마감일">{task.due_date ? formatDueDate(task.due_date) : '—'}</Row>
            {task.completed_at && <Row label="완료 시각">{formatDateTime(task.completed_at)}</Row>}
            <Row label="작성">
              {task.created_by} · {formatDateTime(task.created_at)}
            </Row>
            <Row label="마지막 수정">
              {task.updated_by} · {formatDateTime(task.updated_at)}
            </Row>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button onClick={handleDelete}>삭제</Button>
          </div>
        </>
      )}

      <hr className="border-border" />
      <CommentSection taskId={task.id} />
    </div>
  );
}
