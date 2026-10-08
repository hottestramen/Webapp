import { memo, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Assignee } from '../../components/Avatar';
import { DueBadge } from '../../components/Badges';
import { formatDueDate } from '../../lib/format';
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
} from '../../lib/labels';
import { isTempId } from '../../lib/taskRules';
import { sortTasks } from '../../lib/taskSort';
import type { SortDir, SortKey } from '../../lib/taskSort';
import { useIsWideScreen } from '../../lib/useMediaQuery';
import { useProgressiveRows } from '../../lib/useProgressiveRows';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import type { Member, Task, TaskPriority, TaskStatus } from '../../types';
import { useCommentCounts } from '../comments/useCommentCounts';
import { useFilteredTasks } from '../filters/useFilteredTasks';
import { EmptyResult } from '../filters/EmptyResult';

const COLUMNS: readonly { key: SortKey; label: string }[] = [
  { key: 'title', label: '제목' },
  { key: 'status', label: '상태' },
  { key: 'priority', label: '우선순위' },
  { key: 'assignee', label: '담당자' },
  { key: 'category', label: '카테고리' },
  { key: 'due', label: '마감일' },
  { key: 'comments', label: '댓글' },
];

interface InlineSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  colorClass: string;
  disabled: boolean;
  onChange: (value: T) => void;
}

/** 행 안에서 바로 바꾸는 드롭다운. 배지 색을 입혀 색과 텍스트 라벨을 함께 보여 준다. */
function InlineSelect<T extends string>({
  label,
  value,
  options,
  labels,
  colorClass,
  disabled,
  onChange,
}: InlineSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      // 행 클릭·Enter(상세 열기)로 번지지 않게 한다
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`min-h-touch max-w-full rounded-pill border-0 px-3 text-xs font-semibold ${colorClass}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o]}
        </option>
      ))}
    </select>
  );
}

function StatusSelect({ task }: { task: Task }) {
  return (
    <InlineSelect<TaskStatus>
      label={`${task.title} 상태`}
      value={task.status}
      options={TASK_STATUSES}
      labels={STATUS_LABEL}
      colorClass={STATUS_BADGE_CLASS[task.status]}
      disabled={isTempId(task.id)}
      onChange={(s) => void useTaskStore.getState().changeStatus(task.id, s)}
    />
  );
}

function PrioritySelect({ task }: { task: Task }) {
  return (
    <InlineSelect<TaskPriority>
      label={`${task.title} 우선순위`}
      value={task.priority}
      options={TASK_PRIORITIES}
      labels={PRIORITY_LABEL}
      colorClass={PRIORITY_BADGE_CLASS[task.priority]}
      disabled={isTempId(task.id)}
      onChange={(p) => void useTaskStore.getState().updateTask(task.id, { priority: p })}
    />
  );
}

const stripe = (task: Task) =>
  task.priority === 'high' ? 'border-l-stripe border-l-badge-high-text' : '';

interface RowProps {
  task: Task;
  assignee: Member | undefined;
  categoryName: string | null;
  commentCount: number;
  today: string;
  flashing: boolean;
  onOpen: (id: string) => void;
}

// 행은 메모이즈한다: 필터·정렬로 목록이 바뀌어도 내용이 같은 행은 다시 그리지 않는다(PRD §5.2).
const TableRow = memo(function TableRow({
  task,
  assignee,
  categoryName,
  commentCount,
  today,
  flashing,
  onOpen,
}: RowProps) {
  const open = () => {
    if (!isTempId(task.id)) onOpen(task.id);
  };

  function handleKeyDown(event: KeyboardEvent) {
    // 행 자체에 포커스가 있을 때의 Enter 만 상세 열기로 쓴다
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault(); // 열린 상세의 버튼이 같은 Enter 로 눌리지 않게 한다
      open();
    }
  }

  return (
    <tr
      tabIndex={0}
      onClick={open}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer border-b border-border last:border-b-0 ${stripe(task)} ${
        flashing ? 'bg-badge-progress-bg' : ''
      }`}
    >
      <td className="px-3 py-2 font-semibold">{task.title}</td>
      <td className="px-3 py-1">
        <StatusSelect task={task} />
      </td>
      <td className="px-3 py-1">
        <PrioritySelect task={task} />
      </td>
      <td className="px-3 py-2">
        <Assignee member={assignee} />
      </td>
      <td className="px-3 py-2">{categoryName || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {task.due_date ? formatDueDate(task.due_date) : '—'}
          <DueBadge task={task} today={today} />
        </div>
      </td>
      <td className="px-3 py-2">{commentCount}</td>
    </tr>
  );
});

/** 모바일(<md): 표 대신 카드형 행 */
const CardRow = memo(function CardRow({
  task,
  assignee,
  categoryName,
  commentCount,
  today,
  onOpen,
}: RowProps) {
  const open = () => {
    if (!isTempId(task.id)) onOpen(task.id);
  };

  return (
    <li>
      <div
        onClick={open}
        className={`flex flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-card ${stripe(task)}`}
      >
        <button
          type="button"
          onClick={open}
          className="min-h-touch break-words text-left text-base font-semibold"
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect task={task} />
          <PrioritySelect task={task} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          {task.due_date && <span>마감 {formatDueDate(task.due_date)}</span>}
          <DueBadge task={task} today={today} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Assignee member={assignee} />
          <span className="text-xs text-text-muted">
            {categoryName || '카테고리 없음'}
            {' · '}댓글 {commentCount}
          </span>
        </div>
      </div>
    </li>
  );
});

export function ListView({ onOpen }: { onOpen: (id: string) => void }) {
  const { tasks, total, isFiltered } = useFilteredTasks();
  const members = useTaskStore((s) => s.members);
  const categories = useTaskStore((s) => s.categories);
  const loading = useTaskStore((s) => s.loading);
  const today = useTodayStore((s) => s.today);
  const commentCounts = useCommentCounts();
  const flashing = useTaskStore((s) => s.flashing);
  const isWide = useIsWideScreen();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const sorted = useMemo(() => {
    if (!sort) return tasks;
    return sortTasks(tasks, sort.key, sort.dir, {
      assigneeName: (t) => (t.assignee_id ? (memberById.get(t.assignee_id)?.name ?? null) : null),
      categoryName: (t) => (t.category_id ? (categoryById.get(t.category_id)?.name ?? null) : null),
      commentCount: (t) => commentCounts.get(t.id) ?? 0,
    });
  }, [tasks, sort, memberById, categoryById, commentCounts]);

  // 500건을 한꺼번에 그리지 않고 앞부분을 먼저 보여 준 뒤 나머지를 이어서 채운다
  const rows = useProgressiveRows(sorted);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }

  if (loading) {
    return (
      <div
        className="h-header animate-pulse rounded-md bg-surface motion-reduce:animate-none"
        aria-busy="true"
      />
    );
  }
  if (isFiltered && sorted.length === 0) return <EmptyResult />;
  if (sorted.length === 0 && total === 0) {
    return (
      <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
        등록된 할일이 없습니다. + 새 할일로 추가하세요.
      </p>
    );
  }

  const rowProps = (task: Task): RowProps => ({
    task,
    assignee: task.assignee_id ? memberById.get(task.assignee_id) : undefined,
    categoryName: task.category_id ? (categoryById.get(task.category_id)?.name ?? null) : null,
    commentCount: commentCounts.get(task.id) ?? 0,
    today,
    flashing: flashing[task.id] === true,
    onOpen,
  });

  // 표와 카드를 둘 다 그리지 않고, 지금 화면 크기에 맞는 쪽만 그린다
  if (!isWide) {
    return (
      <ul className="flex flex-col gap-3">
        {rows.map((task) => (
          <CardRow key={task.id} {...rowProps(task)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-md border border-border bg-surface shadow-card">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">할일 목록. 열 머리글을 눌러 정렬합니다.</caption>
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="p-0 font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex min-h-touch w-full items-center gap-1 px-3 text-left"
                  >
                    {col.label}
                    <span aria-hidden="true" className="text-text-muted">
                      {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <TableRow key={task.id} {...rowProps(task)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
