import { create } from 'zustand';
import { VIEWS } from '../components/views';
import type { ViewId } from '../components/views';
import { parseUrlState } from '../lib/urlState';

const STORAGE_KEY = 'team-calendar:last-view';

const isView = (value: string | null): value is ViewId => VIEWS.some((v) => v.id === value);

// localStorage 는 차단될 수 있으므로 항상 try/catch 로 감싼다.
function readStoredView(): ViewId | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isView(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredView(view: ViewId): void {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // 저장하지 못해도 이번 세션에는 영향이 없다.
  }
}

/** URL 의 view 가 우선, 없으면 마지막으로 본 뷰(F-V-05), 그것도 없으면 칸반 */
const initialView: ViewId =
  (typeof window === 'undefined' ? null : parseUrlState(window.location.search).view) ??
  (typeof window === 'undefined' ? null : readStoredView()) ??
  'kanban';

interface ViewStore {
  view: ViewId;
  /** 설정 화면이 열려 있는지(헤더의 설정 아이콘). URL·localStorage 에는 저장하지 않는다. */
  settingsOpen: boolean;
  setView: (view: ViewId) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  view: initialView,
  settingsOpen: false,
  // 뷰를 바꾸면(탭, 대시보드 카드 이동 등) 설정 화면은 닫힌다.
  setView: (view) => {
    writeStoredView(view);
    set({ view, settingsOpen: false });
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
