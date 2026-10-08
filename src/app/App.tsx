import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Toaster } from '../components/Toaster';
import { ViewTabs } from '../components/ViewTabs';
import { ActiveFilterChips } from '../features/filters/ActiveFilterChips';
import { FilterPanel } from '../features/filters/FilterPanel';
import { FilterToolbar } from '../features/filters/FilterToolbar';
import { KanbanBoard } from '../features/tasks/KanbanBoard';
import { ListView } from '../features/tasks/ListView';
import { TaskDetailModal } from '../features/tasks/TaskDetailModal';
import { TaskFormModal } from '../features/tasks/TaskFormModal';
import { NameModal } from '../features/user/NameModal';
import { isSupabaseConfigured } from '../lib/api';
import { useFilterStore } from '../stores/filterStore';
import { useTaskStore } from '../stores/taskStore';
import { startTodayTimer } from '../stores/todayStore';
import { useUserStore } from '../stores/userStore';
import { useViewStore } from '../stores/viewStore';
import { useRealtime } from './useRealtime';
import { useUrlSync } from './useUrlSync';

// 무거운 화면은 처음 열 때 불러온다(PRD §5.2: 초기 JS gzip 200KB 이하, 차트·캘린더 지연 로딩)
const DashboardView = lazy(() =>
  import('../features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const CalendarView = lazy(() =>
  import('../features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function ViewFallback() {
  return (
    <div
      className="h-header animate-pulse rounded-md bg-surface motion-reduce:animate-none"
      aria-busy="true"
      aria-label="불러오는 중"
    />
  );
}

function MissingConfig() {
  return (
    <main className="mx-auto max-w-modal p-6">
      <h1 className="text-xl font-bold">Supabase 설정이 필요합니다</h1>
      <p className="mt-3 text-sm text-text-muted">
        프로젝트 루트에 .env 파일을 만들고 .env.example 을 참고해 VITE_SUPABASE_URL 과
        VITE_SUPABASE_ANON_KEY 를 채운 뒤 개발 서버를 다시 시작하세요.
      </p>
    </main>
  );
}

export function App() {
  const name = useUserStore((s) => s.name);
  const userMembers = useUserStore((s) => s.members);
  const openNameModal = useUserStore((s) => s.openModal);
  const loadMembers = useUserStore((s) => s.loadMembers);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const settingsOpen = useViewStore((s) => s.settingsOpen);
  const openSettings = useViewStore((s) => s.openSettings);
  const closeSettings = useViewStore((s) => s.closeSettings);
  /** 등록 폼 상태. dueDate 는 캘린더에서 날짜를 눌러 열 때 채워진다. */
  const [form, setForm] = useState<{ open: boolean; dueDate?: string }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void loadMembers();
    void useTaskStore.getState().loadAll();
  }, [loadMembers]);

  // 이름 입력으로 새 팀원이 생기면 담당자 목록에도 반영한다.
  useEffect(() => {
    useTaskStore.getState().mergeMembers(userMembers);
  }, [userMembers]);

  // 검색·필터·뷰 ↔ URL 쿼리 동기화
  useUrlSync();

  // 다른 팀원의 변경 실시간 반영(PRD §5.7)
  useRealtime();

  // 자정이 지나면 "오늘"이 갱신되어 마감 배지가 다시 계산된다.
  useEffect(() => startTodayTimer(), []);

  const closeDetail = useCallback(() => setDetailId(null), []);
  const closeForm = useCallback(() => setForm({ open: false }), []);

  if (!isSupabaseConfigured) return <MissingConfig />;

  return (
    <>
      <Header
        userName={name}
        onChangeName={openNameModal}
        onNewTask={() => setForm({ open: true })}
        onOpenSettings={openSettings}
        onHome={() => {
          useFilterStore.getState().clear();
          setView('kanban');
          window.scrollTo({ top: 0 });
        }}
      />
      {settingsOpen ? (
        <Suspense fallback={<ViewFallback />}>
          <SettingsPage onClose={closeSettings} />
        </Suspense>
      ) : (
        <div className="mx-auto flex max-w-content gap-5 p-4 pb-8 md:pb-4">
          {/* 데스크탑(lg 이상): 좌측 필터 사이드바. 그 아래 크기는 FilterToolbar 가 맡는다. */}
          <aside
            aria-labelledby="sidebar-filter-heading"
            className="hidden w-sidebar shrink-0 self-start rounded-md border border-border bg-surface p-4 shadow-card lg:sticky lg:top-4 lg:block"
          >
            <h2 id="sidebar-filter-heading" className="mb-3 text-lg font-semibold">
              필터
            </h2>
            <FilterPanel />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <ViewTabs active={view} onChange={setView} />
            <FilterToolbar />
            <ActiveFilterChips />
            <section id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>
              {view === 'kanban' && <KanbanBoard onOpen={setDetailId} />}
              {view === 'list' && <ListView onOpen={setDetailId} />}
              <Suspense fallback={<ViewFallback />}>
                {view === 'calendar' && (
                  <CalendarView
                    onOpen={setDetailId}
                    onCreate={(dueDate) => setForm({ open: true, dueDate })}
                  />
                )}
                {view === 'dashboard' && <DashboardView onOpen={setDetailId} />}
              </Suspense>
            </section>
          </main>
        </div>
      )}

      <TaskFormModal open={form.open} defaultDueDate={form.dueDate} onClose={closeForm} />
      <TaskDetailModal taskId={detailId} onClose={closeDetail} />
      <NameModal />
      <Toaster />
    </>
  );
}
