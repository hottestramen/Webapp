import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  DragEndEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useMemo, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { useIsWideScreen } from '../../lib/useMediaQuery';
import { useProgressiveRows } from '../../lib/useProgressiveRows';
import { Button } from '../../components/Button';
import { STATUS_LABEL } from '../../lib/labels';
import { sortForKanban } from '../../lib/taskRules';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { TASK_STATUSES } from '../../types';
import type { Member, Task, TaskStatus } from '../../types';
import { useCommentCounts } from '../comments/useCommentCounts';
import { EmptyResult } from '../filters/EmptyResult';
import { useFilteredTasks } from '../filters/useFilteredTasks';
import { cardClass } from './cardClass';
import { TaskCard, TaskCardContent } from './TaskCard';

const DRAG_START_DISTANCE = 6;
/** 모바일 좌우 스와이프로 상태 열을 넘기는 최소 이동 거리 */
const SWIPE_MIN_DISTANCE = 60;

/** 키보드 드래그: 방향키로 이웃 열로 이동한다. Space 로 시작·놓기, Esc 로 취소. */
const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, collisionRect } },
) => {
  const forward = event.code === 'ArrowRight' || event.code === 'ArrowDown';
  const backward = event.code === 'ArrowLeft' || event.code === 'ArrowUp';
  if (!forward && !backward) return undefined;
  event.preventDefault();
  if (!collisionRect) return undefined;

  const centerX = collisionRect.left + collisionRect.width / 2;
  const centerY = collisionRect.top + collisionRect.height / 2;
  const current = TASK_STATUSES.findIndex((status) => {
    const r = droppableRects.get(status);
    return r && centerX >= r.left && centerX <= r.right && centerY >= r.top && centerY <= r.bottom;
  });
  const from = current < 0 ? 0 : current;
  const next = Math.min(Math.max(from + (forward ? 1 : -1), 0), TASK_STATUSES.length - 1);
  const target = droppableRects.get(TASK_STATUSES[next] as TaskStatus);
  return target ? { x: target.left, y: target.top } : undefined;
};

const announcements = (titleOf: (id: string) => string): Announcements => ({
  onDragStart: ({ active }) =>
    `${titleOf(String(active.id))} 카드를 집었습니다. 방향키로 열을 옮기고 스페이스로 놓으세요.`,
  onDragOver: ({ over }) =>
    over ? `${STATUS_LABEL[over.id as TaskStatus]} 열 위에 있습니다.` : undefined,
  onDragEnd: ({ active, over }) =>
    over
      ? `${titleOf(String(active.id))} 카드를 ${STATUS_LABEL[over.id as TaskStatus]} 열로 옮겼습니다.`
      : `${titleOf(String(active.id))} 카드를 원래 자리에 놓았습니다.`,
  onDragCancel: ({ active }) => `${titleOf(String(active.id))} 이동을 취소했습니다.`,
});

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  commentCounts: Map<string, number>;
  memberById: Map<string, Member>;
  today: string;
  /** 모바일(<md)에서 지금 보여 주는 열인지. 다른 열은 숨긴다 */
  activeOnMobile: boolean;
  dragEnabled: boolean;
  onOpen: (id: string) => void;
}

function Column({
  status,
  tasks,
  commentCounts,
  memberById,
  today,
  activeOnMobile,
  dragEnabled,
  onOpen,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  // 카드가 많은 열은 앞부분을 먼저 그리고 나머지를 이어서 채운다(PRD §5.2)
  const shown = useProgressiveRows(tasks, 30, 60);
  const headingId = `column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`min-h-touch w-full flex-col gap-3 rounded-lg border p-3 transition duration-fast ease-brand md:w-auto md:min-w-kanban md:shrink-0 md:flex-1 lg:min-w-0 lg:shrink ${
        activeOnMobile ? 'flex' : 'hidden md:flex'
      } ${isOver ? 'border-primary bg-surface' : 'border-border bg-bg'}`}
    >
      <h2 id={headingId} className="flex items-center justify-between text-base font-semibold">
        {STATUS_LABEL[status]}
        <span className="rounded-pill bg-surface px-2 text-sm text-text-muted">
          <span className="sr-only">건수 </span>
          {tasks.length}
        </span>
      </h2>

      {tasks.length === 0 ? (
        <p className="py-5 text-center text-sm text-text-muted">
          {status === 'todo'
            ? '할 일이 없습니다. + 새 할일로 추가하세요.'
            : '카드를 이 열로 끌어 놓으면 상태가 바뀝니다.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                assignee={task.assignee_id ? memberById.get(task.assignee_id) : undefined}
                commentCount={commentCounts.get(task.id) ?? 0}
                today={today}
                dragEnabled={dragEnabled}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      {TASK_STATUSES.map((s) => (
        <div key={s} className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-8 animate-pulse rounded-md bg-surface motion-reduce:animate-none"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KanbanBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const tasks = useTaskStore((s) => s.tasks);
  const members = useTaskStore((s) => s.members);
  const loading = useTaskStore((s) => s.loading);
  const loadError = useTaskStore((s) => s.loadError);
  // 검색·필터가 적용된 할일(모든 뷰 공통). 드래그 안내문·오버레이는 전체 목록에서 찾는다.
  const { tasks: visibleTasks, isFiltered } = useFilteredTasks();
  const commentCounts = useCommentCounts();
  const today = useTodayStore((s) => s.today);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 모바일에서 한 번에 한 열만 보여 주는 상태 탭(PRD §5.1) */
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('todo');
  const isWide = useIsWideScreen();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnCoordinates,
      // Enter 는 상세 열기에 쓰므로 드래그 시작은 Space 로만 한다.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    for (const task of visibleTasks) grouped[task.status].push(task);
    for (const status of TASK_STATUSES) grouped[status] = sortForKanban(grouped[status], today);
    return grouped;
  }, [visibleTasks, today]);

  // 드래그 중에 카드가 사라지면(삭제 등) activeTask 가 undefined 가 되어 오버레이도 사라진다.
  const activeTask = tasks.find((t) => t.id === activeId);
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? '카드';

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  /** 좌우로 크게 쓸어 넘기면 이웃 상태 열로 이동한다(세로 스크롤과 구분) */
  function handleTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    const end = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return;
    const index = TASK_STATUSES.indexOf(mobileStatus) + (dx < 0 ? 1 : -1);
    const next = TASK_STATUSES[index];
    if (next) setMobileStatus(next);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    void useTaskStore.getState().changeStatus(String(active.id), over.id as TaskStatus);
  }

  if (loading) return <Skeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface p-6 text-center">
        <p className="text-sm text-danger">{loadError}</p>
        <Button onClick={() => void useTaskStore.getState().loadAll()}>다시 불러오기</Button>
      </div>
    );
  }

  if (isFiltered && visibleTasks.length === 0) return <EmptyResult />;

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements: announcements(titleOf),
        screenReaderInstructions: {
          draggable:
            '엔터로 상세를 엽니다. 스페이스로 카드를 집은 뒤 방향키로 열을 옮기고 스페이스로 놓습니다. 상태는 상세 화면의 드롭다운으로도 바꿀 수 있습니다.',
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* 모바일: 상태 탭 + 좌우 스와이프 */}
      <div role="tablist" aria-label="상태 열" className="mb-3 flex gap-2 md:hidden">
        {TASK_STATUSES.map((status) => {
          const selected = status === mobileStatus;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMobileStatus(status)}
              className={`min-h-touch flex-1 rounded-pill border px-2 text-sm font-semibold ${
                selected
                  ? 'border-transparent bg-brand text-on-brand'
                  : 'border-border bg-surface text-text-muted'
              }`}
            >
              {STATUS_LABEL[status]} {columns[status].length}
            </button>
          );
        })}
      </div>

      {/* 태블릿: 3열 가로 스크롤 / 데스크탑: 3열 동시 표시 */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative flex flex-col items-start gap-4 md:flex-row md:overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible"
      >
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columns[status]}
            commentCounts={commentCounts}
            memberById={memberById}
            today={today}
            activeOnMobile={status === mobileStatus}
            dragEnabled={isWide}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className={`${cardClass(activeTask)} shadow-raised`}>
            <TaskCardContent
              task={activeTask}
              assignee={members.find((m) => m.id === activeTask.assignee_id)}
              commentCount={commentCounts.get(activeTask.id) ?? 0}
              today={today}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
