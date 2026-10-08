import { create } from 'zustand';
import {
  ApiError,
  ConflictError,
  UNIQUE_VIOLATION,
  createCategory,
  createHoliday,
  createMember,
  createTask,
  ensureMember,
  getTask,
  listCategories,
  listComments,
  listHolidays,
  listLeaves,
  listMembers,
  listTasks,
  pickAvatarColor,
  restoreTask,
  softDeleteTask,
  updateCategory,
  updateMember,
  updateTask,
} from '../lib/api';
import { clearPending, isPending, markPending } from '../lib/pending';
import { compareTimestamps } from '../lib/timestamps';
import { newId } from '../lib/uuid';
import { validateName } from '../lib/userName';
import { statusPatch } from '../lib/taskRules';
import type {
  AvatarColorKey,
  Category,
  CategoryColorKey,
  Holiday,
  Member,
  Task,
  TaskStatus,
} from '../types';
import { useCommentStore } from './commentStore';
import { useLeaveStore } from './leaveStore';
import { toast } from './toastStore';
import { useUserStore } from './userStore';

/** 폼에서 넘어오는 편집 가능 필드 */
export type TaskFields = Pick<
  Task,
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'assignee_id'
  | 'category_id'
  | 'due_date'
  | 'completed_at'
>;

/** 상세 폼 저장 결과(§5.8). conflict 의 server 가 null 이면 그 사이 삭제된 것이다. */
export type SaveResult =
  { status: 'ok'; task: Task } | { status: 'conflict'; server: Task | null } | { status: 'error' };

/** 다른 팀원이 바꾼 카드를 강조하는 시간(PRD §5.7) */
const FLASH_MS = 1500;

interface TaskState {
  tasks: Task[];
  members: Member[];
  categories: Category[];
  holidays: Holiday[];
  loading: boolean;
  loadError: string | null;
  /** 방금 다른 팀원이 바꿔서 잠깐 강조 중인 할일 id */
  flashing: Record<string, true>;

  loadAll: () => Promise<void>;
  /** 화면을 깜빡이지 않고 전체를 다시 불러온다(재연결·탭 복귀·폴링). 성공하면 true */
  refresh: () => Promise<boolean>;
  flash: (id: string) => void;
  // 실시간으로 받은 다른 팀원의 변경을 병합한다(PRD §5.7)
  applyRemoteTask: (row: Task) => void;
  removeRemoteTask: (id: string) => void;
  applyRemoteMember: (row: Member) => void;
  applyRemoteCategory: (row: Category) => void;
  /** 이름 입력 등으로 새로 생긴 팀원을 목록에 합친다. */
  mergeMembers: (members: Member[]) => void;
  /** 이름으로 활성 팀원을 찾고, 없으면 새로 등록해 id 를 돌려준다(F-T-06). */
  resolveAssignee: (name: string) => Promise<string>;
  // 설정 화면: 팀원·카테고리·공휴일. 성공하면 null, 실패하면 화면에 보여 줄 오류 메시지를 돌려준다.
  // 팀원·카테고리는 삭제하지 않고 비활성/숨김으로만 다룬다.
  addMember: (name: string) => Promise<string | null>;
  renameMember: (id: string, name: string) => Promise<string | null>;
  setMemberActive: (id: string, active: boolean) => Promise<string | null>;
  setMemberColor: (id: string, color: AvatarColorKey) => Promise<string | null>;
  addCategory: (name: string, color: CategoryColorKey) => Promise<string | null>;
  editCategory: (
    id: string,
    patch: Partial<Pick<Category, 'name' | 'color' | 'active'>>,
  ) => Promise<string | null>;
  moveCategory: (id: string, direction: -1 | 1) => Promise<string | null>;
  addHoliday: (date: string, name: string) => Promise<string | null>;
  createTask: (fields: TaskFields) => Promise<Task | null>;
  updateTask: (id: string, fields: Partial<TaskFields>) => Promise<boolean>;
  /**
   * 상세 폼 저장(§5.8). expectedUpdatedAt 을 주면 그 값과 같을 때만 저장하고(아니면 conflict),
   * 주지 않으면 조건 없이 덮어쓴다(last-write-wins).
   */
  saveTask: (
    id: string,
    fields: Partial<TaskFields>,
    expectedUpdatedAt?: string,
  ) => Promise<SaveResult>;
  changeStatus: (id: string, status: TaskStatus) => Promise<boolean>;
  softDeleteTask: (id: string) => Promise<void>;
}

const DELETE_UNDO_MS = 5000;
const CATEGORY_NAME_MAX = 20;
const HOLIDAY_NAME_MAX = 30;

/** 저장 실패를 사용자에게 보여 줄 문장으로 바꾼다. */
function saveFailure(error: unknown, duplicateMessage: string): string {
  if (error instanceof ApiError && error.code === UNIQUE_VIOLATION) return duplicateMessage;
  return '저장하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.';
}

function checkName(raw: string, max: number): { name: string } | { error: string } {
  const name = raw.trim();
  if (name.length < 1) return { error: '이름을 입력하세요.' };
  if (name.length > max) return { error: `이름은 ${max}자 이하로 입력하세요.` };
  return { name };
}

function currentUserName(): string | null {
  const name = useUserStore.getState().name;
  if (!name) toast.error('먼저 이름을 입력하세요.');
  return name;
}

export const useTaskStore = create<TaskState>((set, get) => {
  const replaceTask = (id: string, next: Task) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? next : t)) }));

  return {
    tasks: [],
    members: [],
    categories: [],
    holidays: [],
    loading: true,
    loadError: null,
    flashing: {},

    loadAll: async () => {
      set({ loading: true, loadError: null });
      try {
        const [tasks, members, categories, comments, holidays, leaves] = await Promise.all([
          listTasks(),
          listMembers(),
          listCategories(),
          listComments(),
          listHolidays(),
          listLeaves(),
        ]);
        useCommentStore.getState().setComments(comments);
        useLeaveStore.getState().setLeaves(leaves);
        set({ tasks, members, categories, holidays, loading: false });
      } catch {
        set({ loading: false, loadError: '데이터를 불러오지 못했습니다.' });
      }
    },

    refresh: async () => {
      try {
        const [tasks, members, categories, comments, holidays, leaves] = await Promise.all([
          listTasks(),
          listMembers(),
          listCategories(),
          listComments(),
          listHolidays(),
          listLeaves(),
        ]);
        const me = useUserStore.getState().name;
        const previous = new Map(get().tasks.map((t) => [t.id, t]));
        const serverIds = new Set(tasks.map((t) => t.id));

        // 다른 팀원이 바꾼(또는 새로 만든) 카드를 강조한다
        for (const t of tasks) {
          const before = previous.get(t.id);
          const changed = !before || compareTimestamps(before.updated_at, t.updated_at) < 0;
          if (changed && t.updated_by !== me) get().flash(t.id);
        }

        // 아직 저장 중인 내 항목은 서버 목록에 없어도 지우지 않는다
        const inFlight = get().tasks.filter((t) => isPending(t.id) && !serverIds.has(t.id));
        useCommentStore.getState().mergeSnapshot(comments);
        useLeaveStore.getState().mergeSnapshot(leaves);
        set({ tasks: [...inFlight, ...tasks], members, categories, holidays, loadError: null });
        return true;
      } catch {
        return false;
      }
    },

    flash: (id) => {
      set((s) => ({ flashing: { ...s.flashing, [id]: true } }));
      setTimeout(() => {
        set((s) => {
          const rest = { ...s.flashing };
          delete rest[id];
          return { flashing: rest };
        });
      }, FLASH_MS);
    },

    applyRemoteTask: (row) => {
      if (row.deleted_at) {
        get().removeRemoteTask(row.id);
        return;
      }
      const local = get().tasks.find((t) => t.id === row.id);
      // 이미 반영된 값(내 변경이 실시간으로 되돌아온 것 포함)이면 건너뛴다: 중복 반영·깜빡임 방지
      if (local && compareTimestamps(local.updated_at, row.updated_at) >= 0) return;

      set((s) => ({
        tasks: local ? s.tasks.map((t) => (t.id === row.id ? row : t)) : [row, ...s.tasks],
      }));
      if (row.updated_by !== useUserStore.getState().name && !isPending(row.id))
        get().flash(row.id);
    },

    removeRemoteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

    applyRemoteMember: (row) =>
      set((s) => ({
        members: s.members.some((m) => m.id === row.id)
          ? s.members.map((m) => (m.id === row.id ? row : m))
          : [...s.members, row],
      })),

    applyRemoteCategory: (row) =>
      set((s) => ({
        categories: s.categories.some((c) => c.id === row.id)
          ? s.categories.map((c) => (c.id === row.id ? row : c))
          : [...s.categories, row],
      })),

    mergeMembers: (incoming) =>
      set((s) => {
        const known = new Set(s.members.map((m) => m.id));
        const added = incoming.filter((m) => !known.has(m.id));
        return added.length > 0 ? { members: [...s.members, ...added] } : s;
      }),

    resolveAssignee: async (name) => {
      const member = await ensureMember(name, get().members);
      set((s) =>
        s.members.some((m) => m.id === member.id) ? s : { members: [...s.members, member] },
      );
      return member.id;
    },

    addMember: async (raw) => {
      const checked = validateName(raw);
      if (!checked.ok) return checked.error;
      try {
        const member = await createMember({
          name: checked.name,
          color: pickAvatarColor(get().members.length),
        });
        set((s) => ({ members: [...s.members, member] }));
        return null;
      } catch (error) {
        return saveFailure(
          error,
          '이미 같은 이름의 활성 팀원이 있습니다. "김하늘(기획)"처럼 소속을 붙여 보세요.',
        );
      }
    },

    renameMember: async (id, raw) => {
      const checked = validateName(raw);
      if (!checked.ok) return checked.error;
      try {
        const saved = await updateMember(id, { name: checked.name });
        set((s) => ({ members: s.members.map((m) => (m.id === id ? saved : m)) }));
        return null;
      } catch (error) {
        return saveFailure(error, '이미 같은 이름의 활성 팀원이 있습니다.');
      }
    },

    setMemberActive: async (id, active) => {
      try {
        const saved = await updateMember(id, { active });
        set((s) => ({ members: s.members.map((m) => (m.id === id ? saved : m)) }));
        return null;
      } catch (error) {
        return saveFailure(
          error,
          '같은 이름의 활성 팀원이 있어 다시 활성화할 수 없습니다. 이름을 먼저 바꿔 주세요.',
        );
      }
    },

    setMemberColor: async (id, color) => {
      try {
        const saved = await updateMember(id, { color });
        set((s) => ({ members: s.members.map((m) => (m.id === id ? saved : m)) }));
        return null;
      } catch (error) {
        return saveFailure(error, '저장하지 못했습니다.');
      }
    },

    addCategory: async (raw, color) => {
      const checked = checkName(raw, CATEGORY_NAME_MAX);
      if ('error' in checked) return checked.error;
      try {
        const nextOrder = Math.max(0, ...get().categories.map((c) => c.sort_order)) + 1;
        const category = await createCategory({ name: checked.name, color, sort_order: nextOrder });
        set((s) => ({ categories: [...s.categories, category] }));
        return null;
      } catch (error) {
        return saveFailure(error, '이미 있는 카테고리 이름입니다(숨긴 카테고리 포함).');
      }
    },

    editCategory: async (id, patch) => {
      let next = patch;
      if (patch.name !== undefined) {
        const checked = checkName(patch.name, CATEGORY_NAME_MAX);
        if ('error' in checked) return checked.error;
        next = { ...patch, name: checked.name };
      }
      try {
        const saved = await updateCategory(id, next);
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? saved : c)) }));
        return null;
      } catch (error) {
        return saveFailure(error, '이미 있는 카테고리 이름입니다(숨긴 카테고리 포함).');
      }
    },

    moveCategory: async (id, direction) => {
      const sorted = [...get().categories].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'),
      );
      const from = sorted.findIndex((c) => c.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= sorted.length) return null;

      const moved = sorted.splice(from, 1)[0] as Category;
      sorted.splice(to, 0, moved);
      // 순서를 1부터 다시 매겨, 값이 겹쳐 있던 경우에도 항상 서로 다른 순서가 되게 한다.
      const changed = sorted
        .map((c, index) => ({ c, order: index + 1 }))
        .filter(({ c, order }) => c.sort_order !== order);
      try {
        const saved = await Promise.all(
          changed.map(({ c, order }) => updateCategory(c.id, { sort_order: order })),
        );
        const byId = new Map(saved.map((c) => [c.id, c]));
        set((s) => ({ categories: s.categories.map((c) => byId.get(c.id) ?? c) }));
        return null;
      } catch (error) {
        return saveFailure(error, '저장하지 못했습니다.');
      }
    },

    addHoliday: async (date, raw) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '날짜를 선택하세요.';
      const checked = checkName(raw, HOLIDAY_NAME_MAX);
      if ('error' in checked) return checked.error;
      try {
        const holiday = await createHoliday({ date, name: checked.name });
        set((s) => ({
          holidays: [...s.holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)),
        }));
        return null;
      } catch (error) {
        return saveFailure(error, '이미 공휴일로 등록된 날짜입니다.');
      }
    },

    createTask: async (fields) => {
      const user = currentUserName();
      if (!user) return null;

      // 낙관적 업데이트: 카드를 먼저 보여 주고, 저장되면 서버 값으로 교체한다.
      // id 를 미리 정해 두므로 실시간으로 되돌아온 내 INSERT 도 같은 카드로 합쳐진다.
      const id = newId();
      const now = new Date().toISOString();
      const optimistic: Task = {
        ...fields,
        id,
        created_by: user,
        updated_by: user,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      markPending(id);
      set((s) => ({ tasks: [optimistic, ...s.tasks.filter((t) => t.id !== id)] }));

      try {
        const saved = await createTask({ ...fields, id, created_by: user, updated_by: user });
        clearPending(id);
        replaceTask(id, saved);
        return saved;
      } catch {
        clearPending(id);
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        toast.error('할일을 저장하지 못했습니다. 다시 시도하세요.');
        return null;
      }
    },

    updateTask: async (id, fields) => {
      const user = currentUserName();
      if (!user) return false;
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return false;

      replaceTask(id, { ...prev, ...fields, updated_by: user });
      try {
        const saved = await updateTask(id, { ...fields, updated_by: user });
        replaceTask(id, saved);
        return true;
      } catch {
        replaceTask(id, prev);
        toast.error('저장하지 못해 이전 상태로 되돌렸습니다.');
        return false;
      }
    },

    saveTask: async (id, fields, expectedUpdatedAt) => {
      const user = currentUserName();
      if (!user) return { status: 'error' };
      try {
        const saved = await updateTask(id, { ...fields, updated_by: user }, { expectedUpdatedAt });
        replaceTask(id, saved);
        return { status: 'ok', task: saved };
      } catch (error) {
        if (error instanceof ConflictError) {
          // 서버의 최신 값을 읽어 온다. 그 사이 삭제됐다면 null.
          const server = await getTask(id).catch(() => null);
          return { status: 'conflict', server };
        }
        toast.error('저장하지 못했습니다. 다시 시도하세요.');
        return { status: 'error' };
      }
    },

    changeStatus: (id, status) => {
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev || prev.status === status) return Promise.resolve(true);
      return get().updateTask(id, statusPatch(status));
    },

    softDeleteTask: async (id) => {
      const user = currentUserName();
      if (!user) return;
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return;

      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      try {
        await softDeleteTask(id, user);
      } catch {
        set((s) => ({ tasks: [prev, ...s.tasks] }));
        toast.error('삭제하지 못했습니다.');
        return;
      }

      toast.info(`"${prev.title}" 을(를) 삭제했습니다.`, {
        duration: DELETE_UNDO_MS,
        action: {
          label: '실행 취소',
          onClick: () => {
            void (async () => {
              try {
                await restoreTask(id, user);
                // 복구된 행의 updated_at 등을 서버 값으로 맞추기 위해 다시 불러온다.
                set({ tasks: await listTasks() });
              } catch {
                toast.error('실행 취소하지 못했습니다.');
              }
            })();
          },
        },
      });
    },
  };
});
