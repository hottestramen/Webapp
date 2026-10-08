import { create } from 'zustand';
import { ensureMember, listMembers } from '../lib/api';
import { readStoredName, validateName, writeStoredName } from '../lib/userName';
import type { Member } from '../types';

interface UserState {
  /** 현재 사용자 이름. 저장된 이름이 없으면 null (이름 입력 모달을 띄운다) */
  name: string | null;
  /** 자동완성용 팀원 목록(비활성 포함) */
  members: Member[];
  modalOpen: boolean;
  loadMembers: () => Promise<void>;
  /** 이름을 검증·저장하고, 목록에 없으면 members 에 등록한다. 실패하면 오류 메시지를 돌려준다. */
  submitName: (raw: string) => Promise<string | null>;
  openModal: () => void;
  closeModal: () => void;
}

const storedName = readStoredName();

export const useUserStore = create<UserState>((set, get) => ({
  name: storedName,
  members: [],
  modalOpen: storedName === null,

  loadMembers: async () => {
    try {
      set({ members: await listMembers() });
    } catch {
      // 목록을 못 불러와도 이름 입력은 계속 가능하다. 자동완성만 비어 있다.
    }
  },

  submitName: async (raw) => {
    const result = validateName(raw);
    if (!result.ok) return result.error;

    try {
      // 목록이 오래됐을 수 있으니 등록 직전에 한 번 더 확인한다.
      const members = await listMembers();
      const member = await ensureMember(result.name, members);
      const next = members.some((m) => m.id === member.id) ? members : [...members, member];
      writeStoredName(result.name);
      set({ name: result.name, members: next, modalOpen: false });
      return null;
    } catch {
      return '이름을 등록하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.';
    }
  },

  openModal: () => set({ modalOpen: true }),
  // 이름이 아직 없으면 닫을 수 없다.
  closeModal: () => {
    if (get().name !== null) set({ modalOpen: false });
  },
}));
