import { create } from 'zustand';
import { createLeave, softDeleteLeave, updateLeave } from '../lib/api';
import { clearPending, isPending, markPending } from '../lib/pending';
import { newId } from '../lib/uuid';
import type { Leave, LeaveInsert, LeaveUpdate } from '../types';
import { toast } from './toastStore';
import { useUserStore } from './userStore';

export type LeaveFields = Pick<
  LeaveInsert,
  'member_id' | 'kind' | 'start_date' | 'end_date' | 'note'
>;

interface LeaveState {
  leaves: Leave[];
  setLeaves: (leaves: Leave[]) => void;
  /** 전체 다시 불러오기 결과를 합친다. 저장 중인 내 휴가는 지우지 않는다. */
  mergeSnapshot: (incoming: Leave[]) => void;
  /** 실시간으로 받은 변경(등록·수정·삭제 표시) */
  applyRemoteLeave: (row: Leave) => void;
  removeRemoteLeave: (id: string) => void;
  addLeave: (fields: LeaveFields) => Promise<boolean>;
  editLeave: (id: string, patch: LeaveUpdate) => Promise<boolean>;
  deleteLeave: (id: string) => Promise<boolean>;
}

export const useLeaveStore = create<LeaveState>((set, get) => ({
  leaves: [],

  setLeaves: (leaves) => set({ leaves }),

  mergeSnapshot: (incoming) =>
    set((s) => {
      const serverIds = new Set(incoming.map((l) => l.id));
      const inFlight = s.leaves.filter((l) => isPending(l.id) && !serverIds.has(l.id));
      return { leaves: [...incoming, ...inFlight] };
    }),

  applyRemoteLeave: (row) => {
    if (row.deleted_at) {
      get().removeRemoteLeave(row.id);
      return;
    }
    set((s) => {
      if (s.leaves.some((l) => l.id === row.id)) {
        // 내가 저장 중인 항목은 응답으로 바뀐다. 그 외에는 서버 값으로 맞춘다.
        return { leaves: s.leaves.map((l) => (l.id === row.id && !isPending(l.id) ? row : l)) };
      }
      return { leaves: [...s.leaves, row] };
    });
  },

  removeRemoteLeave: (id) => set((s) => ({ leaves: s.leaves.filter((l) => l.id !== id) })),

  addLeave: async (fields) => {
    const user = useUserStore.getState().name;
    if (!user) {
      toast.error('먼저 이름을 입력하세요.');
      return false;
    }

    // id 를 미리 정해 두므로 실시간으로 되돌아온 내 INSERT 도 같은 항목으로 합쳐진다.
    const id = newId();
    const optimistic: Leave = {
      id,
      ...fields,
      note: fields.note ?? null,
      created_by: user,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    markPending(id);
    set((s) => ({ leaves: [...s.leaves.filter((l) => l.id !== id), optimistic] }));

    try {
      const saved = await createLeave({ ...fields, id, created_by: user });
      clearPending(id);
      set((s) => ({ leaves: s.leaves.map((l) => (l.id === id ? saved : l)) }));
      return true;
    } catch {
      clearPending(id);
      set((s) => ({ leaves: s.leaves.filter((l) => l.id !== id) }));
      toast.error('휴가를 저장하지 못했습니다. 다시 시도하세요.');
      return false;
    }
  },

  editLeave: async (id, patch) => {
    const prev = get().leaves.find((l) => l.id === id);
    if (!prev) return false;

    set((s) => ({ leaves: s.leaves.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    try {
      const saved = await updateLeave(id, patch);
      set((s) => ({ leaves: s.leaves.map((l) => (l.id === id ? saved : l)) }));
      return true;
    } catch {
      set((s) => ({ leaves: s.leaves.map((l) => (l.id === id ? prev : l)) }));
      toast.error('저장하지 못해 이전 상태로 되돌렸습니다.');
      return false;
    }
  },

  deleteLeave: async (id) => {
    const prev = get().leaves.find((l) => l.id === id);
    if (!prev) return false;

    set((s) => ({ leaves: s.leaves.filter((l) => l.id !== id) }));
    try {
      await softDeleteLeave(id);
      return true;
    } catch {
      set((s) => ({ leaves: [...s.leaves, prev] }));
      toast.error('휴가를 삭제하지 못했습니다.');
      return false;
    }
  },
}));
