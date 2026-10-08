import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { DueBadge } from '../../components/Badges';
import { Button } from '../../components/Button';
import {
  buildMonthGrid,
  groupByDueDate,
  isSameMonth,
  monthStart,
  shiftDays,
  shiftMonth,
  weekdayOf,
} from '../../lib/calendar';
import { getDueLabel } from '../../lib/dueStatus';
import { formatDateLong, formatDayTitle, formatMonthTitle } from '../../lib/format';
import { PRIORITY_DOT_CLASS, PRIORITY_LABEL } from '../../lib/labels';
import { groupLabel, isTripKind, leavesOnDate } from '../../lib/leaves';
import { useIsWideScreen } from '../../lib/useMediaQuery';
import { useLeaveStore } from '../../stores/leaveStore';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import type { Leave, Task } from '../../types';
import { EmptyResult } from '../filters/EmptyResult';
import { useFilteredTasks } from '../filters/useFilteredTasks';
import { LeaveChip } from '../leaves/LeaveChip';
import { LeaveFormModal } from '../leaves/LeaveFormModal';
import { LeavesDialog } from '../leaves/LeavesDialog';
import { DayTasksDialog } from './DayTasksDialog';

const MAX_VISIBLE = 3;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** 방향키 이동량(일). PageUp/PageDown 은 달 단위로 처리한다. */
const ARROW_DELTA: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

function taskLabel(task: Task, today: string): string {
  const due = getDueLabel(task, today);
  // 화면에 보이는 글자(제목 + 마감 배지) 순서를 이름의 앞부분에 그대로 둔다(WCAG 2.5.3)
  return `${task.title}${due ? ` ${due}` : ''}, 우선순위 ${PRIORITY_LABEL[task.priority]}${task.status === 'done' ? ', 완료' : ''}`;
}

interface TaskLineProps {
  task: Task;
  today: string;
  tabbable: boolean;
  onOpen: (id: string) => void;
}

/** 우선순위 색 점 + 제목 + 긴급 배지(D-3 이내·지연) */
function TaskLine({ task, today, tabbable, onOpen }: TaskLineProps) {
  return (
    <button
      type="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={taskLabel(task, today)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(task.id);
      }}
      className="flex min-h-5 w-full min-w-0 flex-wrap items-center gap-x-1 rounded-sm px-1 text-left text-xs hover:bg-bg"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-pill ${PRIORITY_DOT_CLASS[task.priority]}`}
      />
      <span
        className={`min-w-0 flex-1 basis-1/2 truncate ${task.status === 'done' ? 'text-text-muted line-through' : ''}`}
      >
        {task.title}
      </span>
      {/* 제목과 배지 글자 사이의 공백(화면에는 보이지 않지만 이름 계산에는 포함된다) */}{' '}
      <DueBadge task={task} today={today} compact />
    </button>
  );
}

interface CalendarViewProps {
  onOpen: (id: string) => void;
  /** 날짜가 마감일로 채워진 등록 폼을 연다 */
  onCreate: (dueDate: string) => void;
}

export function CalendarView({ onOpen, onCreate }: CalendarViewProps) {
  const { tasks, isFiltered } = useFilteredTasks();
  const holidays = useTaskStore((s) => s.holidays);
  const members = useTaskStore((s) => s.members);
  const leaves = useLeaveStore((s) => s.leaves);
  const today = useTodayStore((s) => s.today);
  const isWide = useIsWideScreen();

  const [month, setMonth] = useState(() => monthStart(today));
  const [focused, setFocused] = useState(today);
  /** 모바일에서 날짜를 눌러 아래에 목록을 보여 줄 날짜 */
  const [selected, setSelected] = useState<string | null>(null);
  /** 목록 팝오버: date 가 null 이면 "마감일 없음" 목록 */
  const [popup, setPopup] = useState<{ date: string | null } | null>(null);

  /** 휴가 등록·수정 모달. leave 가 있으면 수정, date 는 등록할 때의 시작일 초깃값 */
  const [leaveForm, setLeaveForm] = useState<{
    open: boolean;
    leave?: Leave;
    date?: string;
    mode?: 'leave' | 'trip';
  }>({
    open: false,
  });
  /** "휴가 +N명" 더보기 팝오버 */
  const [leavesPopupDate, setLeavesPopupDate] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const focusAfterRender = useRef(false);

  const weeks = useMemo(() => buildMonthGrid(month), [month]);
  const holidayByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const { byDate, noDue } = useMemo(() => groupByDueDate(tasks), [tasks]);
  const holidayDates = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const memberNameById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const memberName = (id: string) => memberNameById.get(id) ?? '알 수 없음';
  const openLeave = (leave: Leave) => setLeaveForm({ open: true, leave });

  // 방향키로 옮긴 뒤 새 셀로 실제 포커스를 보낸다
  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, month]);

  function goToMonth(next: string) {
    setMonth(next);
    setFocused(isSameMonth(today, next) ? today : next);
  }

  function moveFocus(next: string) {
    if (!isSameMonth(next, month)) setMonth(monthStart(next));
    setFocused(next);
    focusAfterRender.current = true;
  }

  function activate(date: string) {
    setFocused(date);
    if (isWide) onCreate(date);
    else setSelected(date);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // 셀 자체에 포커스가 있을 때만(안의 할일 버튼 제외) 처리한다
    const date = (event.target as HTMLElement).dataset.date;
    if (!date) return;

    const delta = ARROW_DELTA[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveFocus(shiftDays(date, delta));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      moveFocus(shiftMonth(date, event.key === 'PageUp' ? -1 : 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(date);
    }
  }

  const popupTasks = popup ? (popup.date ? (byDate.get(popup.date) ?? []) : noDue) : [];
  const popupTitle = popup
    ? popup.date
      ? `${formatDayTitle(popup.date)} 할일 ${popupTasks.length}건`
      : `마감일 없음 ${popupTasks.length}건`
    : '';
  const selectedTasks = selected ? (byDate.get(selected) ?? []) : [];
  const selectedLeaves = selected ? leavesOnDate(leaves, selected, holidayDates) : [];
  const popupLeaves = leavesPopupDate ? leavesOnDate(leaves, leavesPopupDate, holidayDates) : [];

  return (
    <div className="flex flex-col gap-4">
      {isFiltered && tasks.length === 0 && <EmptyResult />}

      <div className="flex flex-wrap items-center gap-2">
        <Button aria-label="이전 달" onClick={() => goToMonth(shiftMonth(month, -1))}>
          <span aria-hidden="true">‹</span>
        </Button>
        <h2 aria-live="polite" className="text-xl font-bold">
          {formatMonthTitle(month)}
        </h2>
        <Button aria-label="다음 달" onClick={() => goToMonth(shiftMonth(month, 1))}>
          <span aria-hidden="true">›</span>
        </Button>
        <Button onClick={() => goToMonth(monthStart(today))}>오늘</Button>
        <Button
          className="ml-auto"
          onClick={() => setLeaveForm({ open: true, date: selected ?? today, mode: 'leave' })}
        >
          + 휴가 등록
        </Button>
        <Button onClick={() => setLeaveForm({ open: true, date: selected ?? today, mode: 'trip' })}>
          + 출장 등록
        </Button>
        <Button disabled={noDue.length === 0} onClick={() => setPopup({ date: null })}>
          마감일 없음 {noDue.length}건
        </Button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${formatMonthTitle(month)} 캘린더`}
        onKeyDown={handleKeyDown}
        className="overflow-hidden rounded-md border-l border-t border-border bg-surface shadow-card"
      >
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((name, i) => (
            <div
              key={name}
              role="columnheader"
              className={`border-b border-r border-border py-1 text-center text-xs font-semibold ${
                i === 6 ? 'text-holiday' : i === 5 ? 'text-saturday' : 'text-text-muted'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7">
            {week.map((date) => {
              const dayTasks = byDate.get(date) ?? [];
              const dayLeaves = leavesOnDate(leaves, date, holidayDates);
              const holiday = holidayByDate.get(date);
              const weekday = weekdayOf(date);
              const isToday = date === today;
              const isFocusCell = date === focused;
              const redDay = weekday === 0 || Boolean(holiday);
              const inMonth = isSameMonth(date, month);
              // 이웃 달 날짜는 투명도 대신 보조 텍스트색 + 연한 배경으로 구분한다(명도 대비 유지)
              const dayColor = redDay
                ? 'text-holiday'
                : weekday === 6
                  ? 'text-saturday'
                  : inMonth
                    ? 'text-text'
                    : 'text-text-muted';

              const label = [
                formatDateLong(date),
                holiday ? `공휴일 ${holiday}` : null,
                isToday ? '오늘' : null,
                `할일 ${dayTasks.length}건`,
                dayLeaves.length > 0 ? `${groupLabel(dayLeaves)} ${dayLeaves.length}명` : null,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={date}
                  role="gridcell"
                  data-date={date}
                  aria-label={label}
                  aria-selected={!isWide && selected === date ? true : undefined}
                  tabIndex={isFocusCell ? 0 : -1}
                  onClick={() => activate(date)}
                  className={`flex min-h-touch min-w-0 cursor-pointer flex-col gap-1 border-b border-r border-border p-1 md:min-h-cell ${
                    inMonth ? 'bg-surface' : 'bg-bg'
                  } ${!isWide && selected === date ? 'relative z-10 shadow-raised' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`inline-flex min-w-5 items-center justify-center rounded-pill text-xs font-semibold ${
                        isToday ? 'bg-primary-strong text-on-brand' : dayColor
                      }`}
                    >
                      {Number(date.slice(8))}
                    </span>
                    {holiday && (
                      <span className="hidden min-w-0 truncate text-xs text-holiday md:block">
                        {holiday}
                      </span>
                    )}
                  </div>

                  {/* 휴가: 태블릿 이상은 "이름 종류" 칩, 3명 초과는 "휴가 +N명" */}
                  {dayLeaves.length > 0 && (
                    <ul className="hidden flex-col gap-1 md:flex">
                      {dayLeaves.slice(0, MAX_VISIBLE).map((leave) => (
                        <li key={leave.id}>
                          <LeaveChip
                            leave={leave}
                            memberName={memberName(leave.member_id)}
                            tabbable={isFocusCell}
                            onOpen={openLeave}
                          />
                        </li>
                      ))}
                      {dayLeaves.length > MAX_VISIBLE && (
                        <li>
                          <button
                            type="button"
                            tabIndex={isFocusCell ? 0 : -1}
                            onClick={(event) => {
                              event.stopPropagation();
                              setLeavesPopupDate(date);
                            }}
                            className="w-full rounded-sm bg-leave-bg px-1 text-left text-xs font-semibold text-leave-text"
                          >
                            {groupLabel(dayLeaves.slice(MAX_VISIBLE))} +
                            {dayLeaves.length - MAX_VISIBLE}명
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                  {/* 모바일: 휴가자 수만 작게 */}
                  {dayLeaves.some((l) => !isTripKind(l.kind)) && (
                    <span
                      aria-hidden="true"
                      className="w-fit rounded-sm bg-leave-bg px-1 text-xs font-semibold text-leave-text md:hidden"
                    >
                      휴{dayLeaves.filter((l) => !isTripKind(l.kind)).length}
                    </span>
                  )}
                  {dayLeaves.some((l) => isTripKind(l.kind)) && (
                    <span
                      aria-hidden="true"
                      className="w-fit rounded-sm bg-trip-bg px-1 text-xs font-semibold text-trip-text md:hidden"
                    >
                      출{dayLeaves.filter((l) => isTripKind(l.kind)).length}
                    </span>
                  )}

                  {/* 태블릿 이상: 우선순위 점 + 제목, 3건 초과는 더보기 */}
                  <ul className="hidden flex-col gap-1 md:flex">
                    {dayTasks.slice(0, MAX_VISIBLE).map((task) => (
                      <li key={task.id}>
                        <TaskLine
                          task={task}
                          today={today}
                          tabbable={isFocusCell}
                          onOpen={onOpen}
                        />
                      </li>
                    ))}
                    {dayTasks.length > MAX_VISIBLE && (
                      <li>
                        <button
                          type="button"
                          tabIndex={isFocusCell ? 0 : -1}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPopup({ date });
                          }}
                          className="w-full rounded-sm px-1 text-left text-xs font-semibold text-primary-text"
                        >
                          +{dayTasks.length - MAX_VISIBLE}건 더보기
                        </button>
                      </li>
                    )}
                  </ul>

                  {/* 모바일: 건수 점만 */}
                  {dayTasks.length > 0 && (
                    <div aria-hidden="true" className="flex flex-wrap gap-1 md:hidden">
                      {dayTasks.slice(0, MAX_VISIBLE).map((task) => (
                        <span
                          key={task.id}
                          className={`h-2 w-2 rounded-pill ${PRIORITY_DOT_CLASS[task.priority]}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 모바일: 선택한 날짜의 목록 */}
      <section aria-live="polite" className="flex flex-col gap-2 md:hidden">
        {selected ? (
          <>
            <h3 className="text-lg font-semibold">
              {formatDayTitle(selected)} 할일 {selectedTasks.length}건
            </h3>
            {selectedTasks.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-md border border-border bg-surface p-2">
                {selectedTasks.map((task) => (
                  <li key={task.id} className="min-h-touch">
                    <button
                      type="button"
                      aria-label={taskLabel(task, today)}
                      onClick={() => onOpen(task.id)}
                      className="flex min-h-touch w-full items-center gap-2 text-left text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-pill ${PRIORITY_DOT_CLASS[task.priority]}`}
                      />
                      <span
                        className={task.status === 'done' ? 'text-text-muted line-through' : ''}
                      >
                        {task.title}
                      </span>
                      <DueBadge task={task} today={today} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedLeaves.length > 0 && (
              <>
                <h3 className="text-lg font-semibold">
                  {groupLabel(selectedLeaves)} {selectedLeaves.length}명
                </h3>
                <ul className="flex flex-col gap-1">
                  {selectedLeaves.map((leave) => (
                    <li key={leave.id}>
                      <LeaveChip
                        leave={leave}
                        memberName={memberName(leave.member_id)}
                        onOpen={openLeave}
                        showPeriod
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Button variant="primary" onClick={() => onCreate(selected)}>
              + 이 날짜에 할일 추가
            </Button>
            <Button onClick={() => setLeaveForm({ open: true, date: selected, mode: 'leave' })}>
              + 이 날짜에 휴가 등록
            </Button>
            <Button onClick={() => setLeaveForm({ open: true, date: selected, mode: 'trip' })}>
              + 이 날짜에 출장 등록
            </Button>
          </>
        ) : (
          <p className="text-sm text-text-muted">날짜를 누르면 그날의 할일이 아래에 보입니다.</p>
        )}
      </section>

      <LeaveFormModal
        open={leaveForm.open}
        leave={leaveForm.leave}
        defaultDate={leaveForm.date}
        mode={leaveForm.mode}
        onClose={() => setLeaveForm({ open: false })}
      />
      <LeavesDialog
        open={leavesPopupDate !== null}
        title={
          leavesPopupDate
            ? `${formatDayTitle(leavesPopupDate)} ${groupLabel(popupLeaves)} ${popupLeaves.length}명`
            : ''
        }
        leaves={popupLeaves}
        memberName={memberName}
        onClose={() => setLeavesPopupDate(null)}
        onOpenLeave={(leave) => {
          setLeavesPopupDate(null);
          openLeave(leave);
        }}
      />
      <DayTasksDialog
        open={popup !== null}
        title={popupTitle}
        tasks={popupTasks}
        today={today}
        onClose={() => setPopup(null)}
        onOpenTask={(id) => {
          setPopup(null);
          onOpen(id);
        }}
      />
    </div>
  );
}
