import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { myConflictingEdits } from '../../lib/conflict';
import type { ConflictKey } from '../../lib/conflict';
import { formatDateTime, formatDueDate } from '../../lib/format';
import { PRIORITY_LABEL, STATUS_LABEL } from '../../lib/labels';
import { statusPatch } from '../../lib/taskRules';
import {
  ASSIGNEE_NAME_MAX,
  DESCRIPTION_MAX,
  TITLE_MAX,
  validateTaskForm,
} from '../../lib/taskValidation';
import type { TaskFormErrors } from '../../lib/taskValidation';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskFields } from '../../stores/taskStore';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import type { Task, TaskPriority, TaskStatus } from '../../types';

export const inputClass =
  'min-h-touch w-full rounded-md border border-border bg-surface px-3 text-base text-text';

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** 충돌 후 "최신 내용 보기"에서 보여 주는, 내가 입력했던 값 */
  mine?: string;
  children: ReactNode;
}

function Field({ id, label, required, hint, error, mine, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && <span className="text-text-muted"> (필수)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {mine !== undefined && (
        <p className="text-xs font-semibold text-text-muted">내 입력값: {mine || '(비어 있음)'}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, error: boolean) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

interface TaskFormProps {
  /** 수정할 할일. 없으면 새로 등록한다. */
  task?: Task;
  /** 등록 시 마감일 초깃값(캘린더 연동용) */
  defaultDueDate?: string;
  /**
   * 수정 중인 할일을 열었을 때(또는 마지막으로 저장·새로고침했을 때)의 updated_at.
   * 저장할 때 이 값과 같을 때만 갱신하고, 다르면 충돌 확인창을 띄운다(§5.8).
   */
  baselineUpdatedAt?: string;
  /** 저장·최신 내용 불러오기로 기준값이 바뀌었을 때 */
  onBaselineChange?: (updatedAt: string) => void;
  submitLabel: string;
  onDone: (saved: Task) => void;
  onCancel: () => void;
}

export function TaskForm({
  task,
  defaultDueDate,
  baselineUpdatedAt,
  onBaselineChange,
  submitLabel,
  onDone,
  onCancel,
}: TaskFormProps) {
  const members = useTaskStore((s) => s.members);
  const categories = useTaskStore((s) => s.categories);
  const { createTask, saveTask, resolveAssignee } = useTaskStore.getState();

  const baseId = useId();
  const id = (name: string) => `${baseId}-${name}`;

  const assigneeOf = task?.assignee_id ? members.find((m) => m.id === task.assignee_id) : undefined;

  // 기본값: status=todo, priority=medium (§4.8)
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [assigneeName, setAssigneeName] = useState(assigneeOf?.name ?? '');
  const [categoryId, setCategoryId] = useState(task?.category_id ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDueDate ?? '');
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 폼을 열었을 때의 할일 값. 충돌 후 "내가 실제로 바꾼 필드"만 골라 보여 주는 기준이다. */
  const initialTask = useRef(task);
  /** 충돌이 났을 때 서버의 최신 값(null 이면 그 사이 삭제됨)과 내가 보내려던 값 */
  const [conflict, setConflict] = useState<{ server: Task | null; mine: TaskFields } | null>(null);
  const [mine, setMine] = useState<Partial<Record<ConflictKey, string>>>({});

  const activeMembers = members.filter((m) => m.active);
  // 비활성 카테고리는 새로 고를 수 없지만, 이미 지정된 값은 보여 준다.
  const selectableCategories = categories.filter((c) => c.active || c.id === task?.category_id);

  async function resolveAssigneeId(): Promise<string | null> {
    const name = assigneeName.trim();
    if (!name) return null;
    // 이름을 바꾸지 않았다면 기존 담당자를 유지한다(비활성 팀원이어도).
    if (assigneeOf && assigneeOf.name === name) return assigneeOf.id;
    return resolveAssignee(name);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateTaskForm({ title, description, assigneeName });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const assignee_id = await resolveAssigneeId();
      // 상태가 바뀐 경우에만 completed_at 규칙(F-T-05)을 적용한다.
      const statusFields =
        task && task.status === status
          ? { status, completed_at: task.completed_at }
          : statusPatch(status);

      const fields: TaskFields = {
        title: title.trim(),
        description: description.trim() ? description : null,
        priority,
        assignee_id,
        category_id: categoryId || null,
        due_date: dueDate || null,
        ...statusFields,
      };

      if (task) {
        const result = await saveTask(task.id, fields, baselineUpdatedAt);
        if (result.status === 'ok') {
          onBaselineChange?.(result.task.updated_at);
          onDone(result.task);
        } else if (result.status === 'conflict') {
          setConflict({ server: result.server, mine: fields });
        } else {
          setFormError('저장하지 못했습니다. 다시 시도하세요.');
        }
      } else {
        const saved = await createTask(fields);
        if (saved) onDone(saved);
        else setFormError('저장하지 못했습니다. 다시 시도하세요.');
      }
    } catch {
      setFormError('담당자를 등록하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.');
    } finally {
      setSaving(false);
    }
  }

  const memberName = (memberId: string | null) =>
    memberId ? (members.find((m) => m.id === memberId)?.name ?? '알 수 없음') : '';
  const categoryName = (catId: string | null) =>
    catId ? (categories.find((c) => c.id === catId)?.name ?? '알 수 없음') : '';

  /** [최신 내용 보기] 서버 값을 불러오고, 내가 입력했던 값은 필드 옆에 "내 입력값"으로 남긴다. */
  function showLatest() {
    if (!conflict?.server || !task) return;
    const { server, mine: mineFields } = conflict;
    const differing = new Set(
      initialTask.current ? myConflictingEdits(mineFields, initialTask.current, server) : [],
    );
    const display: Record<ConflictKey, string> = {
      title: mineFields.title,
      description: mineFields.description ?? '',
      status: STATUS_LABEL[mineFields.status],
      priority: PRIORITY_LABEL[mineFields.priority],
      assignee: memberName(mineFields.assignee_id),
      category: categoryName(mineFields.category_id),
      due: mineFields.due_date ? formatDueDate(mineFields.due_date) : '',
    };
    setMine(
      Object.fromEntries(
        (Object.keys(display) as ConflictKey[])
          .filter((key) => differing.has(key))
          .map((key) => [key, display[key]]),
      ),
    );

    useTaskStore.getState().applyRemoteTask(server);
    setTitle(server.title);
    setDescription(server.description ?? '');
    setStatus(server.status);
    setPriority(server.priority);
    setAssigneeName(memberName(server.assignee_id));
    setCategoryId(server.category_id ?? '');
    setDueDate(server.due_date ?? '');
    onBaselineChange?.(server.updated_at);
    setConflict(null);
  }

  /** [내 내용으로 덮어쓰기] 조건 없이 다시 저장한다(last-write-wins). */
  async function overwrite() {
    if (!conflict || !task) return;
    setSaving(true);
    const result = await saveTask(task.id, conflict.mine);
    setSaving(false);
    setConflict(null);
    if (result.status === 'ok') {
      onBaselineChange?.(result.task.updated_at);
      onDone(result.task);
    } else {
      setFormError('저장하지 못했습니다. 다시 시도하세요.');
    }
  }

  /** 그 사이 다른 팀원이 삭제한 경우 */
  function closeDeleted() {
    setConflict(null);
    if (task) useTaskStore.getState().removeRemoteTask(task.id);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field id={id('title')} label="제목" required error={errors.title} mine={mine.title}>
        <input
          id={id('title')}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(id('title'), false, Boolean(errors.title))}
          maxLength={TITLE_MAX + 20}
          className={inputClass}
        />
      </Field>

      <Field
        id={id('description')}
        label="설명"
        hint={`${description.length.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()}자`}
        error={errors.description}
        mine={mine.description}
      >
        <textarea
          id={id('description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy(id('description'), true, Boolean(errors.description))}
          className={`${inputClass} py-2`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id={id('status')} label="상태" mine={mine.status}>
          <select
            id={id('status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className={inputClass}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id('priority')} label="우선순위" mine={mine.priority}>
          <select
            id={id('priority')}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={inputClass}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id={id('assignee')}
          label="담당자"
          hint="목록에서 고르거나 새 이름을 입력하면 팀원으로 등록됩니다. 비우면 미지정입니다."
          error={errors.assigneeName}
          mine={mine.assignee}
        >
          <input
            id={id('assignee')}
            type="text"
            value={assigneeName}
            onChange={(e) => setAssigneeName(e.target.value)}
            list={id('assignee-list')}
            autoComplete="off"
            maxLength={ASSIGNEE_NAME_MAX + 10}
            aria-invalid={errors.assigneeName ? true : undefined}
            aria-describedby={describedBy(id('assignee'), true, Boolean(errors.assigneeName))}
            className={inputClass}
          />
          <datalist id={id('assignee-list')}>
            {activeMembers.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </Field>

        <Field id={id('category')} label="카테고리" mine={mine.category}>
          <select
            id={id('category')}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">없음</option>
            {selectableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id('due')} label="마감일" mine={mine.due}>
          <input
            id={id('due')}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? '저장 중…' : submitLabel}
        </Button>
      </div>

      <Modal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        labelledBy={id('conflict-title')}
        size="md"
      >
        {conflict && (
          <div className="flex flex-col gap-4 p-5">
            <h2 id={id('conflict-title')} className="text-xl font-bold">
              {conflict.server ? '다른 팀원이 먼저 수정했습니다' : '삭제된 항목입니다'}
            </h2>
            {conflict.server ? (
              <>
                <p className="text-sm">
                  {conflict.server.updated_by}님이 {formatDateTime(conflict.server.updated_at)}에 이
                  항목을 수정했습니다. 어떻게 할까요?
                </p>
                <ul className="list-disc pl-5 text-sm text-text-muted">
                  <li>
                    최신 내용 보기: 서버의 값을 불러오고, 내가 입력한 값은 필드 옆에 남겨 둡니다.
                  </li>
                  <li>내 내용으로 덮어쓰기: 다른 팀원의 변경을 지우고 내 값으로 저장합니다.</li>
                </ul>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onClick={() => setConflict(null)} disabled={saving}>
                    취소
                  </Button>
                  <Button onClick={showLatest} disabled={saving}>
                    최신 내용 보기
                  </Button>
                  <Button variant="primary" onClick={() => void overwrite()} disabled={saving}>
                    내 내용으로 덮어쓰기
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">다른 팀원이 이 항목을 삭제했습니다. 저장할 수 없습니다.</p>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={closeDeleted}>
                    확인
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </form>
  );
}
